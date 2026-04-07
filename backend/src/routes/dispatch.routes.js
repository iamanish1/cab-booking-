const express = require("express");
const { asyncHandler } = require("../lib/async-handler");
const { ok } = require("../lib/http");
const { AppError } = require("../lib/errors");
const { Customer } = require("../models/customer.model");
const { Driver } = require("../models/driver.model");
const { Ride } = require("../models/ride.model");
const { DRIVER_STATUS, RIDE_STATUS, SOCKET_EVENT, TRIP_EVENT } = require("../config/constants");
const { emitRideLifecycle } = require("../services/socket.service");
const { scheduleRideDispatch } = require("../services/dispatch.service");
const { recordTripEvent } = require("../services/ride.service");

function createDispatchRouter({ logger }) {
  const router = express.Router();

  /**
   * Driver accepts a ride offer.
   * Uses findOneAndUpdate with status condition — atomic, no race conditions.
   * If two drivers tap Accept simultaneously, only the first wins.
   */
  router.post(
    "/:rideId/accept",
    asyncHandler(async (req, res) => {
      const { driverId } = req.body;
      if (!driverId) throw new AppError("driverId is required", 400);

      const driver = await Driver.findById(driverId);
      if (!driver) throw new AppError("Driver not found", 404);
      if (driver.currentStatus !== DRIVER_STATUS.ONLINE) {
        throw new AppError("Driver is not available", 409);
      }

      // Atomic: only succeeds if ride is still SEARCHING_DRIVER
      const ride = await Ride.findOneAndUpdate(
        { _id: req.params.rideId, status: RIDE_STATUS.SEARCHING_DRIVER },
        {
          $set: {
            driverId: driver._id,
            assignedAt: new Date(),
            status: RIDE_STATUS.DRIVER_ASSIGNED,
          },
          $inc: { statusVersion: 1 },
          $push: {
            statusTimeline: {
              status: RIDE_STATUS.DRIVER_ASSIGNED,
              actor: "driver",
              metadata: { driverId: String(driver._id) },
              at: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!ride) {
        throw new AppError("This ride was already accepted by another driver", 409);
      }

      // Mark driver busy
      driver.currentStatus = DRIVER_STATUS.BUSY;
      await driver.save();

      await recordTripEvent(ride._id, "driver", TRIP_EVENT.DRIVER_ASSIGNED, {
        driverId: String(driver._id),
      });

      const driverInfo = {
        id: String(driver._id),
        name: driver.fullName,
        mobileNumber: driver.mobile,
        rating: driver.rating,
        vehicle: {
          number: driver.vehicleNumber,
          capacity: driver.vehicleCapacity,
        },
      };

      // Notify customer
      emitRideLifecycle(ride, SOCKET_EVENT.DRIVER_ASSIGNED, { driver: driverInfo });

      logger.info({ rideId: String(ride._id), driverId: String(driver._id) }, "Driver accepted ride");

      const customer = await Customer.findById(ride.customerId).select("fullName mobile").lean();

      ok(res, {
        rideId: String(ride._id),
        status: ride.status,
        pickup: ride.pickup,
        drop: ride.drop,
        fare: ride.quotedFare,
        distanceKm: ride.distanceKm,
        rideType: ride.rideType,
        passengerCount: ride.passengerCount,
        paymentMethod: ride.paymentMethod,
        customer: customer
          ? { id: String(ride.customerId), name: customer.fullName, mobile: customer.mobile }
          : { id: String(ride.customerId) },
      });
    })
  );

  /**
   * Driver rejects / skips a ride offer.
   * Simply re-queues dispatch so the next driver can accept.
   */
  router.post(
    "/:rideId/reject",
    asyncHandler(async (req, res) => {
      const { driverId } = req.body;
      if (driverId) {
        await Driver.findByIdAndUpdate(driverId, {
          $set: { currentStatus: DRIVER_STATUS.ONLINE },
        });
      }
      // Only re-queue if still searching (another driver may have already accepted)
      const ride = await Ride.findById(req.params.rideId);
      if (ride && ride.status === RIDE_STATUS.SEARCHING_DRIVER) {
        scheduleRideDispatch(ride._id, logger);
      }
      ok(res, { requeued: true });
    })
  );

  return router;
}

module.exports = { createDispatchRouter };
