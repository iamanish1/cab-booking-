const express = require("express");
const { asyncHandler } = require("../lib/async-handler");
const { ok } = require("../lib/http");
const { emitRideLifecycle, SOCKET_EVENT } = require("../services/socket.service");
const { Customer } = require("../models/customer.model");
const { Driver } = require("../models/driver.model");
const { Ride } = require("../models/ride.model");
const { sendExpoPushNotification } = require("../services/notification.service");
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

      // Push notification to customer (best-effort)
      const customer = await Customer.findById(ride.customerId).select("expoPushToken").lean();
      if (customer?.expoPushToken) {
        sendExpoPushNotification([customer.expoPushToken], {
          title: "Trip Completed",
          body: `Your ride is complete. Fare: ₹${ride.finalFare}. Rate your driver!`,
          data: { rideId: String(ride._id), event: "COMPLETED" },
        }).catch(() => {});
      }

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
    "/:driverId/earnings",
    asyncHandler(async (req, res) => {
      const { WalletTransaction } = require("../models/wallet-transaction.model");
      const driver = await Driver.findById(req.params.driverId).select("fullName mobile").lean();
      if (!driver) throw new (require("../lib/errors").AppError)("Driver not found", 404);

      const completedRides = await Ride.find({
        driverId: req.params.driverId,
        status: "COMPLETED",
      }).select("finalFare quotedFare completedAt rideType").sort({ completedAt: -1 }).lean();

      const totalEarnings = completedRides.reduce((sum, r) => sum + (r.finalFare || r.quotedFare || 0), 0);
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayRides = completedRides.filter((r) => r.completedAt && new Date(r.completedAt) >= todayStart);
      const todayEarnings = todayRides.reduce((sum, r) => sum + (r.finalFare || r.quotedFare || 0), 0);

      ok(res, {
        totalEarnings,
        totalRides: completedRides.length,
        todayEarnings,
        todayRides: todayRides.length,
        recentRides: completedRides.slice(0, 10),
      });
    })
  );

  router.post(
    "/:driverId/push-token",
    asyncHandler(async (req, res) => {
      const { token } = req.body;
      if (token) {
        await Driver.findByIdAndUpdate(req.params.driverId, { expoPushToken: token });
      }
      ok(res, { registered: true });
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
