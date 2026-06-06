import type { NormalizedCustomer, NormalizedRide, LocationPoint } from "../types";

const CITY_CENTER = { lat: 32.7266, lng: 74.8570 };

const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  "Railway Station": { lat: 32.7185, lng: 74.8527 },
  "Bus Stand": { lat: 32.7171, lng: 74.8550 },
  "Airport": { lat: 32.6890, lng: 74.8374 },
  "Satwari Airport": { lat: 32.6890, lng: 74.8374 },
  "Raghunath Market": { lat: 32.7275, lng: 74.8541 },
  "Gandhi Nagar": { lat: 32.7141, lng: 74.8482 },
  "Bakshi Nagar": { lat: 32.7317, lng: 74.8609 },
  "Canal Road": { lat: 32.7106, lng: 74.8657 },
  "Parade Ground": { lat: 32.7308, lng: 74.8597 },
  "GMC Hospital": { lat: 32.7302, lng: 74.8480 },
  "Trikuta Nagar": { lat: 32.7411, lng: 74.8327 },
  "Residency Road": { lat: 32.7260, lng: 74.8550 },
  "Pacca Danga": { lat: 32.7350, lng: 74.8710 },
  "Nagrota": { lat: 32.6764, lng: 74.9050 },
  "Kunjwani": { lat: 32.7056, lng: 74.9065 },
  "Channi Himmat": { lat: 32.6978, lng: 74.8640 },
  "Janipur": { lat: 32.7504, lng: 74.8419 },
  "Sarwal": { lat: 32.7443, lng: 74.8598 },
  "Talab Tillo": { lat: 32.7199, lng: 74.8746 },
  "Home": { lat: 32.7266, lng: 74.8570 },
};

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function resolveLocation(label: string, _city = "Jammu"): LocationPoint {
  const clean = (label || "").trim();
  const known = KNOWN_LOCATIONS[clean];

  if (known) {
    return { label: clean, address: clean, coordinates: known };
  }

  const seed = hashText(clean || "Jammu");
  const latOffset = ((seed % 50) - 25) * 0.0015;
  const lngOffset = (((Math.floor(seed / 50) % 50) - 25) * 0.0015);

  return {
    label: clean || "Jammu",
    address: clean || "Jammu",
    coordinates: {
      lat: Number((CITY_CENTER.lat + latOffset).toFixed(6)),
      lng: Number((CITY_CENTER.lng + lngOffset).toFixed(6)),
    },
  };
}

export function formatCurrency(amount?: number | null): string {
  return `₹${Math.abs(Number(amount || 0)).toFixed(0)}`;
}

export function formatRelativeDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const diffDays = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

export function normalizeCustomer(profile: any, walletSummary?: any): NormalizedCustomer | null {
  if (!profile) return null;
  return {
    id: profile._id,
    fullName: profile.fullName,
    mobile: profile.mobile,
    city: profile.city,
    defaultArea: profile.defaultArea,
    balance: walletSummary?.balance || 0,
  };
}

export function normalizeRide(ride: any): NormalizedRide | null {
  if (!ride) return null;

  const driver = ride.driverId
    ? {
        id: ride.driverId._id,
        name: ride.driverId.fullName,
        mobile: ride.driverId.mobile,
        rating: ride.driverId.rating,
        vehicleNumber: ride.driverId.vehicleNumber,
        vehicleCapacity: ride.driverId.vehicleCapacity,
      }
    : null;

  const pickup: LocationPoint | null = ride.pickup
    ? { label: ride.pickup.label, address: ride.pickup.address, coordinates: { lat: ride.pickup.lat, lng: ride.pickup.lng } }
    : null;

  const drop: LocationPoint | null = ride.drop
    ? { label: ride.drop.label, address: ride.drop.address, coordinates: { lat: ride.drop.lat, lng: ride.drop.lng } }
    : null;

  return {
    id: ride._id,
    status: ride.status,
    pickup,
    drop,
    paymentMethod: ride.paymentMethod,
    fare: ride.finalFare ?? ride.quotedFare ?? ride.fareEstimate ?? 0,
    rideType: ride.rideType,
    etaMinutes: ride.etaMinutes,
    otpCode: ride.otpCode,
    driver,
  };
}
