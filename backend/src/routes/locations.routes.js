const express = require("express");
const { ok } = require("../lib/http");
const { POPULAR_LOCATIONS, RIDE_TYPE } = require("../config/constants");
const { buildEstimate } = require("../services/ride.service");

function createLocationsRouter() {
  const router = express.Router();

  router.get("/popular", (req, res) => {
    const city = req.query.city || "Delhi";
    ok(res, {
      city,
      locations: POPULAR_LOCATIONS[city] || POPULAR_LOCATIONS.Delhi,
    });
  });

  router.get("/ride-options", (req, res) => {
    const pickup = {
      lat: Number(req.query.pickupLat),
      lng: Number(req.query.pickupLng),
    };
    const drop = {
      lat: Number(req.query.dropLat),
      lng: Number(req.query.dropLng),
    };

    try {
      const shared = buildEstimate({ pickup, drop, rideType: RIDE_TYPE.SHARED, passengerCount: 1 });
      const personal = buildEstimate({ pickup, drop, rideType: RIDE_TYPE.PERSONAL, passengerCount: 1 });

      ok(res, {
        options: [
          {
            rideType: RIDE_TYPE.SHARED,
            maxCapacity: 2,
            estimatedFare: shared.fareEstimate,
            etaMinutes: shared.etaMinutes,
            surge: false,
          },
          {
            rideType: RIDE_TYPE.PERSONAL,
            maxCapacity: 4,
            estimatedFare: personal.fareEstimate,
            etaMinutes: personal.etaMinutes,
            surge: false,
          },
        ],
      });
    } catch {
      ok(res, { options: [] });
    }
  });

  return router;
}

module.exports = { createLocationsRouter };
