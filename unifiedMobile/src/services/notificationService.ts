import * as Notifications from "expo-notifications";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { apiRequest } from "./api";
import { getSession } from "./session";

// Push token APIs were removed from Expo Go in SDK 53; only available in dev/production builds.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerPushToken(): Promise<void> {
  if (isExpoGo) return;
  try {
    const perms = await Notifications.getPermissionsAsync();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let granted = (perms as any).granted ?? (perms as any).status === "granted";
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      granted = (requested as any).granted ?? (requested as any).status === "granted";
    }
    if (!granted) return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    const session = getSession();
    if (!session || !token) return;

    if (session.role === "customer") {
      await apiRequest("/customers/me/push-token", { method: "POST", body: { token } });
    } else {
      await apiRequest(`/drivers/${session.userId}/push-token`, { method: "POST", body: { token } });
    }
  } catch {
    // Non-critical — silently swallow
  }
}

export function addNotificationListener(
  onReceived: (notification: Notifications.Notification) => void
): () => void {
  if (isExpoGo) return () => {};
  const sub = Notifications.addNotificationReceivedListener(onReceived);
  return () => sub.remove();
}

export function addNotificationResponseListener(
  onResponse: (response: Notifications.NotificationResponse) => void
): () => void {
  if (isExpoGo) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(onResponse);
  return () => sub.remove();
}
