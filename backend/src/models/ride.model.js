const mongoose = require("mongoose");
const { PAYMENT_METHOD, RIDE_STATUS, RIDE_TYPE } = require("../config/constants");

const locationSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    address: { type: String, default: "" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false }
);

const rideStatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    actor: { type: String, default: "system" },
    metadata: { type: Object, default: {} },
  },
  { _id: false }
);

const rideSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    rideType: { type: String, enum: Object.values(RIDE_TYPE), required: true },
    bookingMode: { type: String, default: "app" },
    pickup: { type: locationSchema, required: true },
    drop: { type: locationSchema, required: true },
    passengerCount: { type: Number, required: true },
    paymentMethod: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    fareEstimate: { type: Number, required: true },
    quotedFare: { type: Number, required: true },
    finalFare: { type: Number, default: null },
    distanceKm: { type: Number, required: true },
    etaMinutes: { type: Number, required: true },
    status: { type: String, enum: Object.values(RIDE_STATUS), required: true, index: true },
    statusVersion: { type: Number, default: 1 },
    statusTimeline: { type: [rideStatusHistorySchema], default: [] },
    otpHash: { type: String, default: null },
    otpCode: { type: String, default: null },
    assignedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null, index: true },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "" },
    city: { type: String, default: "", index: true },
  },
  { timestamps: true }
);

rideSchema.index({ customerId: 1, status: 1 });
rideSchema.index({ customerId: 1, completedAt: -1 });

const Ride = mongoose.model("Ride", rideSchema);

module.exports = { Ride };
