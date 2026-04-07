const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    role: { type: String, enum: ["customer", "driver"], default: "customer" },
    refreshTokenHash: { type: String, required: true },
    device: { type: Object, default: {} },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model("Session", sessionSchema);

module.exports = { Session };
