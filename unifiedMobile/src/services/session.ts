import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UnifiedSession } from "../types";

const SESSION_KEY = "jammucab:session";

let cache: UnifiedSession | null = null;

export function getSession(): UnifiedSession | null {
  return cache;
}

export async function loadSession(): Promise<UnifiedSession | null> {
  if (cache) return cache;
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  cache = raw ? (JSON.parse(raw) as UnifiedSession) : null;
  return cache;
}

export async function saveSession(session: UnifiedSession): Promise<void> {
  cache = session;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  cache = null;
  await AsyncStorage.removeItem(SESSION_KEY);
}
