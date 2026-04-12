const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    rideId:            { type: mongoose.Schema.Types.ObjectId, ref: "Ride", default: null, index: true },
    customerId:        { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    provider:          { type: String, default: "razorpay" },
    method:            { type: String, required: true },
    status:            { type: String, default: "created", enum: ["created", "paid", "captured", "failed", "refunded"] },
    providerReference: { type: String, default: "", index: true }, // Razorpay order ID
    amount:            { type: Number, required: true },           // in rupees
    metadata:          { type: Object, default: {} },
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = { Payment };
