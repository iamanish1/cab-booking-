import { apiRequest, API_BASE_URL } from "./api";
import { saveSession, getSession, DriverProfile } from "./session";

export async function requestOtp(mobile: string): Promise<{ requestId: string; otpPreview?: string }> {
  return apiRequest("/auth/request-otp", {
    method: "POST",
    body: { mobile, role: "driver" },
  }, { auth: false });
}

export async function verifyOtp(payload: {
  requestId: string;
  mobile: string;
  otp: string;
  profile?: {
    role: "driver";
    fullName?: string;
    city?: string;
    vehicleNumber?: string;
    vehicleCapacity?: string;
  };
}): Promise<{ accessToken: string; refreshToken: string; driver: DriverProfile }> {
  const data = await apiRequest("/auth/verify-otp", {
    method: "POST",
    body: payload,
  }, { auth: false });

  const session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    driverId: data.driver._id,
    driver: data.driver,
  };

  await saveSession(session);
  return data;
}

export async function logoutDriver(refreshToken: string): Promise<void> {
  try {
    await apiRequest("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    }, { auth: false });
  } catch {
    // ignore errors on logout
  }
}

export function updateStatus(driverId: string, status: "ONLINE" | "OFFLINE" | "BUSY") {
  return apiRequest(`/drivers/${driverId}/status`, {
    method: "POST",
    body: { status },
  });
}

export function updateLocation(driverId: string, lat: number, lng: number) {
  return apiRequest(`/drivers/${driverId}/location`, {
    method: "POST",
    body: { lat, lng },
  });
}

export function getActiveRide(driverId: string) {
  return apiRequest(`/drivers/${driverId}/active-ride`);
}

export function arriveAtPickup(rideId: string) {
  return apiRequest(`/drivers/rides/${rideId}/arrive`, { method: "POST" });
}

export function verifyRideOtp(rideId: string, otp: string) {
  return apiRequest(`/drivers/rides/${rideId}/verify-otp`, {
    method: "POST",
    body: { otp },
  });
}

export function completeRide(rideId: string, finalFare: number) {
  return apiRequest(`/drivers/rides/${rideId}/complete`, {
    method: "POST",
    body: { finalFare },
  });
}

export function cancelRide(rideId: string, reason: string) {
  return apiRequest(`/drivers/rides/${rideId}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

export function acceptRideOffer(rideId: string, driverId: string) {
  return apiRequest(`/dispatch/${rideId}/accept`, {
    method: "POST",
    body: { driverId },
  }, { auth: false });
}

export function rejectRideOffer(rideId: string, driverId: string) {
  return apiRequest(`/dispatch/${rideId}/reject`, {
    method: "POST",
    body: { driverId },
  }, { auth: false });
}
