import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StatusBar, View } from "react-native";
import AuthScreen from "./src/screens/AuthScreen";
import HomeScreen from "./src/screens/HomeScreen";
import BottomBar from "./src/components/BottomBar";
import BookRide from "./src/screens/BookRide";
import ProfileScreen from "./src/screens/ProfileScreen";
import MapRideScreen from "./src/screens/MapRideScreen";
import Wallet from "./src/screens/Wallet";
import { clearSession, getSession, loadSession } from "./src/services/session";
import {
  getAppBootstrap,
  getCurrentRide,
  getWalletSummary,
  logout,
} from "./src/services/customerApi";
import { normalizeCustomer, normalizeRide } from "./src/utils/location";

const ACTIVE_SCREEN = {
  HOME: "HOME",
  BOOK_RIDE: "BOOK-RIDE",
  PROFILE: "PROFILE",
  RIDE: "RIDE",
  WALLET: "WALLET",
};

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [walletSummary, setWalletSummary] = useState(null);
  const [homeMetadata, setHomeMetadata] = useState({
    popularLocations: [],
    rideTypes: [],
    city: "Delhi",
  });
  const [activeRide, setActiveRide] = useState(null);
  const [screen, setScreen] = useState({
    NAME: ACTIVE_SCREEN.HOME,
    DATA: {},
  });

  const loadBootstrap = async () => {
    const bootstrap = await getAppBootstrap();
    const normalizedUser = normalizeCustomer(bootstrap.profile, bootstrap.wallet);
    const normalizedRide = normalizeRide(bootstrap.activeRide);

    setUser(normalizedUser);
    setWalletSummary(bootstrap.wallet);
    setHomeMetadata(bootstrap.homeMetadata);
    setActiveRide(normalizedRide);

    if (normalizedRide) {
      setScreen({
        NAME: ACTIVE_SCREEN.RIDE,
        DATA: { rideId: normalizedRide.id },
      });
    }
  };

  useEffect(() => {
    const bootstrapApp = async () => {
      try {
        const session = await loadSession();
        if (!session) {
          setIsLoggedIn(false);
          return;
        }

        await loadBootstrap();
        setIsLoggedIn(true);
      } catch (error) {
        await clearSession();
        setIsLoggedIn(false);
      } finally {
        setBootstrapping(false);
      }
    };

    bootstrapApp();
  }, []);

  const handleAuthenticated = async () => {
    try {
      await loadBootstrap();
      setIsLoggedIn(true);
    } catch (error) {
      Alert.alert("Sign in failed", error.message);
      await clearSession();
      setIsLoggedIn(false);
    }
  };

  const handleLogout = async () => {
    const session = getSession();
    await logout(session?.refreshToken);
    await clearSession();
    setIsLoggedIn(false);
    setUser(null);
    setWalletSummary(null);
    setActiveRide(null);
    setScreen({ NAME: ACTIVE_SCREEN.HOME, DATA: {} });
  };

  const refreshWallet = async () => {
    try {
      const wallet = await getWalletSummary();
      setWalletSummary(wallet);
      setUser((currentUser) =>
        currentUser ? { ...currentUser, balance: wallet.balance } : currentUser
      );
    } catch (error) {
      Alert.alert("Wallet refresh failed", error.message);
    }
  };

  const handleWalletUpdated = (wallet) => {
    setWalletSummary(wallet);
    setUser((currentUser) =>
      currentUser ? { ...currentUser, balance: wallet?.balance || 0 } : currentUser
    );
  };

  const refreshActiveRide = async () => {
    try {
      const ride = await getCurrentRide();
      const normalizedRide = normalizeRide(ride);
      setActiveRide(normalizedRide);
      return normalizedRide;
    } catch (error) {
      return null;
    }
  };

  const handleRideCreated = async (rideId) => {
    const ride = await refreshActiveRide();
    setScreen({
      NAME: ACTIVE_SCREEN.RIDE,
      DATA: { rideId: ride?.id || rideId },
    });
  };

  const handleRideUpdated = (ride) => {
    const normalizedRide = normalizeRide(ride);
    setActiveRide(normalizedRide);
  };

  const handleRideCompleted = async () => {
    await Promise.all([refreshWallet(), loadBootstrap()]);
    setScreen({ NAME: ACTIVE_SCREEN.HOME, DATA: {} });
  };

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const renderScreen = () => {
    switch (screen.NAME) {
      case ACTIVE_SCREEN.HOME:
        return (
          <HomeScreen
            userData={user}
            homeMetadata={homeMetadata}
            setScreen={setScreen}
          />
        );

      case ACTIVE_SCREEN.BOOK_RIDE:
        return (
          <BookRide
            userData={user}
            homeMetadata={homeMetadata}
            setScreen={setScreen}
            data={screen.DATA}
            onRideCreated={handleRideCreated}
          />
        );

      case ACTIVE_SCREEN.PROFILE:
        return (
          <ProfileScreen
            userData={user}
            walletSummary={walletSummary}
            onUserUpdated={setUser}
            onLogout={handleLogout}
          />
        );

      case ACTIVE_SCREEN.RIDE:
        return (
          <MapRideScreen
            setScreen={setScreen}
            rideId={screen.DATA.rideId || activeRide?.id}
            ride={activeRide}
            customerId={user?.id}
            onRideUpdated={handleRideUpdated}
            onRideCompleted={handleRideCompleted}
            onWalletUpdated={handleWalletUpdated}
          />
        );

      case ACTIVE_SCREEN.WALLET:
        return (
          <Wallet
            walletSummary={walletSummary}
            onWalletUpdated={handleWalletUpdated}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {renderScreen()}
      {screen.NAME === ACTIVE_SCREEN.RIDE ? null : (
        <BottomBar screen={screen} setScreen={setScreen} />
      )}
    </>
  );
}
