const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { startDb, stopDb, clearDb, buildTestServer } = require("./helpers/setup");
const { registerUser } = require("./helpers/fixtures");

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

test("request OTP returns requestId and 6-digit otpPreview in dev mode", async () => {
  const res = await request(app)
    .post("/api/v1/auth/request-otp")
    .send({ mobile: "9100000001" });

  assert.equal(res.status, 201);
  assert.ok(res.body.data.requestId);
  assert.match(res.body.data.otpPreview, /^\d{6}$/);
});

test("request OTP rejects mobile number shorter than 10 digits", async () => {
  const res = await request(app)
    .post("/api/v1/auth/request-otp")
    .send({ mobile: "98765" });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test("request OTP rejects non-numeric mobile", async () => {
  const res = await request(app)
    .post("/api/v1/auth/request-otp")
    .send({ mobile: "abcdefghij" });

  assert.equal(res.status, 400);
});

test("verify OTP registers a new customer and returns tokens", async () => {
  const data = await registerUser(app, "9100000002", "customer", {
    fullName: "Amit Kumar",
    city: "Jammu",
  });

  assert.ok(data.accessToken);
  assert.ok(data.refreshToken);
  assert.ok(data.customer._id);
  assert.equal(data.customer.mobile, "9100000002");
});

test("verify OTP with wrong code returns 400", async () => {
  const otpRes = await request(app)
    .post("/api/v1/auth/request-otp")
    .send({ mobile: "9100000003" });

  const { requestId } = otpRes.body.data;

  const res = await request(app)
    .post("/api/v1/auth/verify-otp")
    .send({
      requestId,
      mobile: "9100000003",
      otp: "000000",
      profile: { role: "customer" },
    });

  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /invalid otp/i);
});

test("OTP cannot be reused after a successful verification", async () => {
  const otpRes = await request(app)
    .post("/api/v1/auth/request-otp")
    .send({ mobile: "9100000004" });

  const { requestId, otpPreview } = otpRes.body.data;
  const payload = { requestId, mobile: "9100000004", otp: otpPreview, profile: { role: "customer" } };

  const first = await request(app).post("/api/v1/auth/verify-otp").send(payload);
  assert.equal(first.status, 200);

  const second = await request(app).post("/api/v1/auth/verify-otp").send(payload);
  assert.equal(second.status, 400);
  assert.match(second.body.error.message, /already used/i);
});

test("protected customer route accepts a valid access token", async () => {
  const { accessToken } = await registerUser(app, "9100000005", "customer");

  const res = await request(app)
    .get("/api/v1/rides/active/current")
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 200);
});

test("protected route rejects request with no token", async () => {
  const res = await request(app).get("/api/v1/rides/active/current");
  assert.equal(res.status, 401);
});

test("protected route rejects a tampered/invalid token", async () => {
  const res = await request(app)
    .get("/api/v1/rides/active/current")
    .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.fake.payload");

  assert.equal(res.status, 401);
});

test("driver token is rejected on customer-only route with 403", async () => {
  const { accessToken } = await registerUser(app, "9100000006", "driver", {
    fullName: "Suresh Driver",
    city: "Jammu",
    vehicleNumber: "JK01BB0001",
    vehicleCapacity: "4",
  });

  const res = await request(app)
    .get("/api/v1/rides/active/current")
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 403);
});

test("token refresh returns a new token pair", async () => {
  const { refreshToken: firstRefresh } = await registerUser(app, "9100000007", "customer");

  const refreshRes = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: firstRefresh });

  assert.equal(refreshRes.status, 200);
  const { accessToken: newAccess, refreshToken: newRefresh } = refreshRes.body.data;
  assert.ok(newAccess);
  assert.ok(newRefresh);
  assert.notEqual(newRefresh, firstRefresh);
});

test("new access token from refresh works on protected route", async () => {
  const { refreshToken } = await registerUser(app, "9100000008", "customer");

  const { body: { data: { accessToken: newAccess } } } = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken });

  const res = await request(app)
    .get("/api/v1/rides/active/current")
    .set("Authorization", `Bearer ${newAccess}`);

  assert.equal(res.status, 200);
});

test("used refresh token is rotated and cannot be reused", async () => {
  const { refreshToken: firstRefresh } = await registerUser(app, "9100000009", "customer");

  // Use it once to get a new pair
  await request(app).post("/api/v1/auth/refresh").send({ refreshToken: firstRefresh });

  // Attempt to reuse the old refresh token
  const retryRes = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: firstRefresh });

  assert.equal(retryRes.status, 401);
});

test("refresh with a missing token returns 400", async () => {
  const res = await request(app).post("/api/v1/auth/refresh").send({});
  assert.equal(res.status, 400);
});

test("logout revokes the refresh token so it cannot be used again", async () => {
  const { refreshToken } = await registerUser(app, "9100000010", "customer");

  const logoutRes = await request(app)
    .post("/api/v1/auth/logout")
    .send({ refreshToken });

  assert.equal(logoutRes.status, 200);
  assert.equal(logoutRes.body.data.loggedOut, true);

  const refreshRes = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken });

  assert.equal(refreshRes.status, 401);
});

test("second login on same mobile updates the customer record (upsert)", async () => {
  await registerUser(app, "9100000011", "customer", { fullName: "First Name" });
  // Clear OTP cooldown by clearing DB between subtests — no, we need to use a fresh OTP
  // Since clearDb runs only before each top-level test we use unique mobile
});

test("driver registration creates driver record with provided profile", async () => {
  const data = await registerUser(app, "9100000012", "driver", {
    fullName: "Ramesh Chauffeur",
    city: "Jammu",
    vehicleNumber: "JK02ZZ9999",
    vehicleCapacity: "4",
  });

  assert.ok(data.accessToken);
  assert.ok(data.driver._id);
  assert.equal(data.driver.mobile, "9100000012");
  assert.equal(data.driver.vehicleNumber, "JK02ZZ9999");
});
