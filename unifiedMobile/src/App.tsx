import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StatusBar, View } from "react-native";
import { clearSession, getSession, loadSession } from "./services/session";
import { registerPushToken } from "./services/notificationService";
import { getAppBootstrap, getCurrentRide, getWalletSummary, logoutCustomer } from "./services/customerApi";
import { getActiveRide, logoutDriver } from "./services/driverApi";
import { connectDriverSocket, disconnectDriverSocket } from "./services/driverSocket";
import { normalizeCustomer, normalizeRide } from "./utils/location";

import RoleSelectScreen from "./screens/shared/RoleSelectScreen";
import OtpAuthScreen from "./screens/shared/OtpAuthScreen";
import BottomBar from "./components/BottomBar";

import CustomerHomeScreen from "./screens/customer/HomeScreen";
import BookRideScreen from "./screens/customer/BookRideScreen";
import CustomerMapRideScreen from "./screens/customer/MapRideScreen";
import CustomerProfileScreen from "./screens/customer/ProfileScreen";
import CustomerWalletScreen from "./screens/customer/WalletScreen";

import DriverHomeScreen from "./screens/driver/HomeScreen";
import DriverRideScreen from "./screens/driver/RideScreen";
import DriverEarningsScreen from "./screens/driver/EarningsScreen";

import type {
  UserRole,
  NormalizedCustomer,
  WalletSummary,
  NormalizedRide,
  DriverProfile,
  ActiveDriverRide,
  CustomerScreen,
} from "./types";

type AppStage =
  | { stage: "LOADING" }
  | { stage: "ROLE_SELECT" }
  | { stage: "OTP_AUTH"; role: UserRole }
  | { stage: "CUSTOMER" }
  | { stage: "DRIVER" };

export default function App() {
  const [appStage, setAppStage] = useState<AppStage>({ stage: "LOADING" });

  // ─── Customer state ────────────────────────────────────────────────────────
  const [customer, setCustomer] = useState<NormalizedCustomer | null>(null);
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [popularLocations, setPopularLocations] = useState<string[]>([]);
  const [activeRide, setActiveRide] = useState<NormalizedRide | null>(null);
  const [customerScreen, setCustomerScreen] = useState<CustomerScreen>({ NAME: "HOME", DATA: {} });

  // ─── Driver state ──────────────────────────────────────────────────────────
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [activeDriverRide, setActiveDriverRide] = useState<ActiveDriverRide | null>(null);
  const [driverScreen, setDriverScreen] = useState<"HOME" | "ACTIVE_RIDE" | "EARNINGS">("HOME");

  // ─── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => { boot(); }, []);

  const boot = async () => {
    try {
      const session = await loadSession();
      if (!session) { setAppStage({ stage: "ROLE_SELECT" }); return; }

      if (session.role === "customer") {
        await bootstrapCustomer();
        setAppStage({ stage: "CUSTOMER" });
      } else {
        await bootstrapDriver();
        setAppStage({ stage: "DRIVER" });
      }
    } catch {
      await clearSession();
      setAppStage({ stage: "ROLE_SELECT" });
    }
  };

  const bootstrapCustomer = async () => {
    const bootstrap = await getAppBootstrap();
    const normalizedUser = normalizeCustomer(bootstrap.profile, bootstrap.wallet);
    const normalizedRide = normalizeRide(bootstrap.activeRide);

    setCustomer(normalizedUser);
    setWalletSummary(bootstrap.wallet);
    setPopularLocations(bootstrap.homeMetadata?.popularLocations || []);
    setActiveRide(normalizedRide);

    if (normalizedRide) {
      setCustomerScreen({ NAME: "RIDE", DATA: { rideId: normalizedRide.id } });
    }

    registerPushToken().catch(() => {});
  };

  const bootstrapDriver = async () => {
    const session = getSession();
    if (!session) return;
    setDriver(session.profile as DriverProfile);
    connectDriverSocket(session.userId);
    try {
      const ride = await getActiveRide(session.userId);
      if (ride) { setActiveDriverRide(ride); setDriverScreen("ACTIVE_RIDE"); }
    } catch { /* no active ride */ }

    registerPushToken().catch(() => {});
  };

  // ─── Auth handlers ─────────────────────────────────────────────────────────
  const handleAuthenticated = async () => {
    const session = getSession();
    if (!session) { setAppStage({ stage: "ROLE_SELECT" }); return; }
    try {
      if (session.role === "customer") {
        await bootstrapCustomer();
        setAppStage({ stage: "CUSTOMER" });
      } else {
        await bootstrapDriver();
        setAppStage({ stage: "DRIVER" });
      }
    } catch (err: any) {
      Alert.alert("Sign in failed", err.message);
      await clearSession();
      setAppStage({ stage: "ROLE_SELECT" });
    }
  };

  // ─── Customer handlers ─────────────────────────────────────────────────────
  const refreshWallet = async () => {
    try {
      const wallet = await getWalletSummary();
      setWalletSummary(wallet);
      setCustomer((prev) => prev ? { ...prev, balance: wallet.balance } : prev);
    } catch { /* silent */ }
  };

  const refreshCurrentRide = async () => {
    try {
      const ride = await getCurrentRide();
      const norm = normalizeRide(ride);
      setActiveRide(norm);
      return norm;
    } catch { return null; }
  };

  const handleRideCreated = async (rideId: string) => {
    const ride = await refreshCurrentRide();
    setCustomerScreen({ NAME: "RIDE", DATA: { rideId: ride?.id || rideId } });
  };

  const handleRideCompleted = async () => {
    await Promise.all([refreshWallet(), bootstrapCustomer()]);
    setCustomerScreen({ NAME: "HOME", DATA: {} });
  };

  const handleCustomerLogout = async () => {
    await logoutCustomer();
    await clearSession();
    resetCustomerState();
    setAppStage({ stage: "ROLE_SELECT" });
  };

  const resetCustomerState = () => {
    setCustomer(null); setWalletSummary(null);
    setActiveRide(null); setCustomerScreen({ NAME: "HOME", DATA: {} });
  };

  // ─── Driver handlers ───────────────────────────────────────────────────────
  const handleDriverLogout = async () => {
    const session = getSession();
    if (session) disconnectDriverSocket(session.userId);
    await logoutDriver();
    await clearSession();
    setDriver(null); setActiveDriverRide(null); setDriverScreen("HOME");
    setAppStage({ stage: "ROLE_SELECT" });
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (appStage.stage === "LOADING") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (appStage.stage === "ROLE_SELECT") {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <RoleSelectScreen onSelectRole={(role) => setAppStage({ stage: "OTP_AUTH", role })} />
      </>
    );
  }

  if (appStage.stage === "OTP_AUTH") {
    return (
      <>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <OtpAuthScreen
          role={appStage.role}
          onBack={() => setAppStage({ stage: "ROLE_SELECT" })}
          onAuthenticated={handleAuthenticated}
        />
      </>
    );
  }

  // ─── DRIVER FLOW ───────────────────────────────────────────────────────────
  if (appStage.stage === "DRIVER") {
    if (driverScreen === "ACTIVE_RIDE" && activeDriverRide) {
      return (
        <>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <DriverRideScreen
            ride={activeDriverRide}
            driver={driver!}
            onRideDone={() => { setActiveDriverRide(null); setDriverScreen("HOME"); }}
          />
        </>
      );
    }

    if (driverScreen === "EARNINGS") {
      return (
        <>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />
          <DriverEarningsScreen onBack={() => setDriverScreen("HOME")} />
        </>
      );
    }

    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <DriverHomeScreen
          driver={driver!}
          onRideAccepted={(ride) => { setActiveDriverRide(ride); setDriverScreen("ACTIVE_RIDE"); }}
          onEarnings={() => setDriverScreen("EARNINGS")}
          onLogout={handleDriverLogout}
        />
      </>
    );
  }

  // ─── CUSTOMER FLOW ─────────────────────────────────────────────────────────
  const renderCustomerScreen = () => {
    switch (customerScreen.NAME) {
      case "HOME":
        return (
          <CustomerHomeScreen
            userData={customer!}
            popularLocations={popularLocations}
            setScreen={setCustomerScreen}
          />
        );

      case "BOOK-RIDE":
        return (
          <BookRideScreen
            userData={customer!}
            data={customerScreen.DATA}
            setScreen={setCustomerScreen}
            onRideCreated={handleRideCreated}
          />
        );

      case "RIDE":
        return (
          <CustomerMapRideScreen
            setScreen={setCustomerScreen}
            rideId={customerScreen.DATA.rideId || activeRide?.id || ""}
            ride={activeRide}
            customerId={customer?.id || ""}
            onRideUpdated={(raw) => setActiveRide(normalizeRide(raw))}
            onRideCompleted={handleRideCompleted}
            onWalletUpdated={(w) => setWalletSummary(w)}
          />
        );

      case "WALLET":
        return (
          <CustomerWalletScreen
            walletSummary={walletSummary}
            onWalletUpdated={(w) => setWalletSummary(w)}
          />
        );

      case "PROFILE":
        return (
          <CustomerProfileScreen
            userData={customer!}
            walletSummary={walletSummary}
            onUserUpdated={(fn) => setCustomer((prev) => prev ? fn(prev) : prev)}
            onLogout={handleCustomerLogout}
          />
        );

      default:
        return null;
    }
  };

  const showBottomBar = customerScreen.NAME !== "RIDE";

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {renderCustomerScreen()}
      {showBottomBar && (
        <BottomBar screen={customerScreen} setScreen={setCustomerScreen} />
      )}
    </>
  );
}
