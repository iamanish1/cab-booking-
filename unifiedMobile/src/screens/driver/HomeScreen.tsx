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
import {
  acceptRideOffer,
  rejectRideOffer,
  updateLocation,
  updateStatus,
} from "../../services/driverApi";
import { connectDriverSocket, onRideOffer } from "../../services/driverSocket";
import { getSession } from "../../services/session";
import type { DriverProfile, RideOffer, ActiveDriverRide } from "../../types";

interface Props {
  driver: DriverProfile;
  onRideAccepted: (ride: ActiveDriverRide) => void;
  onEarnings: () => void;
  onLogout: () => void;
}

const OFFER_TIMEOUT = 30;
const LOCATION_INTERVAL_MS = 10_000;

export default function DriverHomeScreen({ driver, onRideAccepted, onEarnings, onLogout }: Props) {
  const [online, setOnline] = useState(driver.currentStatus === "ONLINE");
  const [statusLoading, setStatusLoading] = useState(false);
  const [offer, setOffer] = useState<RideOffer | null>(null);
  const [countdown, setCountdown] = useState(OFFER_TIMEOUT);
  const [accepting, setAccepting] = useState(false);

  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const offerRef = useRef<RideOffer | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) return;

    connectDriverSocket(session.userId);

    const unsub = onRideOffer((incoming: RideOffer) => {
      offerRef.current = incoming;
      setOffer(incoming);
      startCountdown();
    });

    return () => { unsub(); stopCountdown(); };
  }, []);

  useEffect(() => {
    if (online) startLocationTracking();
    else stopLocationTracking();
    return () => stopLocationTracking();
  }, [online]);

  const startCountdown = () => {
    stopCountdown();
    setCountdown(OFFER_TIMEOUT);
    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopCountdown();
          setOffer(null);
          offerRef.current = null;
          return OFFER_TIMEOUT;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownInterval.current) { clearInterval(countdownInterval.current); countdownInterval.current = null; }
  };

  const startLocationTracking = async () => {
    const session = getSession();
    if (!session) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    const send = async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await updateLocation(session.userId, pos.coords.latitude, pos.coords.longitude);
      } catch { /* silent */ }
    };
    send();
    locationInterval.current = setInterval(send, LOCATION_INTERVAL_MS);
  };

  const stopLocationTracking = () => {
    if (locationInterval.current) { clearInterval(locationInterval.current); locationInterval.current = null; }
  };

  const toggleOnline = async () => {
    const session = getSession();
    if (!session) return;
    try {
      setStatusLoading(true);
      const next = online ? "OFFLINE" : "ONLINE";
      await updateStatus(session.userId, next);
      setOnline(!online);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  const acceptOffer = async () => {
    const current = offer;
    const session = getSession();
    if (!current || !session) return;
    try {
      setAccepting(true);
      const result = await acceptRideOffer(current.rideId, session.userId);
      stopCountdown();
      setOffer(null);
      offerRef.current = null;
      const ride: ActiveDriverRide = {
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
      setOffer(null);
      offerRef.current = null;
      if (err.message?.includes("already accepted")) {
        Alert.alert("Ride Taken", "Another driver accepted this ride first.");
      } else {
        Alert.alert("Error", err.message || "Could not accept ride");
      }
    } finally {
      setAccepting(false);
    }
  };

  const rejectOffer = () => {
    const current = offer;
    const session = getSession();
    stopCountdown();
    setOffer(null);
    offerRef.current = null;
    if (current && session) {
      rejectRideOffer(current.rideId, session.userId).catch(() => {});
    }
  };

  const timerColor = countdown <= 10 ? "#ef4444" : countdown <= 20 ? "#f59e0b" : "#4ade80";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.driverName}>{driver.fullName}</Text>
          <Text style={styles.city}>{driver.city || "Jammu"}</Text>
        </View>
        <Pressable onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Status toggle */}
      <View style={styles.statusCard}>
        <View>
          <Text style={styles.statusCardLabel}>Status</Text>
          <Text style={[styles.statusCardValue, { color: online ? "#4ade80" : "#9ca3af" }]}>
            {online ? "Online" : "Offline"}
          </Text>
        </View>
        <Pressable
          onPress={toggleOnline}
          disabled={statusLoading}
          style={[styles.toggleBtn, online ? styles.toggleBtnOnline : styles.toggleBtnOffline]}
        >
          <Text style={[styles.toggleBtnText, { color: online ? "#000" : "#fff" }]}>
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

      {/* Info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          {online ? "Waiting for ride requests..." : "You are offline"}
        </Text>
        <Text style={styles.infoSub}>
          {online
            ? "You'll be notified when a nearby passenger books a ride."
            : "Tap 'Go Online' to start accepting rides and earn."}
        </Text>
      </View>

      {/* Earnings button */}
      <Pressable onPress={onEarnings} style={styles.earningsBtn}>
        <Text style={styles.earningsBtnText}>View Earnings</Text>
      </Pressable>

      {/* Ride offer modal */}
      <Modal visible={!!offer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.timerRow}>
              <View style={[styles.timerCircle, { borderColor: timerColor }]}>
                <Text style={[styles.timerNum, { color: timerColor }]}>{countdown}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.offerTitle}>New Ride Request</Text>
                <Text style={styles.offerSub}>Accept before timer runs out</Text>
              </View>
            </View>

            {offer && (
              <View style={styles.offerBody}>
                <LocRow color="#4ade80" label="PICKUP" text={offer.pickup.label} />
                <View style={styles.locDivider} />
                <LocRow color="#ef4444" label="DROP" text={offer.drop.label} />

                <View style={styles.badgeRow}>
                  <Badge label={`${offer.distanceKm} km`} />
                  <Badge label={`₹${offer.fare}`} highlight />
                  <Badge label={offer.paymentMethod} />
                  <Badge label={`${offer.passengerCount} pax`} />
                  <Badge label={offer.rideType} />
                </View>
              </View>
            )}

            <View style={styles.offerActions}>
              <Pressable style={styles.skipBtn} onPress={rejectOffer} disabled={accepting}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
              <Pressable
                style={[styles.acceptBtn, accepting && { opacity: 0.6 }]}
                onPress={acceptOffer}
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

function LocRow({ color, label, text }: { color: string; label: string; text: string }) {
  return (
    <View style={styles.locRow}>
      <Text style={[styles.locDot, { color }]}>●</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.locLabel}>{label}</Text>
        <Text style={styles.locText} numberOfLines={2}>{text}</Text>
      </View>
    </View>
  );
}

function Badge({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <View style={[styles.badge, highlight && styles.badgeHighlight]}>
      <Text style={[styles.badgeText, highlight && styles.badgeTextHighlight]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  greeting: { fontSize: 13, color: "#9ca3af" },
  driverName: { fontSize: 26, fontWeight: "800", color: "#000" },
  city: { color: "#9ca3af", marginTop: 2, fontSize: 14 },
  logoutBtn: {},
  logoutText: { color: "#ef4444", fontWeight: "700", marginTop: 4 },
  statusCard: {
    backgroundColor: "#000", borderRadius: 20, padding: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20,
  },
  statusCardLabel: { color: "#9ca3af", fontSize: 13 },
  statusCardValue: { fontSize: 20, fontWeight: "800" },
  toggleBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999 },
  toggleBtnOnline: { backgroundColor: "#fff" },
  toggleBtnOffline: { borderWidth: 1, borderColor: "#fff" },
  toggleBtnText: { fontWeight: "700", fontSize: 14 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: "#f5f5f5", borderRadius: 16, padding: 14 },
  statLabel: { color: "#6b7280", fontSize: 12 },
  statValue: { fontSize: 16, fontWeight: "800", marginTop: 6, color: "#000" },
  infoCard: { backgroundColor: "#000", borderRadius: 20, padding: 20, marginBottom: 16 },
  infoTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  infoSub: { color: "#9ca3af", fontSize: 13, lineHeight: 20 },
  earningsBtn: {
    borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 16,
    paddingVertical: 14, alignItems: "center",
  },
  earningsBtnText: { fontSize: 15, fontWeight: "700", color: "#374151" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  timerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 16 },
  timerCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  timerNum: { fontSize: 22, fontWeight: "900" },
  offerTitle: { fontSize: 20, fontWeight: "900", color: "#000" },
  offerSub: { color: "#9ca3af", fontSize: 13, marginTop: 2 },
  offerBody: { marginBottom: 20 },
  locRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  locDot: { fontSize: 12, marginTop: 14 },
  locLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "600", marginTop: 8 },
  locText: { fontSize: 15, fontWeight: "700", color: "#000", marginTop: 2 },
  locDivider: { width: 1, height: 14, backgroundColor: "#e5e7eb", marginLeft: 5, marginVertical: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#f3f4f6" },
  badgeHighlight: { backgroundColor: "#000" },
  badgeText: { fontSize: 13, fontWeight: "700", color: "#374151" },
  badgeTextHighlight: { color: "#fff" },
  offerActions: { flexDirection: "row", gap: 12 },
  skipBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: "#e5e7eb", alignItems: "center" },
  skipText: { fontWeight: "800", color: "#374151", fontSize: 15 },
  acceptBtn: { flex: 2, paddingVertical: 16, borderRadius: 16, backgroundColor: "#000", alignItems: "center" },
  acceptText: { fontWeight: "800", color: "#fff", fontSize: 15 },
});
