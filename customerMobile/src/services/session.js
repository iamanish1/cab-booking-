import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "customer_session";

let sessionCache = null;

export async function loadSession() {
  if (sessionCache) {
    return sessionCache;
  }

  const raw = await AsyncStorage.getItem(SESSION_KEY);
  sessionCache = raw ? JSON.parse(raw) : null;
  return sessionCache;
}

export function getSession() {
  return sessionCache;
}

export async function saveSession(session) {
  sessionCache = session;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  sessionCache = null;
  await AsyncStorage.removeItem(SESSION_KEY);
}
