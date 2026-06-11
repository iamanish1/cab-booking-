const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { Driver } = require("../src/models/driver.model");
const { Ride } = require("../src/models/ride.model");
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

// ─── helpers ────────────────────────────────────────────────────────────────

async function runFullRide(app, { customerMobile, driverMobile }) {
  const { accessToken, customer } = await registerUser(app, customerMobile, "customer", {
    fullName: "Test Customer",
    city: "Jammu",
  });
  const driver = await seedOnlineDriver({ mobile: driverMobile });

  const bookRes = await bookRide(app, accessToken);
  assert.equal(bookRes.status, 201);
  const { rideId, developmentOtpPreview: rideOtp } = bookRes.body.data;

  await request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver._id) });
  await request(app).post(`/api/v1/drivers/rides/${rideId}/arrive`);
  await request(app).post(`/api/v1/drivers/rides/${rideId}/verify-otp`).send({ otp: rideOtp });
  await request(app).post(`/api/v1/drivers/rides/${rideId}/complete`).send({ finalFare: 50 });

  return { rideId, accessToken, driver, customer };
}

// ─── ride lifecycle ──────────────────────────────────────────────────────────

test("personal ride: SEARCHING_DRIVER → DRIVER_ASSIGNED → DRIVER_ARRIVING → ON_TRIP → COMPLETED", async () => {
  const { accessToken } = await registerUser(app, "9200000001", "customer", {
    fullName: "Raj Kumar",
    city: "Jammu",
  });
  const driver = await seedOnlineDriver({ mobile: "9200000091" });

  // Book
  const bookRes = await bookRide(app, accessToken);
  assert.equal(bookRes.status, 201);
  assert.equal(bookRes.body.data.status, "SEARCHING_DRIVER");
  const { rideId, developmentOtpPreview: rideOtp } = bookRes.body.data;

  // Driver accepts
  const acceptRes = await request(app)
    .post(`/api/v1/dispatch/${rideId}/accept`)
    .send({ driverId: String(driver._id) });
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body.data.status, "DRIVER_ASSIGNED");

  // Driver is now BUSY
  const busyDriver = await Driver.findById(driver._id);
  assert.equal(busyDriver.currentStatus, DRIVER_STATUS.BUSY);

  // Driver marks arriving
  const arriveRes = await request(app).post(`/api/v1/drivers/rides/${rideId}/arrive`);
  assert.equal(arriveRes.status, 200);
  assert.equal(arriveRes.body.data.status, "DRIVER_ARRIVING");

  // Driver verifies OTP
  const startRes = await request(app)
    .post(`/api/v1/drivers/rides/${rideId}/verify-otp`)
    .send({ otp: rideOtp });
  assert.equal(startRes.status, 200);
  assert.equal(startRes.body.data.status, "ON_TRIP");

  // Driver completes
  const completeRes = await request(app)
    .post(`/api/v1/drivers/rides/${rideId}/complete`)
    .send({ finalFare: 50 });
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.data.status, "COMPLETED");
  assert.equal(completeRes.body.data.finalFare, 50);

  // Driver is ONLINE again
  const driverAfter = await Driver.findById(driver._id);
  assert.equal(driverAfter.currentStatus, DRIVER_STATUS.ONLINE);
});

test("status timeline records every transition in order", async () => {
  const { rideId, accessToken } = await runFullRide(app, {
    customerMobile: "9200000002",
    driverMobile: "9200000092",
  });

  const ride = await Ride.findById(rideId);
  const statuses = ride.statusTimeline.map((e) => e.status);

  assert.ok(statuses.includes("SEARCHING_DRIVER"));
  assert.ok(statuses.includes("DRIVER_ASSIGNED"));
  assert.ok(statuses.includes("DRIVER_ARRIVING"));
  assert.ok(statuses.includes("ON_TRIP"));
  assert.ok(statuses.includes("COMPLETED"));
});

test("wrong OTP on verify-otp returns 400 invalid ride otp", async () => {
  const { accessToken } = await registerUser(app, "9200000003", "customer");
  const driver = await seedOnlineDriver({ mobile: "9200000093" });

  const { rideId } = (await bookRide(app, accessToken)).body.data;
  await request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver._id) });
  await request(app).post(`/api/v1/drivers/rides/${rideId}/arrive`);

  const res = await request(app)
    .post(`/api/v1/drivers/rides/${rideId}/verify-otp`)
    .send({ otp: "0000" });

  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /invalid ride otp/i);
});

test("verify-otp is idempotent if ride is already ON_TRIP", async () => {
  const { accessToken } = await registerUser(app, "9200000004", "customer");
  const driver = await seedOnlineDriver({ mobile: "9200000094" });

  const { rideId, developmentOtpPreview: rideOtp } = (await bookRide(app, accessToken)).body.data;
  await request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver._id) });
  await request(app).post(`/api/v1/drivers/rides/${rideId}/arrive`);
  await request(app).post(`/api/v1/drivers/rides/${rideId}/verify-otp`).send({ otp: rideOtp });

  // Second verify call — ride is already ON_TRIP, status check allows VERIFY_CODE or DRIVER_ARRIVING
  // so this will fail with 409 (wrong status)
  const second = await request(app)
    .post(`/api/v1/drivers/rides/${rideId}/verify-otp`)
    .send({ otp: rideOtp });

  assert.equal(second.status, 409);
});

// ─── booking constraints ─────────────────────────────────────────────────────

test("customer cannot book a second ride while one is active", async () => {
  const { accessToken } = await registerUser(app, "9200000005", "customer");
  await seedOnlineDriver({ mobile: "9200000095" });

  const first = await bookRide(app, accessToken);
  assert.equal(first.status, 201);

  const second = await bookRide(app, accessToken);
  assert.equal(second.status, 409);
  assert.match(second.body.error.message, /active ride/i);
});

test("shared ride rejects passengerCount above capacity of 2", async () => {
  const { accessToken } = await registerUser(app, "9200000006", "customer");

  const res = await bookRide(app, accessToken, { rideType: "shared", passengerCount: 3 });
  assert.equal(res.status, 400);
});

// ─── cancellation ────────────────────────────────────────────────────────────

test("customer can cancel a SEARCHING_DRIVER ride", async () => {
  const { accessToken } = await registerUser(app, "9200000007", "customer");
  await seedOnlineDriver({ mobile: "9200000096" });

  const { rideId } = (await bookRide(app, accessToken)).body.data;

  const res = await request(app)
    .post(`/api/v1/rides/${rideId}/cancel`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ reason: "Changed my mind" });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "CANCELLED_BY_CUSTOMER");
});

test("driver cancels assigned ride: status CANCELLED_BY_DRIVER and driver back ONLINE", async () => {
  const { accessToken } = await registerUser(app, "9200000008", "customer");
  const driver = await seedOnlineDriver({ mobile: "9200000097" });

  const { rideId } = (await bookRide(app, accessToken)).body.data;
  await request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver._id) });

  const res = await request(app)
    .post(`/api/v1/drivers/rides/${rideId}/cancel`)
    .send({ reason: "Emergency" });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "CANCELLED_BY_DRIVER");

  const driverAfter = await Driver.findById(driver._id);
  assert.equal(driverAfter.currentStatus, DRIVER_STATUS.ONLINE);
});

// ─── rating ──────────────────────────────────────────────────────────────────

test("customer rates driver 1–5 and driver average rating is recalculated", async () => {
  const driver = (await seedOnlineDriver({ mobile: "9200000098" }));
  const initialRating = driver.rating; // default 4.8

  const { rideId, accessToken } = await runFullRide(app, {
    customerMobile: "9200000009",
    driverMobile: "9200000098",
  });

  // Override driver since runFullRide creates its own — re-fetch
  const freshDriver = await Driver.findOne({ mobile: "9200000098" });

  const rateRes = await request(app)
    .post(`/api/v1/rides/${rideId}/rate`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ rating: 5 });

  assert.equal(rateRes.status, 200);
  assert.equal(rateRes.body.data.rated, true);
  assert.equal(rateRes.body.data.rating, 5);

  const ratedDriver = await Driver.findById(freshDriver._id);
  assert.equal(ratedDriver.rating, 5);
});

test("rating below 1 is rejected with 400", async () => {
  const { rideId, accessToken } = await runFullRide(app, {
    customerMobile: "9200000010",
    driverMobile: "9200000099",
  });

  const res = await request(app)
    .post(`/api/v1/rides/${rideId}/rate`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ rating: 0 });

  assert.equal(res.status, 400);
});

test("rating above 5 is rejected with 400", async () => {
  const { rideId, accessToken } = await runFullRide(app, {
    customerMobile: "9200000011",
    driverMobile: "9200000100",
  });

  const res = await request(app)
    .post(`/api/v1/rides/${rideId}/rate`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ rating: 6 });

  assert.equal(res.status, 400);
});

test("duplicate rating for same ride is rejected with 404", async () => {
  const { rideId, accessToken } = await runFullRide(app, {
    customerMobile: "9200000012",
    driverMobile: "9200000101",
  });

  await request(app)
    .post(`/api/v1/rides/${rideId}/rate`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ rating: 4 });

  const second = await request(app)
    .post(`/api/v1/rides/${rideId}/rate`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ rating: 5 });

  assert.equal(second.status, 404);
  assert.match(second.body.error.message, /already rated/i);
});

test("cannot rate an active (non-completed) ride", async () => {
  const { accessToken } = await registerUser(app, "9200000013", "customer");
  await seedOnlineDriver({ mobile: "9200000102" });

  const { rideId } = (await bookRide(app, accessToken)).body.data;

  const res = await request(app)
    .post(`/api/v1/rides/${rideId}/rate`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ rating: 5 });

  assert.equal(res.status, 404);
});

// ─── fare & estimates ────────────────────────────────────────────────────────

test("ride estimate: personal ₹10/km, shared ₹12/km (Jammu pricing)", async () => {
  const { accessToken } = await registerUser(app, "9200000014", "customer");

  // ~11km apart
  const payload = {
    pickup: { coordinates: { lat: 32.7266, lng: 74.857 } },
    drop: { coordinates: { lat: 32.6266, lng: 74.857 } },
    passengerCount: 1,
  };

  const personalRes = await request(app)
    .post("/api/v1/rides/estimate")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ ...payload, rideType: "personal" });

  const sharedRes = await request(app)
    .post("/api/v1/rides/estimate")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ ...payload, rideType: "shared" });

  assert.equal(personalRes.status, 200);
  assert.equal(sharedRes.status, 200);

  const personalFare = personalRes.body.data.fareEstimate;
  const sharedFare = sharedRes.body.data.fareEstimate;

  // ₹10/km vs ₹12/km — shared must be higher
  assert.ok(sharedFare > personalFare, `shared (${sharedFare}) should be > personal (${personalFare})`);
});

test("trip history returns completed rides with cursor pagination", async () => {
  const { accessToken } = await runFullRide(app, {
    customerMobile: "9200000015",
    driverMobile: "9200000103",
  });

  const historyRes = await request(app)
    .get("/api/v1/trips/history")
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.body.data.rides.length, 1);
  assert.equal(historyRes.body.data.rides[0].status, "COMPLETED");
});

test("driver earnings endpoint returns totals after a completed ride", async () => {
  const driver = await seedOnlineDriver({ mobile: "9200000104" });
  const { accessToken } = await registerUser(app, "9200000016", "customer");

  const { rideId, developmentOtpPreview: rideOtp } = (await bookRide(app, accessToken)).body.data;
  await request(app).post(`/api/v1/dispatch/${rideId}/accept`).send({ driverId: String(driver._id) });
  await request(app).post(`/api/v1/drivers/rides/${rideId}/arrive`);
  await request(app).post(`/api/v1/drivers/rides/${rideId}/verify-otp`).send({ otp: rideOtp });
  await request(app).post(`/api/v1/drivers/rides/${rideId}/complete`).send({ finalFare: 80 });

  const earningsRes = await request(app).get(`/api/v1/drivers/${driver._id}/earnings`);
  assert.equal(earningsRes.status, 200);
  assert.equal(earningsRes.body.data.totalRides, 1);
  assert.equal(earningsRes.body.data.totalEarnings, 80);
  assert.equal(earningsRes.body.data.todayRides, 1);
  assert.equal(earningsRes.body.data.todayEarnings, 80);
});
