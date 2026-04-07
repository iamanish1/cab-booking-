const { Driver } = require("../models/driver.model");
const { Ride } = require("../models/ride.model");
const { distanceInKm } = require("../lib/geo");
const { DRIVER_STATUS, RIDE_STATUS, SOCKET_EVENT } = require("../config/constants");
const { emitToDriver, emitRideLifecycle } = require("./socket.service");

const OFFER_TIMEOUT_MS = 30_000; // 30 seconds for drivers to accept

async function broadcastRideOffer(rideId, logger) {
  const ride = await Ride.findById(rideId);
  if (!ride || ride.status !== RIDE_STATUS.SEARCHING_DRIVER) return;

  // Find all online drivers — NO city filter so no mismatch kills the search
  const onlineDrivers = await Driver.find({
    currentStatus: DRIVER_STATUS.ONLINE,
  })
    .limit(50)
    .lean();

  if (!onlineDrivers.length) {
    ride.status = RIDE_STATUS.NO_DRIVER_AVAILABLE;
    ride.statusVersion += 1;
    ride.statusTimeline.push({
      status: RIDE_STATUS.NO_DRIVER_AVAILABLE,
      actor: "dispatch",
      metadata: { reason: "no_online_drivers" },
      at: new Date(),
    });
    await ride.save();
    emitRideLifecycle(ride, SOCKET_EVENT.CANCELLED, { reason: "NO_DRIVER_AVAILABLE" });
    logger.warn({ rideId }, "No online drivers available");
    return;
  }

  // Sort by distance to pickup — closest first
  const sorted = onlineDrivers
    .map((d) => ({
      driver: d,
      distance: distanceInKm(
        { lat: ride.pickup.lat, lng: ride.pickup.lng },
        {
          lat: d.currentLocation.coordinates[1],
          lng: d.currentLocation.coordinates[0],
        }
      ),
    }))
    .sort((a, b) => a.distance - b.distance);

  const offerPayload = {
    rideId: String(ride._id),
    pickup: ride.pickup,
    drop: ride.drop,
    fare: ride.quotedFare,
    distanceKm: ride.distanceKm,
    rideType: ride.rideType,
    passengerCount: ride.passengerCount,
    paymentMethod: ride.paymentMethod,
    expiresIn: OFFER_TIMEOUT_MS / 1000, // seconds
  };

  // Broadcast to top 10 nearest online drivers simultaneously
  sorted.slice(0, 10).forEach(({ driver }) => {
    emitToDriver(driver._id, "ride:offer", offerPayload);
    logger.info({ driverId: String(driver._id), rideId }, "Offer sent to driver");
  });

  // If nobody accepts within 30s, mark unavailable
  setTimeout(async () => {
    try {
      const current = await Ride.findById(rideId);
      if (!current || current.status !== RIDE_STATUS.SEARCHING_DRIVER) return;

      current.status = RIDE_STATUS.NO_DRIVER_AVAILABLE;
      current.statusVersion += 1;
      current.statusTimeline.push({
        status: RIDE_STATUS.NO_DRIVER_AVAILABLE,
        actor: "dispatch",
        metadata: { reason: "offer_timeout" },
        at: new Date(),
      });
      await current.save();
      emitRideLifecycle(current, SOCKET_EVENT.CANCELLED, { reason: "NO_DRIVER_AVAILABLE" });
      logger.warn({ rideId }, "Ride offer expired — no driver accepted");
    } catch (err) {
      logger.warn({ error: err.message, rideId }, "Error during offer expiry");
    }
  }, OFFER_TIMEOUT_MS);
}

function scheduleRideDispatch(rideId, logger) {
  setTimeout(() => broadcastRideOffer(rideId, logger).catch((err) => {
    logger.warn({ error: err.message, rideId }, "Failed during dispatch broadcast");
  }), 1500);
}

module.exports = { scheduleRideDispatch };
