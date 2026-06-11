const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { Driver } = require("../src/models/driver.model");
const { DRIVER_STATUS } = require("../src/config/constants");
const { startDb, stopDb, clearDb, buildTestServer } = require("./helpers/setup");
const { registerUser, seedOnlineDriver, bookRide } = require("./helpers/fixtures");

let app;

before(async () => {
  await startDb();
  ({ app } = buildTestServer());
});

after(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
});

async function bookShared(app, accessToken) {
  return bookRide(app, accessToken, { rideType: "shared", passengerCount: 1 });
}

// ─── shared-ride dispatch rules ──────────────────────────────────────────────

test("BUSY shared-ride driver can accept a second shared ride", async () => {
  const { accessToken: token1 } = await registerUser(app, "9300000001", "customer", { city: "Jammu" });
  const { accessToken: token2 } = await registerUser(app, "9300000002", "customer", { city: "Jammu" });
  const driver = await seedOnlineDriver({ mobile: "9300000091" });

  // Customer 1 books shared ride → driver accepts → BUSY
  const { rideId: ride1 } = (await bookShared(app, token1)).body.data;
  const accept1 = await request(app)
    .post(`/api/v1/dispatch/${ride1}/accept`)
    .send({ driverId: String(driver._id) });
  assert.equal(accept1.status, 200);

  const busy = await Driver.findById(driver._id);
  assert.equal(busy.currentStatus, DRIVER_STATUS.BUSY);

  // Customer 2 books shared ride → BUSY driver is eligible
  const { rideId: ride2 } = (await bookShared(app, token2)).body.data;
  const accept2 = await request(app)
    .post(`/api/v1/dispatch/${ride2}/accept`)
    .send({ driverId: String(driver._id) });

  assert.equal(accept2.status, 200);
  assert.equal(accept2.body.data.status, "DRIVER_ASSIGNED");
});

test("BUSY driver cannot accept a personal ride", async () => {
  const { accessToken: token1 } = await registerUser(app, "9300000003", "customer", { city: "Jammu" });
  const { accessToken: token2 } = await registerUser(app, "9300000004", "customer", { city: "Jammu" });
  const driver = await seedOnlineDriver({ mobile: "9300000092" });

  // Customer 1 books personal → driver becomes BUSY
  const { rideId: ride1 } = (await bookRide(app, token1)).body.data;
  await request(app).post(`/api/v1/dispatch/${ride1}/accept`).send({ driverId: String(driver._id) });

  // Customer 2 books personal → BUSY driver must be rejected
  const { rideId: ride2 } = (await bookRide(app, token2)).body.data;
  const res = await request(app)
    .post(`/api/v1/dispatch/${ride2}/accept`)
    .send({ driverId: String(driver._id) });

  assert.equal(res.status, 409);
  assert.match(res.body.error.message, /not available/i);
});

test("OFFLINE driver cannot accept any ride", async () => {
  const { accessToken } = await registerUser(app, "9300000005", "customer", { city: "Jammu" });
  const offlineDriver = await Driver.create({
    mobile: "9300000093",
    fullName: "Offline Driver",
    city: "Jammu",
    vehicleNumber: "JK01XX0001",
    vehicleCapacity: 4,
    currentStatus: DRIVER_STATUS.OFFLINE,
    currentLocation: { type: "Point", coordinates: [74.857, 32.7266] },
  });

  const { rideId } = (await bookRide(app, accessToken)).body.data;
  const res = await request(app)
    .post(`/api/v1/dispatch/${rideId}/accept`)
    .send({ driverId: String(offlineDriver._id) });

  assert.equal(res.status, 409);
});

// ─── race condition guard ────────────────────────────────────────────────────

test("only one driver wins when two attempt to accept the same ride simultaneously", async () => {
  const { accessToken } = await registerUser(app, "9300000006", "customer", { city: "Jammu" });
  const driver1 = await seedOnlineDriver({ mobile: "9300000094" });
  const driver2 = await Driver.create({
    mobile: "9300000095",
    fullName: "Driver 2",
    city: "Jammu",
    vehicleNumber: "JK01YY0002",
    vehicleCapacity: 4,
    currentStatus: DRIVER_STATUS.ONLINE,
    currentLocation: { type: "Point", coordinates: [74.857, 32.7266] },
  });

  const { rideId } = (await bookRide(app, accessToken)).body.data;

  // Fire both accepts at the same time
  const [res1, res2] = await Promise.all([
    request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver1._id) }),
    request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver2._id) }),
  ]);

  const codes = [res1.status, res2.status].sort();
  assert.deepEqual(codes, [200, 409], "Exactly one accept should succeed and one should get 409");
});

test("reject re-queues dispatch — ride stays SEARCHING_DRIVER for the next driver", async () => {
  const { accessToken } = await registerUser(app, "9300000007", "customer", { city: "Jammu" });
  const driver = await seedOnlineDriver({ mobile: "9300000096" });

  const { rideId } = (await bookRide(app, accessToken)).body.data;

  const rejectRes = await request(app)
    .post(`/api/v1/dispatch/${rideId}/reject`)
    .send({ driverId: String(driver._id) });

  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.data.requeued, true);

  // Ride is still searching
  const ride = await request(app)
    .get(`/api/v1/rides/${rideId}`)
    .set("Authorization", `Bearer ${accessToken}`);
  assert.equal(ride.body.data.status, "SEARCHING_DRIVER");
});

// ─── full shared ride lifecycle ───────────────────────────────────────────────

test("shared ride completes full lifecycle and appears in driver earnings", async () => {
  const { accessToken } = await registerUser(app, "9300000008", "customer", { city: "Jammu" });
  const driver = await seedOnlineDriver({ mobile: "9300000097" });

  const bookRes = await bookShared(app, accessToken);
  assert.equal(bookRes.status, 201);
  const { rideId, developmentOtpPreview: rideOtp } = bookRes.body.data;

  await request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver._id) });
  await request(app).post(`/api/v1/drivers/rides/${rideId}/arrive`);
  await request(app).post(`/api/v1/drivers/rides/${rideId}/verify-otp`).send({ otp: rideOtp });
  const completeRes = await request(app)
    .post(`/api/v1/drivers/rides/${rideId}/complete`)
    .send({ finalFare: 60 });

  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.data.status, "COMPLETED");

  const earningsRes = await request(app).get(`/api/v1/drivers/${driver._id}/earnings`);
  assert.equal(earningsRes.status, 200);
  assert.equal(earningsRes.body.data.totalRides, 1);
  assert.equal(earningsRes.body.data.totalEarnings, 60);
});

test("driver active-ride endpoint returns the current shared ride with customer info", async () => {
  const { accessToken } = await registerUser(app, "9300000009", "customer", {
    fullName: "Priya Sharma",
    city: "Jammu",
  });
  const driver = await seedOnlineDriver({ mobile: "9300000098" });

  const { rideId } = (await bookShared(app, accessToken)).body.data;
  await request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver._id) });

  const activeRes = await request(app).get(`/api/v1/drivers/${driver._id}/active-ride`);
  assert.equal(activeRes.status, 200);
  assert.equal(activeRes.body.data.rideType, "shared");
  assert.ok(activeRes.body.data.customer);
  assert.equal(activeRes.body.data.customer.name, "Priya Sharma");
});
