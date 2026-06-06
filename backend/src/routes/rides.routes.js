const express = require("express");
const { asyncHandler } = require("../lib/async-handler");
const { ok } = require("../lib/http");
const { requireAuth } = require("../middleware/auth");
const { Ride } = require("../models/ride.model");
const { Driver } = require("../models/driver.model");
const { AppError } = require("../lib/errors");
const {
  buildEstimate,
  cancelRide,
  createRide,
  getActiveRideForCustomer,
} = require("../services/ride.service");
const { scheduleRideDispatch } = require("../services/dispatch.service");

function createRidesRouter({ logger }) {
  const router = express.Router();

  router.use(requireAuth("customer"));

  router.post(
    "/estimate",
    asyncHandler(async (req, res) => {
      const estimate = buildEstimate({
        pickup: req.body.pickup.coordinates,
        drop: req.body.drop.coordinates,
        rideType: req.body.rideType,
        passengerCount: req.body.passengerCount,
      });
      ok(res, estimate);
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const { ride, rideOtp } = await createRide({
        customerId: req.auth.sub,
        payload: req.body,
      });

      scheduleRideDispatch(ride._id, logger);

      ok(
        res,
        {
          rideId: ride._id,
          status: ride.status,
          statusVersion: ride.statusVersion,
          developmentOtpPreview: rideOtp,
        },
        201
      );
    })
  );

  router.get(
    "/active/current",
    asyncHandler(async (req, res) => {
      const ride = await getActiveRideForCustomer(req.auth.sub);
      ok(res, ride);
    })
  );

  router.get(
    "/:rideId",
    asyncHandler(async (req, res) => {
      const ride = await Ride.findOne({
        _id: req.params.rideId,
        customerId: req.auth.sub,
      }).populate("driverId");
      ok(res, ride);
    })
  );

  router.post(
    "/:rideId/cancel",
    asyncHandler(async (req, res) => {
      const ride = await cancelRide({
        rideId: req.params.rideId,
        actor: "customer",
        reason: req.body.reason,
      });
      ok(res, ride);
    })
  );

  router.post(
    "/:rideId/rate",
    asyncHandler(async (req, res) => {
      const rating = Number(req.body.rating);
      if (!rating || rating < 1 || rating > 5) throw new AppError("Rating must be 1–5", 400);

      const ride = await Ride.findOneAndUpdate(
        { _id: req.params.rideId, customerId: req.auth.sub, status: "COMPLETED", customerRating: null },
        { $set: { customerRating: rating } },
        { new: true }
      );
      if (!ride) throw new AppError("Ride not found or already rated", 404);

      // Recalculate driver's average rating from all rated rides
      const ratedRides = await Ride.find({ driverId: ride.driverId, customerRating: { $ne: null } }).select("customerRating").lean();
      if (ratedRides.length) {
        const avg = ratedRides.reduce((s, r) => s + r.customerRating, 0) / ratedRides.length;
        await Driver.findByIdAndUpdate(ride.driverId, { rating: Math.round(avg * 10) / 10 });
      }

      ok(res, { rated: true, rating });
    })
  );

  return router;
}

module.exports = { createRidesRouter };
