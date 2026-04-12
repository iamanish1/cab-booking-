const crypto = require("crypto");
const { AppError } = require("../lib/errors");
const { Payment } = require("../models/payment.model");
const { env } = require("../config/env");

function getRazorpayInstance() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new AppError("Razorpay is not configured on this server", 500);
  }
  const Razorpay = require("razorpay");
  return new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret,
  });
}

/**
 * Create a Razorpay order and store a Payment record.
 * Amount should be in rupees (e.g. 150.5).
 * Returns the data needed by the frontend to open Razorpay checkout.
 */
async function createRazorpayOrder({ customerId, rideId, amount }) {
  if (!amount || amount <= 0) {
    throw new AppError("Amount must be greater than zero");
  }

  const razorpay = getRazorpayInstance();

  const amountInPaise = Math.round(amount * 100);

  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
  });

  await Payment.create({
    customerId,
    rideId: rideId || null,
    provider: "razorpay",
    method: "UPI",
    amount,
    status: "created",
    providerReference: order.id,
    metadata: { razorpayOrderId: order.id },
  });

  return {
    orderId: order.id,
    amount: order.amount,       // in paise — Razorpay checkout expects paise
    currency: order.currency,
    keyId: env.razorpayKeyId,   // public key, safe to send to frontend
  };
}

/**
 * Verify the Razorpay payment signature after checkout completes.
 * Called from the frontend with the 3 values Razorpay returns on success.
 * Marks the payment as "paid" in DB.
 */
async function verifyRazorpayPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  // Razorpay signature = HMAC-SHA256(orderId|paymentId, keySecret)
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    throw new AppError("Invalid payment signature", 400);
  }

  const payment = await Payment.findOne({ providerReference: razorpayOrderId });
  if (!payment) {
    throw new AppError("Payment record not found", 404);
  }

  payment.status = "paid";
  payment.metadata = {
    ...payment.metadata,
    razorpayPaymentId,
    razorpaySignature,
    verifiedAt: new Date().toISOString(),
  };
  await payment.save();

  return { verified: true, paymentId: payment._id };
}

/**
 * Handle Razorpay server-to-server webhook.
 * Razorpay signs the raw body with RAZORPAY_WEBHOOK_SECRET.
 */
async function handleRazorpayWebhook({ rawBody, signature }) {
  if (!env.razorpayWebhookSecret) {
    throw new AppError("Webhook secret not configured", 500);
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(rawBody)
    .digest("hex");

  if (expectedSignature !== signature) {
    throw new AppError("Invalid webhook signature", 401);
  }

  const event = JSON.parse(rawBody);

  if (event.event === "payment.captured") {
    const entity = event.payload.payment.entity;
    const payment = await Payment.findOne({ providerReference: entity.order_id });
    if (payment && payment.status !== "captured") {
      payment.status = "captured";
      payment.metadata = {
        ...payment.metadata,
        razorpayPaymentId: entity.id,
        capturedAt: new Date().toISOString(),
      };
      await payment.save();
    }
  }

  if (event.event === "payment.failed") {
    const entity = event.payload.payment.entity;
    const payment = await Payment.findOne({ providerReference: entity.order_id });
    if (payment) {
      payment.status = "failed";
      payment.metadata = {
        ...payment.metadata,
        failureReason: entity.error_description,
      };
      await payment.save();
    }
  }

  return { received: true };
}

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
};
