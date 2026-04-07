const { OtpRequest } = require("../models/otp-request.model");
const { Session } = require("../models/session.model");
const { Customer } = require("../models/customer.model");
const { Driver } = require("../models/driver.model");
const { AppError } = require("../lib/errors");
const { createId } = require("../lib/ids");
const {
  compareHash,
  createAccessToken,
  createOtp,
  createRefreshToken,
  hashValue,
  verifyRefreshToken,
} = require("../lib/security");
const { env } = require("../config/env");
const { createOrUpdateCustomerProfile } = require("./customer.service");

let twilioClient = null;
function getTwilioClient() {
  if (!env.twilioAccountSid || !env.twilioAuthToken) return null;
  if (!twilioClient) {
    const twilio = require("twilio");
    twilioClient = twilio(env.twilioAccountSid, env.twilioAuthToken);
  }
  return twilioClient;
}

async function sendOtpSms(mobile, otp) {
  const client = getTwilioClient();
  if (!client) return null;
  try {
    await client.messages.create({
      body: `Your CabApp OTP is: ${otp}. Valid for 5 minutes. Do not share it with anyone.`,
      from: env.twilioPhoneNumber,
      to: `+91${mobile}`,
    });
    return true;
  } catch (err) {
    console.error("[Twilio] SMS failed:", err.message);
    return false;
  }
}

function createSessionDeviceMeta(req) {
  return {
    userAgent: req.headers["user-agent"] || "",
    ip: req.ip,
  };
}

async function requestOtp(cache, mobile) {
  if (!cache) {
    throw new AppError("Cache service unavailable", 500);
  }
  if (!/^\d{10}$/.test(mobile || "")) {
    throw new AppError("Mobile number must be 10 digits");
  }

  const cooldownKey = `otp:cooldown:${mobile}`;
  const existingCooldown = await cache.get(cooldownKey);
  if (existingCooldown) {
    throw new AppError("OTP recently requested. Please wait before retrying.", 429);
  }

  const otp = createOtp();
  const codeHash = await hashValue(otp);
  const requestId = createId(12);
  const expiresAt = new Date(Date.now() + env.otpTtlSeconds * 1000);

  await OtpRequest.create({
    requestId,
    mobile,
    codeHash,
    expiresAt,
  });

  await cache.set(cooldownKey, "1", env.otpResendCooldownSeconds);

  const smsSent = await sendOtpSms(mobile, otp);
  const isProduction = env.nodeEnv === "production";

  return {
    requestId,
    resendAfter: env.otpResendCooldownSeconds,
    expiresAt,
    // Show OTP on screen if: not production AND (Twilio not configured OR SMS failed)
    ...(!isProduction && smsSent !== true && { otpPreview: otp }),
  };
}

async function verifyOtpPayload({ requestId, mobile, otp }) {
  if (!requestId || !/^\d{10}$/.test(mobile || "") || !/^\d{6}$/.test(otp || "")) {
    throw new AppError("Invalid OTP verification payload");
  }

  const otpRequest = await OtpRequest.findOne({ requestId, mobile }).sort({ createdAt: -1 });
  if (!otpRequest) throw new AppError("OTP request not found", 404);
  if (otpRequest.verifiedAt) throw new AppError("OTP already used", 400);
  if (otpRequest.expiresAt.getTime() < Date.now()) throw new AppError("OTP expired", 400);
  if (otpRequest.attempts >= 5) throw new AppError("Too many OTP attempts", 429);

  const isValid = await compareHash(otp, otpRequest.codeHash);
  if (!isValid) {
    otpRequest.attempts += 1;
    await otpRequest.save();
    throw new AppError("Invalid OTP", 400);
  }

  otpRequest.verifiedAt = new Date();
  await otpRequest.save();
  return otpRequest;
}

async function verifyOtpAndLogin({ requestId, mobile, otp, profile, req }) {
  await verifyOtpPayload({ requestId, mobile, otp });

  const role = profile?.role || "customer";

  if (role === "driver") {
    return verifyOtpAndLoginDriver({ mobile, profile, req });
  }

  return verifyOtpAndLoginCustomer({ mobile, profile, req });
}

async function verifyOtpAndLoginCustomer({ mobile, profile, req }) {
  const existingCustomer = await Customer.findOne({ mobile });

  const customer = await createOrUpdateCustomerProfile({
    mobile,
    fullName: profile?.fullName ?? existingCustomer?.fullName ?? "",
    city: profile?.city ?? existingCustomer?.city ?? env.defaultCity,
    defaultArea: profile?.defaultArea ?? existingCustomer?.defaultArea ?? "",
  });

  const accessToken = createAccessToken({ sub: String(customer._id), role: "customer" });
  const refreshToken = createRefreshToken({ sub: String(customer._id), role: "customer" });
  const refreshTokenHash = await hashValue(refreshToken);

  await Session.create({
    customerId: customer._id,
    role: "customer",
    refreshTokenHash,
    device: createSessionDeviceMeta(req),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken, customer };
}

async function verifyOtpAndLoginDriver({ mobile, profile, req }) {
  let driver = await Driver.findOne({ mobile });

  if (!driver) {
    if (!profile?.fullName || !profile?.city || !profile?.vehicleNumber || !profile?.vehicleCapacity) {
      throw new AppError("Driver not found. Please register with full profile.", 404);
    }
    driver = await Driver.create({
      mobile,
      fullName: profile.fullName,
      city: profile.city,
      vehicleNumber: profile.vehicleNumber,
      vehicleCapacity: Number(profile.vehicleCapacity),
    });
  } else if (profile?.fullName) {
    driver.fullName = profile.fullName || driver.fullName;
    driver.city = profile.city || driver.city;
    if (profile.vehicleNumber) driver.vehicleNumber = profile.vehicleNumber;
    if (profile.vehicleCapacity) driver.vehicleCapacity = Number(profile.vehicleCapacity);
    await driver.save();
  }

  const accessToken = createAccessToken({ sub: String(driver._id), role: "driver" });
  const refreshToken = createRefreshToken({ sub: String(driver._id), role: "driver" });
  const refreshTokenHash = await hashValue(refreshToken);

  await Session.create({
    driverId: driver._id,
    role: "driver",
    refreshTokenHash,
    device: createSessionDeviceMeta(req),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken, driver };
}

async function refreshCustomerSession(refreshToken) {
  if (!refreshToken) {
    throw new AppError("Missing refresh token", 400);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError("Invalid refresh token", 401);
  }

  const isDriver = payload.role === "driver";
  const sessionQuery = isDriver
    ? { driverId: payload.sub, revokedAt: null }
    : { customerId: payload.sub, revokedAt: null };

  const session = await Session.findOne(sessionQuery).sort({ createdAt: -1 });

  if (!session) {
    throw new AppError("Session not found", 401);
  }

  const matches = await compareHash(refreshToken, session.refreshTokenHash);
  if (!matches) {
    throw new AppError("Invalid session token", 401);
  }

  const accessToken = createAccessToken({ sub: payload.sub, role: payload.role });
  const nextRefreshToken = createRefreshToken({ sub: payload.sub, role: payload.role });
  session.refreshTokenHash = await hashValue(nextRefreshToken);
  await session.save();

  return {
    accessToken,
    refreshToken: nextRefreshToken,
  };
}

async function revokeRefreshToken(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    return;
  }

  const isDriver = payload.role === "driver";
  const sessionQuery = isDriver
    ? { driverId: payload.sub, revokedAt: null }
    : { customerId: payload.sub, revokedAt: null };

  const sessions = await Session.find(sessionQuery);

  for (const session of sessions) {
    const matches = await compareHash(refreshToken, session.refreshTokenHash);
    if (matches) {
      session.revokedAt = new Date();
      await session.save();
      return;
    }
  }
}

module.exports = {
  refreshCustomerSession,
  requestOtp,
  revokeRefreshToken,
  verifyOtpAndLogin,
};
