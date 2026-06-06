const { POPULAR_LOCATIONS, RIDE_TYPE } = require("../config/constants");
const { Customer } = require("../models/customer.model");
const { getActiveRideForCustomer } = require("./ride.service");
const { getWalletSummary } = require("./wallet.service");

async function getAppBootstrap(customerId) {
  const [customer, activeRide, wallet] = await Promise.all([
    Customer.findById(customerId).lean(),
    getActiveRideForCustomer(customerId),
    getWalletSummary(customerId),
  ]);

  const city = customer?.city || "Jammu";

  return {
    profile: customer,
    wallet,
    activeRide,
    homeMetadata: {
      city,
      popularLocations: POPULAR_LOCATIONS[city] || POPULAR_LOCATIONS.Jammu,
      rideTypes: [
        {
          key: RIDE_TYPE.SHARED,
          label: "Shared Ride",
          maxCapacity: 2,
        },
        {
          key: RIDE_TYPE.PERSONAL,
          label: "Personal Ride",
          maxCapacity: 4,
        },
      ],
    },
  };
}

module.exports = { getAppBootstrap };
