const request = require("supertest");
const { Driver } = require("../../src/models/driver.model");
const { DRIVER_STATUS } = require("../../src/config/constants");

async function registerUser(app, mobile, role = "customer", profile = {}) {
  const otpRes = await request(app)
    .post("/api/v1/auth/request-otp")
    .send({ mobile });

  const { requestId, otpPreview } = otpRes.body.data;

  const loginRes = await request(app)
    .post("/api/v1/auth/verify-otp")
    .send({
      requestId,
      mobile,
      otp: otpPreview,
      profile: { role, ...profile },
    });

  return loginRes.body.data;
}

async function seedOnlineDriver({ mobile = "9000000001", city = "Jammu" } = {}) {
  return Driver.create({
    mobile,
    fullName: "Test Driver",
    city,
    vehicleNumber: "JK01AA0001",
    vehicleCapacity: 4,
    currentStatus: DRIVER_STATUS.ONLINE,
    // Jammu city centre coordinates
    currentLocation: { type: "Point", coordinates: [74.857, 32.7266] },
  });
}

async function bookRide(app, accessToken, overrides = {}) {
  return request(app)
    .post("/api/v1/rides")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      pickup: {
        label: "Railway Station",
        coordinates: { lat: 32.7266, lng: 74.857 },
      },
      drop: {
        label: "Gandhi Nagar",
        coordinates: { lat: 32.7383, lng: 74.8722 },
      },
      rideType: "personal",
      passengerCount: 1,
      paymentMethod: "CASH",
      city: "Jammu",
      ...overrides,
    });
}

module.exports = { registerUser, seedOnlineDriver, bookRide };
