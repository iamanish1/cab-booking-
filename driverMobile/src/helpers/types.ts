export type ScreenState = "AUTH" | "HOME" | "ACTIVE_RIDE";

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

export interface ActiveRide {
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
  otpCode?: string;
  customer?: { id: string; name: string; mobile: string };
}
