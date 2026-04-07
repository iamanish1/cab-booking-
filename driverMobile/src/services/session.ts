import AsyncStorage from "@react-native-async-storage/async-storage";

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

export interface DriverSession {
  accessToken: string;
  refreshToken: string;
  driverId: string;
  driver: DriverProfile;
}

const KEYS = {
  ACCESS_TOKEN: "driver:accessToken",
  REFRESH_TOKEN: "driver:refreshToken",
  DRIVER_ID: "driver:driverId",
  DRIVER: "driver:profile",
};

let cachedSession: DriverSession | null = null;

export function getSession(): DriverSession | null {
  return cachedSession;
}

export async function loadSession(): Promise<DriverSession | null> {
  const [accessToken, refreshToken, driverId, driverRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.ACCESS_TOKEN),
    AsyncStorage.getItem(KEYS.REFRESH_TOKEN),
    AsyncStorage.getItem(KEYS.DRIVER_ID),
    AsyncStorage.getItem(KEYS.DRIVER),
  ]);

  if (!accessToken || !refreshToken || !driverId || !driverRaw) {
    cachedSession = null;
    return null;
  }

  cachedSession = {
    accessToken,
    refreshToken,
    driverId,
    driver: JSON.parse(driverRaw),
  };

  return cachedSession;
}

export async function saveSession(session: DriverSession): Promise<void> {
  cachedSession = session;
  await Promise.all([
    AsyncStorage.setItem(KEYS.ACCESS_TOKEN, session.accessToken),
    AsyncStorage.setItem(KEYS.REFRESH_TOKEN, session.refreshToken),
    AsyncStorage.setItem(KEYS.DRIVER_ID, session.driverId),
    AsyncStorage.setItem(KEYS.DRIVER, JSON.stringify(session.driver)),
  ]);
}

export async function clearSession(): Promise<void> {
  cachedSession = null;
  await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
}
