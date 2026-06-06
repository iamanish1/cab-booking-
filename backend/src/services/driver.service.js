const { Driver } = require("../models/driver.model");
const { AppError } = require("../lib/errors");
const { DRIVER_STATUS } = require("../config/constants");

async function ensureSeedDrivers() {
  const existing = await Driver.countDocuments();
  if (existing > 0) return;

  await Driver.insertMany([
    {
      fullName: "Rahul Sharma",
      mobile: "9990074614",
      city: "Jammu",
      vehicleNumber: "JK01AB2345",
      vehicleCapacity: 4,
      currentStatus: DRIVER_STATUS.ONLINE,
      // Jammu city center coordinates [lng, lat]
      currentLocation: { type: "Point", coordinates: [74.8570, 32.7266] },
    },
    {
      fullName: "Vikram Singh",
      mobile: "9990074615",
      city: "Jammu",
      vehicleNumber: "JK02CD4567",
      vehicleCapacity: 4,
      currentStatus: DRIVER_STATUS.ONLINE,
      currentLocation: { type: "Point", coordinates: [74.8527, 32.7185] },
    },
  ]);
}

async function updateDriverStatus(driverId, status) {
  if (!Object.values(DRIVER_STATUS).includes(status)) {
    throw new AppError("Invalid driver status");
  }

  const driver = await Driver.findByIdAndUpdate(driverId, { $set: { currentStatus: status } }, { new: true });
  if (!driver) throw new AppError("Driver not found", 404);
  return driver;
}

async function updateDriverLocation(driverId, { lat, lng }) {
  const driver = await Driver.findByIdAndUpdate(
    driverId,
    {
      $set: {
        currentLocation: {
          type: "Point",
          coordinates: [lng, lat],
        },
      },
    },
    { new: true }
  );

  if (!driver) throw new AppError("Driver not found", 404);
  return driver;
}

module.exports = {
  ensureSeedDrivers,
  updateDriverLocation,
  updateDriverStatus,
};
