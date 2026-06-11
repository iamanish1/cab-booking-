const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { io: Client } = require("socket.io-client");
const { startDb, stopDb, clearDb, buildTestServer } = require("./helpers/setup");
const { registerUser, seedOnlineDriver, bookRide } = require("./helpers/fixtures");
const { emitToDriver, emitRideLifecycle } = require("../src/services/socket.service");

let app, server;
let port;

before(async () => {
  await startDb();
  ({ app, server } = buildTestServer());
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function connect() {
  return Client(`http://localhost:${port}`, {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: false, // manual reconnect in tests
  });
}

function waitFor(socket, event, ms = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event);
      reject(new Error(`Timed out waiting for socket event: "${event}"`));
    }, ms);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── graceful no-op ───────────────────────────────────────────────────────────

test("emitToDriver and emitRideLifecycle do not throw when no client is subscribed", () => {
  const fakeRide = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    customerId: "bbbbbbbbbbbbbbbbbbbbbbbb",
    status: "SEARCHING_DRIVER",
    statusVersion: 1,
  };

  assert.doesNotThrow(() => {
    emitRideLifecycle(fakeRide, "ride:searching", { estimate: 50 });
    emitToDriver("cccccccccccccccccccccccc", "ride:offer", { rideId: "test", fare: 80 });
  });
});

// ─── driver room subscription ─────────────────────────────────────────────────

test("driver receives events after subscribing to driver room", async () => {
  const driver = await seedOnlineDriver({ mobile: "9400000091" });
  const driverId = String(driver._id);

  const socket = connect();
  await waitFor(socket, "connect");

  socket.emit("driver:subscribe", { driverId });
  await pause(80);

  const eventPromise = waitFor(socket, "ride:offer");
  emitToDriver(driverId, "ride:offer", { rideId: "test-001", fare: 75 });

  const received = await eventPromise;
  assert.equal(received.rideId, "test-001");
  assert.equal(received.fare, 75);

  socket.disconnect();
});

test("driver does NOT receive events before subscribing", async () => {
  const driver = await seedOnlineDriver({ mobile: "9400000092" });
  const driverId = String(driver._id);

  const socket = connect();
  await waitFor(socket, "connect");
  // Intentionally skip driver:subscribe

  let received = false;
  socket.once("ride:offer", () => { received = true; });
  emitToDriver(driverId, "ride:offer", { rideId: "test-002" });

  await pause(200);
  assert.equal(received, false, "Should not receive event without subscribing");

  socket.disconnect();
});

// ─── disconnect and reconnect ─────────────────────────────────────────────────

test("driver must re-subscribe after disconnect — events flow again after re-subscription", async () => {
  const driver = await seedOnlineDriver({ mobile: "9400000093" });
  const driverId = String(driver._id);

  const socket = connect();
  await waitFor(socket, "connect");
  socket.emit("driver:subscribe", { driverId });
  await pause(80);

  // Manually disconnect
  socket.disconnect();
  await waitFor(socket, "disconnect");

  // Reconnect
  socket.connect();
  await waitFor(socket, "connect");

  // Without re-subscribing, no events should arrive
  let premature = false;
  socket.once("ride:offer", () => { premature = true; });
  emitToDriver(driverId, "ride:offer", { rideId: "pre-sub" });
  await pause(200);
  assert.equal(premature, false, "Should not receive without re-subscribing after reconnect");

  // Now re-subscribe
  socket.emit("driver:subscribe", { driverId });
  await pause(80);

  // Events should flow again
  const eventPromise = waitFor(socket, "ride:offer");
  emitToDriver(driverId, "ride:offer", { rideId: "test-003", fare: 90 });

  const received = await eventPromise;
  assert.equal(received.rideId, "test-003");

  socket.disconnect();
});

test("driver unsubscribe stops event delivery until re-subscribed", async () => {
  const driver = await seedOnlineDriver({ mobile: "9400000094" });
  const driverId = String(driver._id);

  const socket = connect();
  await waitFor(socket, "connect");
  socket.emit("driver:subscribe", { driverId });
  await pause(80);

  // Unsubscribe
  socket.emit("driver:unsubscribe", { driverId });
  await pause(80);

  let received = false;
  socket.once("ride:offer", () => { received = true; });
  emitToDriver(driverId, "ride:offer", { rideId: "post-unsub" });
  await pause(200);

  assert.equal(received, false, "Should not receive after unsubscribing");

  socket.disconnect();
});

// ─── customer room subscription ───────────────────────────────────────────────

test("customer receives ride:driver_assigned event after subscribing to ride room", async () => {
  const { accessToken, customer } = await registerUser(app, "9400000001", "customer", {
    fullName: "Priya Sharma",
    city: "Jammu",
  });
  const driver = await seedOnlineDriver({ mobile: "9400000095" });

  const bookRes = await bookRide(app, accessToken);
  const { rideId } = bookRes.body.data;
  const customerId = String(customer._id);

  const socket = connect();
  await waitFor(socket, "connect");
  socket.emit("ride:subscribe", { rideId, customerId });
  await pause(80);

  const assignedPromise = waitFor(socket, "ride:driver_assigned");

  // Driver accepts — this emits ride:driver_assigned to ride room and customer room
  await request(app)
    .post(`/api/v1/dispatch/${rideId}/accept`)
    .send({ driverId: String(driver._id) });

  const event = await assignedPromise;
  assert.equal(event.rideId, rideId);
  assert.equal(event.status, "DRIVER_ASSIGNED");
  assert.ok(event.driver.name);

  socket.disconnect();
});

test("customer receives ride:completed event when driver completes the trip", async () => {
  const { accessToken, customer } = await registerUser(app, "9400000002", "customer", {
    fullName: "Raj Kumar",
    city: "Jammu",
  });
  const driver = await seedOnlineDriver({ mobile: "9400000096" });

  const bookRes = await bookRide(app, accessToken);
  const { rideId, developmentOtpPreview: rideOtp } = bookRes.body.data;
  const customerId = String(customer._id);

  const socket = connect();
  await waitFor(socket, "connect");
  socket.emit("ride:subscribe", { rideId, customerId });
  await pause(80);

  // Advance ride to ON_TRIP
  await request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver._id) });
  await request(app).post(`/api/v1/drivers/rides/${rideId}/arrive`);
  await request(app).post(`/api/v1/drivers/rides/${rideId}/verify-otp`).send({ otp: rideOtp });

  const completedPromise = waitFor(socket, "ride:completed");

  await request(app)
    .post(`/api/v1/drivers/rides/${rideId}/complete`)
    .send({ finalFare: 55 });

  const event = await completedPromise;
  assert.equal(event.rideId, rideId);
  assert.equal(event.status, "COMPLETED");
  assert.equal(event.finalFare, 55);

  socket.disconnect();
});

test("customer reconnects and re-subscribes to ride room — still receives lifecycle events", async () => {
  const { accessToken, customer } = await registerUser(app, "9400000003", "customer", {
    fullName: "Anil Verma",
    city: "Jammu",
  });
  const driver = await seedOnlineDriver({ mobile: "9400000097" });

  const bookRes = await bookRide(app, accessToken);
  const { rideId } = bookRes.body.data;
  const customerId = String(customer._id);

  const socket = connect();
  await waitFor(socket, "connect");
  socket.emit("ride:subscribe", { rideId, customerId });
  await pause(80);

  // Simulate network drop
  socket.disconnect();
  await waitFor(socket, "disconnect");

  // Reconnect and re-subscribe
  socket.connect();
  await waitFor(socket, "connect");
  socket.emit("ride:subscribe", { rideId, customerId });
  await pause(80);

  const assignedPromise = waitFor(socket, "ride:driver_assigned");

  // Driver accepts — customer should still get the event via re-subscribed room
  await request(app)
    .post(`/api/v1/dispatch/${rideId}/accept`)
    .send({ driverId: String(driver._id) });

  const event = await assignedPromise;
  assert.equal(event.status, "DRIVER_ASSIGNED");

  socket.disconnect();
});

// ─── multiple clients ─────────────────────────────────────────────────────────

test("multiple sockets subscribed to the same driver room all receive the offer", async () => {
  const driver = await seedOnlineDriver({ mobile: "9400000098" });
  const driverId = String(driver._id);

  const socket1 = connect();
  const socket2 = connect();
  await Promise.all([waitFor(socket1, "connect"), waitFor(socket2, "connect")]);

  socket1.emit("driver:subscribe", { driverId });
  socket2.emit("driver:subscribe", { driverId });
  await pause(100);

  // Set up listeners BEFORE emitting so neither misses the event
  const promise1 = waitFor(socket1, "ride:offer");
  const promise2 = waitFor(socket2, "ride:offer");

  emitToDriver(driverId, "ride:offer", { rideId: "multi-001", fare: 100 });

  const [event1, event2] = await Promise.all([promise1, promise2]);

  assert.equal(event1.rideId, "multi-001");
  assert.equal(event2.rideId, "multi-001");

  socket1.disconnect();
  socket2.disconnect();
});
