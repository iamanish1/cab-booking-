import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { loadSession, clearSession, getSession } from "./services/session";
import { getActiveRide } from "./services/driverApi";
import { connectDriverSocket, disconnectDriverSocket } from "./services/driverSocket";
import AuthScreen from "./screens/Auth";
import HomeScreen from "./screens/Home";
import RideScreen from "./screens/RideScreen";
import { DriverProfile, ScreenState, ActiveRide } from "./helpers/types";

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [screen, setScreen] = useState<ScreenState>("HOME");
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      const session = await loadSession();
      if (!session) {
        setIsLoggedIn(false);
        return;
      }

      setDriver(session.driver);

      // Connect socket
      connectDriverSocket(session.driverId);

      // Check for active ride
      try {
        const ride = await getActiveRide(session.driverId);
        if (ride) {
          setActiveRide(ride);
          setScreen("ACTIVE_RIDE");
        }
      } catch {
        // no active ride is fine
      }

      setIsLoggedIn(true);
    } catch {
      await clearSession();
      setIsLoggedIn(false);
    } finally {
      setBootstrapping(false);
    }
  };

  const handleAuthenticated = async (driverProfile: DriverProfile) => {
    setDriver(driverProfile);
    const session = getSession();
    if (session) connectDriverSocket(session.driverId);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    const session = getSession();
    if (session) disconnectDriverSocket(session.driverId);
    await clearSession();
    setDriver(null);
    setActiveRide(null);
    setScreen("HOME");
    setIsLoggedIn(false);
  };

  const handleRideAccepted = (ride: ActiveRide) => {
    setActiveRide(ride);
    setScreen("ACTIVE_RIDE");
  };

  const handleRideDone = () => {
    setActiveRide(null);
    setScreen("HOME");
  };

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  if (screen === "ACTIVE_RIDE" && activeRide) {
    return (
      <RideScreen
        ride={activeRide}
        driver={driver!}
        onRideDone={handleRideDone}
      />
    );
  }

  return (
    <HomeScreen
      driver={driver!}
      onRideAccepted={handleRideAccepted}
      onLogout={handleLogout}
    />
  );
}
