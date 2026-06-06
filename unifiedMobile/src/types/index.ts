export type UserRole = "customer" | "driver";

// ─── Session ──────────────────────────────────────────────────────────────────
export interface UnifiedSession {
  role: UserRole;
  accessToken: string;
  refreshToken: string;
  userId: string;
  profile: CustomerProfile | DriverProfile;
}

// ─── Customer ─────────────────────────────────────────────────────────────────
export interface CustomerProfile {
  _id: string;
  fullName: string;
  mobile: string;
  city: string;
  defaultArea: string;
}

export interface NormalizedCustomer {
  id: string;
  fullName: string;
  mobile: string;
  city: string;
  defaultArea: string;
  balance: number;
}

export interface WalletSummary {
  balance: number;
  cashbackProgress: {
    completedTrips: number;
    targetTrips: number;
    remainingTrips: number;
  };
  recentTransactions?: WalletTransaction[];
}

export interface WalletTransaction {
  _id: string;
  type: string;
  direction: "credit" | "debit";
  amount: number;
  title: string;
  createdAt: string;
}

// ─── Driver ───────────────────────────────────────────────────────────────────
export interface DriverProfile {
  _id: string;
  fullName: string;
  mobile: string;
  city: string;
  vehicleNumber: string;
  vehicleCapacity: number;
  rating: number;
  currentStatus: string;
}

// ─── Ride / Location ─────────────────────────────────────────────────────────
export interface LocationPoint {
  label: string;
  address: string;
  coordinates: { lat: number; lng: number };
}

export interface RideOffer {
  rideId: string;
  pickup: { label: string; address: string; lat: number; lng: number };
  drop: { label: string; address: string; lat: number; lng: number };
  fare: number;
  distanceKm: number;
  rideType: string;
  passengerCount: number;
  paymentMethod: string;
}

export interface ActiveDriverRide {
  _id: string;
  status: string;
  pickup: { label: string; address: string; lat: number; lng: number };
  drop: { label: string; address: string; lat: number; lng: number };
  quotedFare: number;
  finalFare?: number;
  distanceKm: number;
  rideType: string;
  passengerCount: number;
  paymentMethod: string;
  customer?: { id: string; name: string; mobile: string };
}

export interface NormalizedRide {
  id: string;
  status: string;
  pickup: LocationPoint | null;
  drop: LocationPoint | null;
  paymentMethod: string;
  fare: number;
  rideType: string;
  etaMinutes?: number;
  otpCode?: string;
  driver?: {
    id: string;
    name: string;
    mobile: string;
    rating: number;
    vehicleNumber: string;
    vehicleCapacity: number;
  } | null;
}

export interface FareEstimate {
  quoteId: string;
  rideType: string;
  distanceKm: number;
  etaMinutes: number;
  fareBreakdown: { baseFare: number; distanceComponent: number; surge: number };
  fareEstimate: number;
}

// ─── Navigation screens ───────────────────────────────────────────────────────
export type CustomerScreen =
  | { NAME: "HOME"; DATA: {} }
  | { NAME: "BOOK-RIDE"; DATA: { pickupLocation: LocationPoint; destinationLocation: LocationPoint; rideType: string } }
  | { NAME: "RIDE"; DATA: { rideId: string } }
  | { NAME: "WALLET"; DATA: {} }
  | { NAME: "PROFILE"; DATA: {} };
