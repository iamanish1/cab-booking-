import { NativeModules, Platform } from "react-native";
import { clearSession, getSession, saveSession } from "./session";
import type { UnifiedSession } from "../types";

function getDevServerHost(): string | null {
  const scriptURL = (NativeModules as any)?.SourceCode?.scriptURL;
  if (!scriptURL || typeof scriptURL !== "string") return null;
  const match = scriptURL.match(/^https?:\/\/([^/:]+)(?::\d+)?\//);
  return match?.[1] || null;
}

function resolveApiBaseUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
  if (configured) {
    const base = configured.replace(/\/+$/, "");
    return base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  }
  const devHost = getDevServerHost();
  if (devHost && devHost !== "localhost" && devHost !== "127.0.0.1") {
    return `http://${devHost}:4000/api/v1`;
  }
  return Platform.OS === "android"
    ? "http://10.0.2.2:4000/api/v1"
    : "http://localhost:4000/api/v1";
}

export const API_BASE_URL = resolveApiBaseUrl();
export const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/v1$/, "");

let refreshPromise: Promise<UnifiedSession> | null = null;

async function parseResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

async function doRefresh(): Promise<UnifiedSession> {
  const session = getSession();
  if (!session?.refreshToken) throw new Error("Please sign in again");

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  const payload = await parseResponse(response);
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error?.message || "Session expired");
  }

  const next: UnifiedSession = {
    ...session,
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken,
  };
  await saveSession(next);
  return next;
}

async function refreshOnce(): Promise<UnifiedSession> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
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
      `Cannot reach the server. Make sure your phone and the server are on the same network and backend is running on port 4000.`
    );
  }

  const payload = await parseResponse(response);

  if (response.status === 401 && auth && retry && session?.refreshToken) {
    try {
      await refreshOnce();
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
