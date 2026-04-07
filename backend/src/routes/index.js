const express = require("express");
const { ok } = require("../lib/http");
const { RIDE_TYPE } = require("../config/constants");
const { buildEstimate } = require("../services/ride.service");
const { createAuthRouter } = require("./auth.routes");
const { createCustomersRouter } = require("./customers.routes");
const { createDispatchRouter } = require("./dispatch.routes");
const { createDriversRouter } = require("./drivers.routes");
const { createLocationsRouter } = require("./locations.routes");
const { createPaymentsRouter } = require("./payments.routes");
const { createRidesRouter } = require("./rides.routes");
const { createTripsRouter } = require("./trips.routes");
const { createWalletRouter } = require("./wallet.routes");

function createApiRouter(dependencies) {
  const router = express.Router();

  router.use("/auth", createAuthRouter(dependencies));
  router.use("/customers", createCustomersRouter(dependencies));
  router.use("/dispatch", createDispatchRouter(dependencies));
  router.use("/locations", createLocationsRouter(dependencies));
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
  router.use("/rides", createRidesRouter(dependencies));
  router.use("/trips", createTripsRouter(dependencies));
  router.use("/wallet", createWalletRouter(dependencies));
  router.use("/payments", createPaymentsRouter(dependencies));
  router.use("/drivers", createDriversRouter(dependencies));

  return router;
}

module.exports = { createApiRouter };
