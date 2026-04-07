const { AppError } = require("../lib/errors");
const { distanceInKm, ensureCoordinates } = require("../lib/geo");
const { createId } = require("../lib/ids");
const { compareHash, createRideOtp, hashValue } = require("../lib/security");
const { Driver } = require("../models/driver.model");
const { Ride } = require("../models/ride.model");
const { TripEvent } = require("../models/trip-event.model");
const {
  ACTIVE_RIDE_STATUSES,
  DRIVER_STATUS,
  PAYMENT_METHOD,
  RIDE_STATUS,
  RIDE_TYPE,
  SOCKET_EVENT,
  TERMINAL_RIDE_STATUSES,
  TRIP_EVENT,
} = require("../config/constants");
const { emitRideLifecycle, emitToDriver } = require("./socket.service");

function computeFareBreakdown({ distanceKm, rideType }) {
  const baseFare = rideType === RIDE_TYPE.SHARED ? 30 : 100;
  const distanceComponent = Math.round(distanceKm * (rideType === RIDE_TYPE.SHARED ? 5 : 12));
  const surge = 0;
  const fare = baseFare + distanceComponent + surge;

  return {
    baseFare,
    distanceComponent,
    surge,
    fare,
  };
}

function buildEstimate({ pickup, drop, rideType, passengerCount }) {
  ensureCoordinates(pickup, "pickup");
  ensureCoordinates(drop, "drop");

  if (!Object.values(RIDE_TYPE).includes(rideType)) {
    throw new AppError("Invalid ride type");
  }

  const maxCapacity = rideType === RIDE_TYPE.SHARED ? 2 : 4;
  if (passengerCount < 1 || passengerCount > maxCapacity) {
    throw new AppError("Passenger count exceeds ride capacity");
  }

  const distanceKm = Number(distanceInKm(pickup, drop).toFixed(2));
  const etaMinutes = Math.max(5, Math.ceil(distanceKm * 3));
  const fareBreakdown = computeFareBreakdown({ distanceKm, rideType });

  return {
    quoteId: createId(10),
    rideType,
    passengerCount,
    distanceKm,
    etaMinutes,
    fareBreakdown,
    fareEstimate: fareBreakdown.fare,
    quoteExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  };
}

async function recordTripEvent(rideId, actor, eventType, payload = {}) {
  await TripEvent.create({
    rideId,
    actor,
    eventType,
    payload,
  });
}

async function appendRideStatus(ride, status, actor, metadata = {}) {
  ride.status = status;
  ride.statusVersion += 1;
  ride.statusTimeline.push({ status, actor, metadata, at: new Date() });
  await ride.save();
}

function ensureRideStatus(ride, allowedStatuses) {
  if (!allowedStatuses.includes(ride.status)) {
    throw new AppError(`Ride status ${ride.status} does not allow this operation`, 409);
  }
}

async function createRide({ customerId, payload }) {
  if (!Object.values(PAYMENT_METHOD).includes(payload.paymentMethod)) {
    throw new AppError("Invalid payment method");
  }

  const existingRide = await Ride.findOne({
    customerId,
    status: { $in: ACTIVE_RIDE_STATUSES },
  });

  if (existingRide) {
    throw new AppError("Customer already has an active ride", 409);
  }

  const estimate = buildEstimate({
    pickup: payload.pickup.coordinates,
    drop: payload.drop.coordinates,
    rideType: payload.rideType,
    passengerCount: payload.passengerCount,
  });

  const rideOtp = createRideOtp();
  const ride = await Ride.create({
    customerId,
    rideType: payload.rideType,
    pickup: {
      label: payload.pickup.label,
      address: payload.pickup.address || "",
      lat: payload.pickup.coordinates.lat,
      lng: payload.pickup.coordinates.lng,
    },
    drop: {
      label: payload.drop.label,
      address: payload.drop.address || "",
      lat: payload.drop.coordinates.lat,
      lng: payload.drop.coordinates.lng,
    },
    passengerCount: payload.passengerCount,
    paymentMethod: payload.paymentMethod,
    fareEstimate: estimate.fareEstimate,
    quotedFare: estimate.fareEstimate,
    distanceKm: estimate.distanceKm,
    etaMinutes: estimate.etaMinutes,
    status: RIDE_STATUS.SEARCHING_DRIVER,
    statusTimeline: [
      {
        status: RIDE_STATUS.SEARCHING_DRIVER,
        actor: "customer",
        metadata: {},
      },
    ],
    otpHash: await hashValue(rideOtp),
    otpCode: rideOtp,
    city: payload.city || "Delhi",
  });

  await recordTripEvent(ride._id, "customer", TRIP_EVENT.CREATED, {
    paymentMethod: payload.paymentMethod,
  });

  emitRideLifecycle(ride, SOCKET_EVENT.RIDE_SEARCHING, {
    estimate: estimate.fareEstimate,
  });

  return { ride, rideOtp };
}

async function assignNearestDriver(ride) {
  const drivers = await Driver.find({
    currentStatus: DRIVER_STATUS.ONLINE,
    city: ride.city,
  })
    .limit(10)
    .lean();

  if (!drivers.length) {
    await appendRideStatus(ride, RIDE_STATUS.NO_DRIVER_AVAILABLE, "dispatch");
    await recordTripEvent(ride._id, "dispatch", TRIP_EVENT.CANCELLED, {
      reason: "no_driver_available",
    });
    emitRideLifecycle(ride, SOCKET_EVENT.CANCELLED, { reason: "NO_DRIVER_AVAILABLE" });
    return null;
  }

  const sorted = drivers
    .map((driver) => ({
      driver,
      distance: distanceInKm(
        { lat: ride.pickup.lat, lng: ride.pickup.lng },
        { lat: driver.currentLocation.coordinates[1], lng: driver.currentLocation.coordinates[0] }
      ),
    }))
    .sort((left, right) => left.distance - right.distance);

  const selectedDriver = sorted[0].driver;
  const updatedRide = await Ride.findById(ride._id);
  updatedRide.driverId = selectedDriver._id;
  updatedRide.assignedAt = new Date();
  await appendRideStatus(updatedRide, RIDE_STATUS.DRIVER_ASSIGNED, "dispatch", {
    driverId: String(selectedDriver._id),
  });

  await Driver.findByIdAndUpdate(selectedDriver._id, {
    $set: { currentStatus: DRIVER_STATUS.BUSY },
  });

  await recordTripEvent(updatedRide._id, "dispatch", TRIP_EVENT.DRIVER_ASSIGNED, {
    driverId: String(selectedDriver._id),
  });

  emitRideLifecycle(updatedRide, SOCKET_EVENT.DRIVER_ASSIGNED, {
    driver: {
      id: String(selectedDriver._id),
      name: selectedDriver.fullName,
      rating: selectedDriver.rating,
      mobileNumber: selectedDriver.mobile,
      vehicle: {
        number: selectedDriver.vehicleNumber,
        capacity: selectedDriver.vehicleCapacity,
      },
    },
  });

  emitToDriver(selectedDriver._id, "ride:new_assignment", {
    rideId: String(updatedRide._id),
    pickup: updatedRide.pickup,
    drop: updatedRide.drop,
    fare: updatedRide.quotedFare,
    distanceKm: updatedRide.distanceKm,
    rideType: updatedRide.rideType,
    passengerCount: updatedRide.passengerCount,
    paymentMethod: updatedRide.paymentMethod,
  });

  return updatedRide;
}

async function moveRideToArriving(rideId) {
  const ride = await Ride.findById(rideId).populate("driverId");
  // Idempotent: already past the DRIVER_ARRIVING stage
  if (ride && [RIDE_STATUS.DRIVER_ARRIVING, RIDE_STATUS.VERIFY_CODE, RIDE_STATUS.ON_TRIP].includes(ride.status)) {
    return ride;
  }
  ensureRideStatus(ride, [RIDE_STATUS.DRIVER_ASSIGNED]);

  await appendRideStatus(ride, RIDE_STATUS.DRIVER_ARRIVING, "driver");
  await recordTripEvent(ride._id, "driver", TRIP_EVENT.DRIVER_ARRIVING);

  emitRideLifecycle(ride, SOCKET_EVENT.DRIVER_ARRIVING, {
    driver: ride.driverId
      ? {
          id: String(ride.driverId._id),
          name: ride.driverId.fullName,
          mobileNumber: ride.driverId.mobile,
        }
      : null,
  });

  return ride;
}

async function exposeRideOtp(rideId) {
  const ride = await Ride.findById(rideId);
  // Idempotent: already at or past VERIFY_CODE
  if (ride && [RIDE_STATUS.VERIFY_CODE, RIDE_STATUS.ON_TRIP].includes(ride.status)) return ride;
  ensureRideStatus(ride, [RIDE_STATUS.DRIVER_ARRIVING, RIDE_STATUS.DRIVER_ASSIGNED]);

  await appendRideStatus(ride, RIDE_STATUS.VERIFY_CODE, "system");
  await recordTripEvent(ride._id, "system", TRIP_EVENT.OTP_READY);
  emitRideLifecycle(ride, SOCKET_EVENT.OTP_READY);
  return ride;
}

async function verifyRideOtpAndStart({ rideId, otp }) {
  const ride = await Ride.findById(rideId);
  ensureRideStatus(ride, [RIDE_STATUS.VERIFY_CODE, RIDE_STATUS.DRIVER_ARRIVING]);

  const matches = await compareHash(otp, ride.otpHash);
  if (!matches) {
    throw new AppError("Invalid ride OTP", 400);
  }

  ride.startedAt = new Date();
  await appendRideStatus(ride, RIDE_STATUS.ON_TRIP, "driver");
  await recordTripEvent(ride._id, "driver", TRIP_EVENT.STARTED);
  emitRideLifecycle(ride, SOCKET_EVENT.STARTED);

  return ride;
}

async function cancelRide({ rideId, actor, reason }) {
  const ride = await Ride.findById(rideId);
  ensureRideStatus(ride, ACTIVE_RIDE_STATUSES);

  const nextStatus =
    actor === "customer" ? RIDE_STATUS.CANCELLED_BY_CUSTOMER : RIDE_STATUS.CANCELLED_BY_DRIVER;
  ride.cancelledAt = new Date();
  ride.cancellationReason = reason || "";
  await appendRideStatus(ride, nextStatus, actor, { reason });

  if (ride.driverId) {
    await Driver.findByIdAndUpdate(ride.driverId, { $set: { currentStatus: DRIVER_STATUS.ONLINE } });
  }

  await recordTripEvent(ride._id, actor, TRIP_EVENT.CANCELLED, { reason });
  emitRideLifecycle(ride, SOCKET_EVENT.CANCELLED, { reason: nextStatus });
  return ride;
}

async function completeRide({ rideId, finalFare }) {
  const ride = await Ride.findById(rideId);
  ensureRideStatus(ride, [RIDE_STATUS.ON_TRIP]);

  ride.completedAt = new Date();
  ride.finalFare = finalFare || ride.quotedFare;
  await appendRideStatus(ride, RIDE_STATUS.COMPLETED, "driver", {
    finalFare: ride.finalFare,
  });

  if (ride.driverId) {
    await Driver.findByIdAndUpdate(ride.driverId, { $set: { currentStatus: DRIVER_STATUS.ONLINE } });
  }

  await recordTripEvent(ride._id, "driver", TRIP_EVENT.COMPLETED, {
    finalFare: ride.finalFare,
  });
  emitRideLifecycle(ride, SOCKET_EVENT.COMPLETED, { finalFare: ride.finalFare });

  return ride;
}

async function getActiveRideForCustomer(customerId) {
  return Ride.findOne({
    customerId,
    status: { $in: ACTIVE_RIDE_STATUSES },
  }).populate("driverId");
}

async function getTripHistory(customerId, { cursor, limit = 10 }) {
  const query = {
    customerId,
    status: { $in: TERMINAL_RIDE_STATUSES },
  };

  if (cursor) {
    query.completedAt = { $lt: new Date(cursor) };
  }

  const rides = await Ride.find(query)
    .sort({ completedAt: -1, createdAt: -1 })
    .limit(Math.min(Number(limit) || 10, 50))
    .lean();

  const nextCursor = rides.length ? rides[rides.length - 1].completedAt : null;
  return { rides, nextCursor };
}

module.exports = {
  assignNearestDriver,
  buildEstimate,
  cancelRide,
  completeRide,
  createRide,
  exposeRideOtp,
  getActiveRideForCustomer,
  getTripHistory,
  moveRideToArriving,
  recordTripEvent,
  verifyRideOtpAndStart,
};
