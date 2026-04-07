const express = require("express");
const { asyncHandler } = require("../lib/async-handler");
const { ok } = require("../lib/http");
const { emitRideLifecycle, SOCKET_EVENT } = require("../services/socket.service");
const { Customer } = require("../models/customer.model");
const { Driver } = require("../models/driver.model");
const { Ride } = require("../models/ride.model");
const { updateDriverLocation, updateDriverStatus } = require("../services/driver.service");
const {
  cancelRide,
  completeRide,
  moveRideToArriving,
  verifyRideOtpAndStart,
} = require("../services/ride.service");
const { applyTripCompletionToWallet } = require("../services/wallet.service");

function createDriversRouter() {
  const router = express.Router();

  router.post(
    "/:driverId/status",
    asyncHandler(async (req, res) => {
      const driver = await updateDriverStatus(req.params.driverId, req.body.status);
      ok(res, driver);
    })
  );

  router.post(
    "/:driverId/location",
    asyncHandler(async (req, res) => {
      const driver = await updateDriverLocation(req.params.driverId, req.body);
      const activeRide = await Ride.findOne({
        driverId: driver._id,
        status: { $in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "VERIFY_CODE", "ON_TRIP"] },
      });

      if (activeRide) {
        emitRideLifecycle(activeRide, SOCKET_EVENT.DRIVER_LOCATION, {
          driverLocation: {
            lat: req.body.lat,
            lng: req.body.lng,
          },
        });
      }

      ok(res, driver);
    })
  );

  router.post(
    "/rides/:rideId/arrive",
    asyncHandler(async (req, res) => {
      const ride = await moveRideToArriving(req.params.rideId);
      ok(res, ride);
    })
  );

  router.post(
    "/rides/:rideId/verify-otp",
    asyncHandler(async (req, res) => {
      const ride = await verifyRideOtpAndStart({
        rideId: req.params.rideId,
        otp: req.body.otp,
      });
      ok(res, ride);
    })
  );

  router.post(
    "/rides/:rideId/complete",
    asyncHandler(async (req, res) => {
      const ride = await completeRide({
        rideId: req.params.rideId,
        finalFare: req.body.finalFare,
      });
      await applyTripCompletionToWallet({
        customerId: ride.customerId,
        rideId: ride._id,
        amount: ride.finalFare,
      });
      ok(res, ride);
    })
  );

  router.post(
    "/rides/:rideId/cancel",
    asyncHandler(async (req, res) => {
      const ride = await cancelRide({
        rideId: req.params.rideId,
        actor: "driver",
        reason: req.body.reason,
      });
      ok(res, ride);
    })
  );

  router.get(
    "/:driverId/active-ride",
    asyncHandler(async (req, res) => {
      const activeRide = await Ride.findOne({
        driverId: req.params.driverId,
        status: { $in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "VERIFY_CODE", "ON_TRIP"] },
      }).lean();

      if (activeRide) {
        const customer = await Customer.findById(activeRide.customerId)
          .select("fullName mobile")
          .lean();
        activeRide.customer = customer
          ? { id: String(activeRide.customerId), name: customer.fullName, mobile: customer.mobile }
          : null;
      }

      ok(res, activeRide || null);
    })
  );

  router.get(
    "/seed",
    asyncHandler(async (_req, res) => {
      const drivers = await Driver.find().lean();
      ok(res, drivers);
    })
  );

  return router;
}

module.exports = { createDriversRouter };
