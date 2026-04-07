const CITY_CENTERS = {
  Delhi: { lat: 28.6139, lng: 77.209 },
  Noida: { lat: 28.5706, lng: 77.3272 },
};

const KNOWN_LOCATIONS = {
  "Connaught Place": { lat: 28.6315, lng: 77.2167 },
  Dwarka: { lat: 28.5921, lng: 77.046 },
  Rohini: { lat: 28.7495, lng: 77.0565 },
  "Karol Bagh": { lat: 28.6519, lng: 77.1909 },
  Saket: { lat: 28.5245, lng: 77.2066 },
  "IGI Airport": { lat: 28.5562, lng: 77.1 },
  Airport: { lat: 28.5562, lng: 77.1 },
  "Railway Station": { lat: 28.6434, lng: 77.2197 },
  "Bus Stand": { lat: 28.6673, lng: 77.2271 },
  Mall: { lat: 28.5281, lng: 77.2197 },
  Hospital: { lat: 28.5672, lng: 77.21 },
  Home: { lat: 28.6139, lng: 77.209 },
  Work: { lat: 28.5355, lng: 77.391 },
  "Sector 18": { lat: 28.5708, lng: 77.326 },
  "Sector 62": { lat: 28.6289, lng: 77.3649 },
  "Botanical Garden": { lat: 28.5642, lng: 77.3343 },
  "Film City": { lat: 28.5946, lng: 77.3356 },
  "Selected from Map": { lat: 28.6139, lng: 77.209 },
};

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function resolveLocation(label, city = "Delhi") {
  const cleanLabel = (label || "").trim();
  const center = CITY_CENTERS[city] || CITY_CENTERS.Delhi;
  const knownCoordinates = KNOWN_LOCATIONS[cleanLabel];

  if (knownCoordinates) {
    return {
      label: cleanLabel,
      address: cleanLabel,
      coordinates: knownCoordinates,
    };
  }

  const seed = hashText(cleanLabel || city);
  const latOffset = ((seed % 50) - 25) * 0.0015;
  const lngOffset = (((Math.floor(seed / 50) % 50) - 25) * 0.0015);

  return {
    label: cleanLabel || city,
    address: cleanLabel || city,
    coordinates: {
      lat: Number((center.lat + latOffset).toFixed(6)),
      lng: Number((center.lng + lngOffset).toFixed(6)),
    },
  };
}

export function formatCurrency(amount) {
  return `Rs ${Math.abs(Number(amount || 0)).toFixed(0)}`;
}

export function formatRelativeDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (isNaN(date.getTime())) return "";

  const diffDays = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

export function normalizeCustomer(profile, walletSummary) {
  if (!profile) return null;

  return {
    id: profile._id,
    mobileNumber: profile.mobile,
    fullName: profile.fullName,
    city: profile.city,
    defaultArea: profile.defaultArea,
    balance: walletSummary?.balance || 0,
  };
}

export function normalizeRide(ride) {
  if (!ride) return null;

  const driver = ride.driverId
    ? {
        id: ride.driverId._id,
        name: ride.driverId.fullName,
        mobileNumber: ride.driverId.mobile,
        rating: ride.driverId.rating,
        vehicleNumber: ride.driverId.vehicleNumber,
        vehicleCapacity: ride.driverId.vehicleCapacity,
      }
    : null;

  // Normalize pickup/drop to include both label and coordinates
  const pickup = ride.pickup
    ? {
        label: ride.pickup.label,
        address: ride.pickup.address,
        coordinates: { lat: ride.pickup.lat, lng: ride.pickup.lng },
      }
    : null;
  const drop = ride.drop
    ? {
        label: ride.drop.label,
        address: ride.drop.address,
        coordinates: { lat: ride.drop.lat, lng: ride.drop.lng },
      }
    : null;

  return {
    id: ride._id,
    status: ride.status,
    statusVersion: ride.statusVersion,
    pickup,
    drop,
    paymentMethod: ride.paymentMethod,
    fare: ride.finalFare || ride.quotedFare || ride.fareEstimate,
    rideType: ride.rideType,
    etaMinutes: ride.etaMinutes,
    otpCode: ride.otpCode,
    driver,
  };
}
