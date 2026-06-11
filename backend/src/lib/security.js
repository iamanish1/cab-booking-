const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

async function hashValue(value) {
  return bcrypt.hash(value, 10);
}

async function compareHash(value, hash) {
  return bcrypt.compare(value, hash);
}

function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createRideOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function createAccessToken(payload) {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessTtl });
}

function createRefreshToken(payload) {
  // jti ensures uniqueness even when two tokens are created within the same clock-second
  return jwt.sign(
    { ...payload, jti: crypto.randomUUID() },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshTtl }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

function signWebhookBody(rawBody) {
  return crypto
    .createHmac("sha256", env.webhookSignatureSecret)
    .update(rawBody)
    .digest("hex");
}

module.exports = {
  compareHash,
  createAccessToken,
  createOtp,
  createRefreshToken,
  createRideOtp,
  hashValue,
  signWebhookBody,
  verifyAccessToken,
  verifyRefreshToken,
};
