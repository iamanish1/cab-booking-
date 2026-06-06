import { apiRequest } from "./api";
import { saveSession, getSession } from "./session";
import type { UnifiedSession, CustomerProfile, WalletSummary } from "../types";

export async function requestOtp(mobile: string) {
  return apiRequest("/auth/request-otp", {
    method: "POST",
    body: { mobile, role: "customer" },
  }, { auth: false });
}

export async function verifyOtp(payload: {
  requestId: string;
  mobile: string;
  otp: string;
  profile: { fullName: string; city: string; defaultArea: string };
}) {
  const data = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: { ...payload, profile: { role: "customer", ...payload.profile } },
  }, { auth: false });

  const session: UnifiedSession = {
    role: "customer",
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.customer._id,
    profile: data.customer as CustomerProfile,
  };
  await saveSession(session);
  return data;
}

export async function logoutCustomer() {
  const session = getSession();
  if (!session) return;
  try {
    await apiRequest("/auth/logout", {
      method: "POST",
      body: { refreshToken: session.refreshToken },
    }, { auth: false });
  } catch { /* ignore */ }
}

export function getAppBootstrap() {
  return apiRequest("/customers/me/app-bootstrap");
}

export function updateProfile(payload: Partial<{ fullName: string; defaultArea: string }>) {
  return apiRequest("/customers/me", { method: "PATCH", body: payload });
}

export function fetchPopularLocations(city: string) {
  return apiRequest(`/locations/popular?city=${encodeURIComponent(city)}`, {}, { auth: false });
}

export function fetchRideOptions(pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }) {
  const q = `pickupLat=${pickup.lat}&pickupLng=${pickup.lng}&dropLat=${drop.lat}&dropLng=${drop.lng}`;
  return apiRequest(`/ride-options?${q}`, {}, { auth: false });
}

export function estimateRide(payload: {
  pickup: { label: string; address: string; coordinates: { lat: number; lng: number } };
  drop: { label: string; address: string; coordinates: { lat: number; lng: number } };
  rideType: string;
  passengerCount: number;
}) {
  return apiRequest("/rides/estimate", { method: "POST", body: payload });
}

export function createRide(payload: {
  city: string;
  rideType: string;
  pickup: { label: string; address: string; coordinates: { lat: number; lng: number } };
  drop: { label: string; address: string; coordinates: { lat: number; lng: number } };
  paymentMethod: string;
  passengerCount: number;
}) {
  return apiRequest("/rides", { method: "POST", body: payload });
}

export function getCurrentRide() {
  return apiRequest("/rides/active/current");
}

export function getRide(rideId: string) {
  return apiRequest(`/rides/${rideId}`);
}

export function cancelRide(rideId: string, reason: string) {
  return apiRequest(`/rides/${rideId}/cancel`, { method: "POST", body: { reason } });
}

export function getWalletSummary(): Promise<WalletSummary> {
  return apiRequest("/wallet");
}

export function getWalletTransactions(limit = 20) {
  return apiRequest(`/wallet/transactions?limit=${limit}`);
}

export function getTrips(limit = 20) {
  return apiRequest(`/trips/history?limit=${limit}`);
}

export function rateRide(rideId: string, rating: number) {
  return apiRequest(`/rides/${rideId}/rate`, { method: "POST", body: { rating } });
}

export function createPaymentOrder(amount: number) {
  return apiRequest("/payments/razorpay/order", { method: "POST", body: { amount } });
}

export function verifyPayment(payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  return apiRequest("/payments/razorpay/verify", { method: "POST", body: payload });
}
