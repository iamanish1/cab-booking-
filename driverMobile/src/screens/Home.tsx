import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { acceptRideOffer, rejectRideOffer, updateLocation, updateStatus } from "../services/driverApi";
import { connectDriverSocket, onRideOffer } from "../services/driverSocket";
import { getSession } from "../services/session";
import { ActiveRide, DriverProfile, RideOffer } from "../helpers/types";

interface Props {
  driver: DriverProfile;
  onRideAccepted: (ride: ActiveRide) => void;
  onLogout: () => void;
}

const OFFER_TIMEOUT_SECS = 30;
const LOCATION_INTERVAL_MS = 10_000;

export default function HomeScreen({ driver, onRideAccepted, onLogout }: Props) {
  const [online, setOnline] = useState(driver.currentStatus === "ONLINE");
  const [statusLoading, setStatusLoading] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<RideOffer | null>(null);
  const [countdown, setCountdown] = useState(OFFER_TIMEOUT_SECS);
  const [accepting, setAccepting] = useState(false);

  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentOfferRef = useRef<RideOffer | null>(null);

  // Connect socket and listen for ride offers
  useEffect(() => {
    const session = getSession();
    if (!session) return;

    connectDriverSocket(session.driverId);

    const unsub = onRideOffer((offer: RideOffer) => {
      currentOfferRef.current = offer;
      setIncomingOffer(offer);
      startCountdown();
    });

    return () => {
      unsub();
      stopCountdown();
    };
  }, []);

  // GPS tracking when online
  useEffect(() => {
    if (online) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    return () => stopLocationTracking();
  }, [online]);

  const startCountdown = () => {
    stopCountdown();
    setCountdown(OFFER_TIMEOUT_SECS);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopCountdown();
          // Auto-dismiss when timer hits 0
          setIncomingOffer(null);
          currentOfferRef.current = null;
          return OFFER_TIMEOUT_SECS;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startLocationTracking = async () => {
    const session = getSession();
    if (!session) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    const sendLocation = async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await updateLocation(session.driverId, pos.coords.latitude, pos.coords.longitude);
      } catch { /* silent */ }
    };

    sendLocation();
    locationIntervalRef.current = setInterval(sendLocation, LOCATION_INTERVAL_MS);
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  const toggleOnline = async () => {
    const session = getSession();
    if (!session) return;
    try {
      setStatusLoading(true);
      const next = online ? "OFFLINE" : "ONLINE";
      await updateStatus(session.driverId, next);
      setOnline(!online);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAcceptRide = async () => {
    const offer = incomingOffer;
    const session = getSession();
    if (!offer || !session) return;
    try {
      setAccepting(true);
      const result = await acceptRideOffer(offer.rideId, session.driverId);
      stopCountdown();
      setIncomingOffer(null);
      currentOfferRef.current = null;
      // Build ActiveRide from accept response
      const ride: ActiveRide = {
        _id: result.rideId,
        status: "DRIVER_ASSIGNED",
        pickup: result.pickup,
        drop: result.drop,
        quotedFare: result.fare,
        distanceKm: result.distanceKm,
        rideType: result.rideType,
        passengerCount: result.passengerCount,
        paymentMethod: result.paymentMethod,
        customer: result.customer,
      };
      onRideAccepted(ride);
    } catch (err: any) {
      stopCountdown();
      setIncomingOffer(null);
      currentOfferRef.current = null;
      if (err.message?.includes("already accepted")) {
        Alert.alert("Ride Taken", "Another driver accepted this ride first.");
      } else {
        Alert.alert("Error", err.message || "Could not accept ride");
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleRejectRide = async () => {
    const offer = incomingOffer;
    const session = getSession();
    stopCountdown();
    setIncomingOffer(null);
    currentOfferRef.current = null;
    if (offer && session) {
      rejectRideOffer(offer.rideId, session.driverId).catch(() => {});
    }
  };

  const countdownColor = countdown <= 10 ? "#ef4444" : countdown <= 20 ? "#f59e0b" : "#16a34a";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.name}>{driver.fullName}</Text>
          <Text style={styles.city}>{driver.city}</Text>
        </View>
        <Pressable onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View>
          <Text style={styles.statusLabel}>Driver status</Text>
          <Text style={[styles.statusValue, { color: online ? "#16a34a" : "#9ca3af" }]}>
            {online ? "Online" : "Offline"}
          </Text>
        </View>
        <Pressable
          onPress={toggleOnline}
          disabled={statusLoading}
          style={[styles.statusBtn, online ? styles.offlineBtn : styles.onlineBtn]}
        >
          <Text style={[styles.statusBtnText, { color: online ? "#000" : "#fff" }]}>
            {statusLoading ? "..." : online ? "Go Offline" : "Go Online"}
          </Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Rating" value={`${driver.rating ?? 4.8}★`} />
        <StatCard label="Vehicle" value={driver.vehicleNumber} />
        <StatCard label="Seats" value={String(driver.vehicleCapacity)} />
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          {online ? "Waiting for ride requests..." : "Go online to receive rides"}
        </Text>
        <Text style={styles.infoSub}>
          {online
            ? "Sharing your location. You'll be notified when a customer books nearby."
            : "Tap the button above to start accepting rides."}
        </Text>
      </View>

      {/* Ride Offer Modal */}
      <Modal visible={!!incomingOffer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Countdown ring */}
            <View style={styles.countdownRow}>
              <View style={[styles.countdownCircle, { borderColor: countdownColor }]}>
                <Text style={[styles.countdownNum, { color: countdownColor }]}>{countdown}</Text>
              </View>
              <View style={styles.offerHeaderText}>
                <Text style={styles.modalTitle}>New Ride Request</Text>
                <Text style={styles.countdownLabel}>Accept before timer runs out</Text>
              </View>
            </View>

            {incomingOffer && (
              <View style={styles.rideInfo}>
                <View style={styles.locationRow}>
                  <Text style={styles.locationDot}>●</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideLabel}>PICKUP</Text>
                    <Text style={styles.rideValue} numberOfLines={2}>{incomingOffer.pickup.label}</Text>
                  </View>
                </View>

                <View style={styles.locationDivider} />

                <View style={styles.locationRow}>
                  <Text style={[styles.locationDot, { color: "#ef4444" }]}>■</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rideLabel}>DROP</Text>
                    <Text style={styles.rideValue} numberOfLines={2}>{incomingOffer.drop.label}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <MetaBadge label={`${incomingOffer.distanceKm} km`} />
                  <MetaBadge label={`₹${incomingOffer.fare}`} highlight />
                  <MetaBadge label={incomingOffer.paymentMethod} />
                  <MetaBadge label={`${incomingOffer.passengerCount} pax`} />
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.rejectBtn}
                onPress={handleRejectRide}
                disabled={accepting}
              >
                <Text style={styles.rejectText}>Skip</Text>
              </Pressable>
              <Pressable
                style={[styles.acceptBtn, accepting && { opacity: 0.6 }]}
                onPress={handleAcceptRide}
                disabled={accepting}
              >
                <Text style={styles.acceptText}>{accepting ? "Accepting..." : "Accept"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MetaBadge({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <View style={[styles.badge, highlight && styles.badgeHighlight]}>
      <Text style={[styles.badgeText, highlight && styles.badgeTextHighlight]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  greeting: { fontSize: 13, color: "#6b7280" },
  name: { fontSize: 26, fontWeight: "800", color: "#000" },
  city: { color: "#9ca3af", marginTop: 2 },
  logoutBtn: { paddingTop: 4 },
  logoutText: { color: "#ef4444", fontWeight: "600" },
  statusCard: {
    backgroundColor: "#000",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  statusLabel: { color: "#9ca3af", fontSize: 13 },
  statusValue: { fontSize: 20, fontWeight: "800" },
  statusBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  onlineBtn: { borderWidth: 1, borderColor: "#fff" },
  offlineBtn: { backgroundColor: "#fff" },
  statusBtnText: { fontWeight: "700", fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: "#f5f5f5", borderRadius: 16, padding: 14 },
  statLabel: { color: "#6b7280", fontSize: 12 },
  statValue: { fontSize: 16, fontWeight: "800", marginTop: 6 },
  infoCard: { backgroundColor: "#000", borderRadius: 20, padding: 20 },
  infoTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  infoSub: { color: "#9ca3af", fontSize: 13, lineHeight: 20 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 36,
  },
  countdownRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 16 },
  countdownCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownNum: { fontSize: 22, fontWeight: "900" },
  offerHeaderText: { flex: 1 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#000" },
  countdownLabel: { color: "#6b7280", fontSize: 13, marginTop: 2 },
  rideInfo: { marginBottom: 20 },
  locationRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  locationDot: { color: "#16a34a", fontSize: 12, marginTop: 14 },
  locationDivider: { width: 1, height: 14, backgroundColor: "#e5e7eb", marginLeft: 5, marginVertical: 2 },
  rideLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "600", marginTop: 8 },
  rideValue: { fontSize: 15, fontWeight: "700", color: "#000", marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  badgeHighlight: { backgroundColor: "#000" },
  badgeText: { fontSize: 13, fontWeight: "700", color: "#374151" },
  badgeTextHighlight: { color: "#fff" },
  modalActions: { flexDirection: "row", gap: 12 },
  rejectBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  rejectText: { fontWeight: "800", color: "#374151", fontSize: 15 },
  acceptBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#000",
    alignItems: "center",
  },
  acceptText: { fontWeight: "800", color: "#fff", fontSize: 15 },
});
