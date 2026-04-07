import { NativeModules, Platform } from "react-native";
import { clearSession, getSession, saveSession, DriverSession } from "./session";

function getDevServerHost(): string | null {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL || typeof scriptURL !== "string") {
    return null;
  }

  const match = scriptURL.match(/^https?:\/\/([^/:]+)(?::\d+)?\//);
  return match?.[1] || null;
}

function resolveApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configuredUrl) {
    const normalizedUrl = configuredUrl.replace(/\/+$/, "");
    return normalizedUrl.endsWith("/api/v1")
      ? normalizedUrl
      : `${normalizedUrl}/api/v1`;
  }

  const devServerHost = getDevServerHost();
  if (devServerHost && devServerHost !== "localhost" && devServerHost !== "127.0.0.1") {
    return `http://${devServerHost}:4000/api/v1`;
  }

  return Platform.OS === "android"
    ? "http://10.0.2.2:4000/api/v1"
    : "http://localhost:4000/api/v1";
}

export const API_BASE_URL = resolveApiBaseUrl();

export const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/v1$/, "");

let refreshPromise: Promise<DriverSession> | null = null;

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function refreshSessionToken(refreshToken: string): Promise<DriverSession> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const payload = await parseResponse(response);
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error?.message || "Session expired");
  }

  const current = getSession();
  const next: DriverSession = {
    ...current!,
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken,
  };

  await saveSession(next);
  return next;
}

async function getValidSession(): Promise<DriverSession> {
  const session = getSession();
  if (!session?.refreshToken) throw new Error("Please sign in again");

  if (!refreshPromise) {
    refreshPromise = refreshSessionToken(session.refreshToken).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: any };

export async function apiRequest(
  path: string,
  options: ApiOptions = {},
  config: { auth?: boolean; retry?: boolean } = {}
): Promise<any> {
  const { auth = true, retry = true } = config;
  const session = getSession();

  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (auth && session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body:
        options.body && typeof options.body !== "string"
          ? JSON.stringify(options.body)
          : options.body,
    });
  } catch {
    throw new Error(
      `Unable to reach the backend at ${API_BASE_URL}. Make sure your laptop and phone are on the same Wi-Fi and the backend is running on port 4000.`
    );
  }

  const payload = await parseResponse(response);

  if (response.status === 401 && auth && retry && session?.refreshToken) {
    try {
      await getValidSession();
      return apiRequest(path, options, { ...config, retry: false });
    } catch {
      await clearSession();
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Request failed");
  }

  return payload.data;
}
