const mongoose = require("mongoose");
const { DRIVER_STATUS } = require("../config/constants");

const driverSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    mobile: { type: String, required: true, unique: true, index: true },
    city: { type: String, required: true, index: true },
    vehicleNumber: { type: String, required: true },
    vehicleCapacity: { type: Number, required: true },
    rating: { type: Number, default: 4.8 },
    currentStatus: {
      type: String,
      enum: Object.values(DRIVER_STATUS),
      default: DRIVER_STATUS.OFFLINE,
      index: true,
    },
    expoPushToken: { type: String, default: null },
    currentLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [77.209, 28.6139],
      },
    },
  },
  { timestamps: true }
);

driverSchema.index({ currentLocation: "2dsphere", currentStatus: 1, city: 1 });

const Driver = mongoose.model("Driver", driverSchema);

module.exports = { Driver };
