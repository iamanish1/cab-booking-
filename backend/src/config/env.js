const dotenv = require("dotenv");

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;

  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/cab-booking"),
  redisUrl: process.env.REDIS_URL || "",
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || "15m",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL || "30d",
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 300),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60),
  defaultCity: process.env.DEFAULT_CITY || "Delhi",
  customerCashbackTarget: Number(process.env.CUSTOMER_CASHBACK_TARGET || 10),
  customerCashbackBonus: Number(process.env.CUSTOMER_CASHBACK_BONUS || 20),
  logLevel: process.env.LOG_LEVEL || "info",
  webhookSignatureSecret: process.env.WEBHOOK_SIGNATURE_SECRET || "dev-webhook-secret",
  nodeEnv: process.env.NODE_ENV || "development",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
};

module.exports = { env };
