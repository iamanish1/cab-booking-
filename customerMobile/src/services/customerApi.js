import { apiRequest, setAuthenticatedSession } from "./api";

export async function requestOtp(mobile) {
  return apiRequest(
    "/auth/request-otp",
    {
      method: "POST",
      body: { mobile, role: "customer" },
    },
    { auth: false }
  );
}

export async function verifyOtp({ requestId, mobile, otp, profile }) {
  const data = await apiRequest(
    "/auth/verify-otp",
    {
      method: "POST",
      body: { requestId, mobile, otp, profile },
    },
    { auth: false }
  );

  await setAuthenticatedSession(data);
  return data;
}

export async function logout(refreshToken) {
  try {
    if (refreshToken) {
      await apiRequest(
        "/auth/logout",
        {
          method: "POST",
          body: { refreshToken },
        },
        { auth: false }
      );
    }
  } catch {
    return null;
  }
  return null;
}

export function getAppBootstrap() {
  return apiRequest("/customers/me/app-bootstrap");
}

export function updateProfile(payload) {
  return apiRequest("/customers/me", {
    method: "PATCH",
    body: payload,
  });
}

export function fetchPopularLocations(city) {
  const query = city ? `?city=${encodeURIComponent(city)}` : "";
  return apiRequest(`/locations/popular${query}`, {}, { auth: false });
}

export function fetchRideOptions({ pickup, drop }) {
  const query = [
    `pickupLat=${encodeURIComponent(String(pickup.lat))}`,
    `pickupLng=${encodeURIComponent(String(pickup.lng))}`,
    `dropLat=${encodeURIComponent(String(drop.lat))}`,
    `dropLng=${encodeURIComponent(String(drop.lng))}`,
  ].join("&");

  return apiRequest(`/ride-options?${query}`, {}, { auth: false });
}

export function estimateRide(payload) {
  return apiRequest("/rides/estimate", {
    method: "POST",
    body: payload,
  });
}

export function createRide(payload) {
  return apiRequest("/rides", {
    method: "POST",
    body: payload,
  });
}

export function getCurrentRide() {
  return apiRequest("/rides/active/current");
}

export function getRide(rideId) {
  return apiRequest(`/rides/${rideId}`);
}

export function cancelRide(rideId, reason) {
  return apiRequest(`/rides/${rideId}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

export function getWalletSummary() {
  return apiRequest("/wallet");
}

export function getWalletTransactions(limit = 20) {
  return apiRequest(`/wallet/transactions?limit=${limit}`);
}

export function getTrips(limit = 20) {
  return apiRequest(`/trips/history?limit=${limit}`);
}
