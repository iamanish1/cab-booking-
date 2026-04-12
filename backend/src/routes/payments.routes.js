const express = require("express");
const { asyncHandler } = require("../lib/async-handler");
const { ok } = require("../lib/http");
const { requireAuth } = require("../middleware/auth");
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} = require("../services/payment.service");

function createPaymentsRouter() {
  const router = express.Router();

  // Create a Razorpay order before opening checkout
  router.post(
    "/razorpay/order",
    requireAuth("customer"),
    asyncHandler(async (req, res) => {
      const { amount, rideId } = req.body;
      const order = await createRazorpayOrder({
        customerId: req.auth.sub,
        rideId: rideId || null,
        amount,
      });
      ok(res, order, 201);
    })
  );

  // Verify payment signature after Razorpay checkout succeeds
  router.post(
    "/razorpay/verify",
    requireAuth("customer"),
    asyncHandler(async (req, res) => {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      const result = await verifyRazorpayPayment({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      ok(res, result);
    })
  );

  // Razorpay server-to-server webhook — needs raw body for signature verification
  router.post(
    "/razorpay/webhook",
    express.raw({ type: "application/json" }),
    asyncHandler(async (req, res) => {
      const rawBody = req.body.toString("utf8");
      const signature = req.headers["x-razorpay-signature"];
      const result = await handleRazorpayWebhook({ rawBody, signature });
      ok(res, result);
    })
  );

  return router;
}

module.exports = { createPaymentsRouter };
