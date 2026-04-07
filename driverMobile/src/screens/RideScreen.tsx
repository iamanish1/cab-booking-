import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import {
  arriveAtPickup,
  cancelRide,
  completeRide,
  updateLocation,
  verifyRideOtp,
} from "../services/driverApi";
import { subscribeToRideEvents } from "../services/driverSocket";
import { getSession } from "../services/session";
import { ActiveRide, DriverProfile } from "../helpers/types";

interface Props {
  ride: ActiveRide;
  driver: DriverProfile;
  onRideDone: () => void;
}

interface DriverCoord {
  latitude: number;
  longitude: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; sub: string; color: string }
> = {
  DRIVER_ASSIGNED: {
    label: "Head to Pickup",
    sub: "Navigate to the passenger's pickup point",
    color: "#f59e0b",
  },
  DRIVER_ARRIVING: {
    label: "You've Arrived",
    sub: "Ask the passenger for their OTP",
    color: "#3b82f6",
  },
  VERIFY_CODE: {
    label: "Verify OTP",
    sub: "Enter the passenger's 4-digit OTP",
    color: "#8b5cf6",
  },
  ON_TRIP: {
    label: "Ride in Progress",
    sub: "Heading to the drop location",
    color: "#16a34a",
  },
  COMPLETED: {
    label: "Trip Completed!",
    sub: "Great job! You've completed this ride.",
    color: "#16a34a",
  },
  CANCELLED_BY_CUSTOMER: {
    label: "Ride Cancelled",
    sub: "The customer cancelled this ride.",
    color: "#ef4444",
  },
  CANCELLED_BY_DRIVER: {
    label: "Ride Cancelled",
    sub: "You cancelled this ride.",
    color: "#ef4444",
  },
};

export default function RideScreen({ ride: initialRide, driver, onRideDone }: Props) {
  const [ride, setRide] = useState<ActiveRide>(initialRide);
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [driverCoord, setDriverCoord] = useState<DriverCoord | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);

  const statusCfg = STATUS_CONFIG[ride.status] ?? {
    label: ride.status,
    sub: "",
    color: "#6b7280",
  };

  const isPreTrip = ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "VERIFY_CODE"].includes(ride.status);
  const isOnTrip = ride.status === "ON_TRIP";
  const isTerminal = ["COMPLETED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_DRIVER", "NO_DRIVER_AVAILABLE"].includes(ride.status);

  // Subscribe to ride events via socket
  useEffect(() => {
    const unsub = subscribeToRideEvents(ride._id, (eventName, payload) => {
      if (payload?.status) {
        setRide((prev) => ({ ...prev, status: payload.status }));
      }
      // Auto-show OTP modal when status flips to VERIFY_CODE via socket
      if (eventName === "ride:otp_ready" || payload?.status === "VERIFY_CODE") {
        setShowOtpModal(true);
      }
      if (eventName === "ride:completed") {
        setTimeout(onRideDone, 2500);
      }
      if (eventName === "ride:cancelled") {
        setTimeout(onRideDone, 2500);
      }
    });
    return unsub;
  }, [ride._id]);

  // Auto-navigate away when status becomes terminal (from socket updates)
  useEffect(() => {
    if (isTerminal && ride.status !== "COMPLETED") {
      const t = setTimeout(onRideDone, 2500);
      return () => clearTimeout(t);
    }
  }, [ride.status]);

  // GPS tracking throughout the ride
  useEffect(() => {
    let cancelled = false;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;

      const session = getSession();

      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (pos) => {
          if (cancelled) return;
          const { latitude, longitude } = pos.coords;
          setDriverCoord({ latitude, longitude });
          if (session) {
            updateLocation(session.driverId, latitude, longitude).catch(() => {});
          }
        }
      );
    };

    startTracking();

    return () => {
      cancelled = true;
      locationWatchRef.current?.remove();
    };
  }, []);

  const pickupCoord = { latitude: ride.pickup.lat, longitude: ride.pickup.lng };
  const dropCoord = { latitude: ride.drop.lat, longitude: ride.drop.lng };
  const midLat = (pickupCoord.latitude + dropCoord.latitude) / 2;
  const midLng = (pickupCoord.longitude + dropCoord.longitude) / 2;
  const latDelta = Math.abs(pickupCoord.latitude - dropCoord.latitude) * 1.8 + 0.02;
  const lngDelta = Math.abs(pickupCoord.longitude - dropCoord.longitude) * 1.8 + 0.02;

  const handleArrive = async () => {
    try {
      setLoading(true);
      await arriveAtPickup(ride._id);
      setRide((prev) => ({ ...prev, status: "DRIVER_ARRIVING" }));
    } catch (err: any) {
      // Idempotent — already past this status
      if (err.message?.includes("does not allow")) {
        setRide((prev) => ({ ...prev, status: "DRIVER_ARRIVING" }));
      } else {
        Alert.alert("Error", err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 4) return;
    try {
      setLoading(true);
      await verifyRideOtp(ride._id, otp);
      setRide((prev) => ({ ...prev, status: "ON_TRIP" }));
      setShowOtpModal(false);
      setOtp("");
    } catch (err: any) {
      Alert.alert("Wrong OTP", err.message || "Invalid OTP. Ask the passenger to refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    try {
      setLoading(true);
      await completeRide(ride._id, ride.quotedFare);
      setRide((prev) => ({ ...prev, status: "COMPLETED", finalFare: ride.quotedFare }));
      setShowCompleteModal(false);
      setTimeout(onRideDone, 2500);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    setShowCancelModal(false);
    try {
      await cancelRide(ride._id, "Cancelled by driver");
      onRideDone();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const callPassenger = () => {
    if (ride.customer?.mobile) {
      Linking.openURL(`tel:${ride.customer.mobile}`);
    }
  };

  const focusMap = () => {
    const target = driverCoord ?? pickupCoord;
    mapRef.current?.animateToRegion(
      { ...target, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500
    );
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: midLat,
          longitude: midLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
      >
        <Marker coordinate={pickupCoord} title="Pickup" pinColor="green" />
        <Marker coordinate={dropCoord} title="Drop" pinColor="red" />
        {driverCoord && (
          <Marker coordinate={driverCoord} title="You">
            <View style={styles.carMarker}>
              <Text style={styles.carEmoji}>🚗</Text>
            </View>
          </Marker>
        )}
        <Polyline
          coordinates={[
            ...(driverCoord ? [driverCoord] : []),
            isOnTrip ? dropCoord : pickupCoord,
          ]}
          strokeWidth={3}
          strokeColor="#3b82f6"
          lineDashPattern={[6, 3]}
        />
        {isOnTrip && (
          <Polyline
            coordinates={[pickupCoord, dropCoord]}
            strokeWidth={2}
            strokeColor="#9ca3af"
          />
        )}
      </MapView>

      {/* Top floating buttons */}
      <SafeAreaView style={styles.topRow} pointerEvents="box-none">
        <Pressable style={styles.iconBtn} onPress={focusMap}>
          <Text style={styles.iconBtnText}>⊕</Text>
        </Pressable>
        {ride.customer?.mobile && (
          <Pressable style={[styles.iconBtn, styles.callBtn]} onPress={callPassenger}>
            <Text style={styles.iconBtnText}>📞</Text>
          </Pressable>
        )}
      </SafeAreaView>

      {/* Bottom ride card */}
      <View style={styles.card}>
        {/* Status pill */}
        <View style={[styles.statusPill, { backgroundColor: statusCfg.color + "22" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
          <Text style={[styles.statusLabel, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>

        <Text style={styles.statusSub}>{statusCfg.sub}</Text>

        {/* Passenger info */}
        {ride.customer?.name ? (
          <View style={styles.passengerRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>
                {ride.customer.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.passengerName}>{ride.customer.name}</Text>
              <Text style={styles.passengerSub}>
                {ride.passengerCount} passenger{ride.passengerCount !== 1 ? "s" : ""} · {ride.rideType}
              </Text>
            </View>
            <View style={[styles.payBadge, ride.paymentMethod === "CASH" ? styles.cashBadge : styles.upiBadge]}>
              <Text style={styles.payBadgeText}>{ride.paymentMethod}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.passengerRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>P</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.passengerName}>Passenger</Text>
              <Text style={styles.passengerSub}>
                {ride.passengerCount} seat{ride.passengerCount !== 1 ? "s" : ""} · {ride.rideType}
              </Text>
            </View>
            <View style={[styles.payBadge, ride.paymentMethod === "CASH" ? styles.cashBadge : styles.upiBadge]}>
              <Text style={styles.payBadgeText}>{ride.paymentMethod}</Text>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        {/* Location */}
        {isPreTrip && (
          <View style={styles.locationBlock}>
            <Text style={styles.locIcon}>●</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.locLabel}>PICKUP</Text>
              <Text style={styles.locText} numberOfLines={2}>{ride.pickup.label}</Text>
            </View>
          </View>
        )}

        {isOnTrip && (
          <View style={styles.locationBlock}>
            <Text style={[styles.locIcon, { color: "#ef4444" }]}>■</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.locLabel}>DROP</Text>
              <Text style={styles.locText} numberOfLines={2}>{ride.drop.label}</Text>
            </View>
          </View>
        )}

        {/* Fare row */}
        <View style={styles.fareRow}>
          <View>
            <Text style={styles.fareLabel}>Total Fare</Text>
            <Text style={styles.fareAmount}>₹{ride.finalFare ?? ride.quotedFare}</Text>
          </View>
          <View>
            <Text style={styles.fareLabel}>Distance</Text>
            <Text style={styles.fareAmount}>{ride.distanceKm} km</Text>
          </View>
        </View>

        {/* Action buttons */}
        {ride.status === "DRIVER_ASSIGNED" && (
          <Pressable
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleArrive}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.primaryBtnText}>I'VE ARRIVED AT PICKUP</Text>}
          </Pressable>
        )}

        {(ride.status === "DRIVER_ARRIVING" || ride.status === "VERIFY_CODE") && (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setShowOtpModal(true)}
          >
            <Text style={styles.primaryBtnText}>VERIFY PASSENGER OTP</Text>
          </Pressable>
        )}

        {isOnTrip && (
          <Pressable
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={() => setShowCompleteModal(true)}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.primaryBtnText}>END TRIP</Text>}
          </Pressable>
        )}

        {isTerminal && (
          <View style={styles.terminalBox}>
            <Text style={[styles.terminalText, { color: statusCfg.color }]}>
              {ride.status === "COMPLETED"
                ? `₹${ride.finalFare ?? ride.quotedFare} earned`
                : "Returning to home screen..."}
            </Text>
          </View>
        )}

        {/* Cancel button — only before trip starts */}
        {isPreTrip && (
          <Pressable
            style={styles.cancelBtn}
            onPress={() => setShowCancelModal(true)}
          >
            <Text style={styles.cancelText}>Cancel Ride</Text>
          </Pressable>
        )}
      </View>

      {/* OTP Verification Modal */}
      <Modal transparent visible={showOtpModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Passenger OTP</Text>
            <Text style={styles.modalSub}>
              Ask the passenger to show their OTP from the customer app
            </Text>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.otpInput}
              placeholder="• • • •"
              placeholderTextColor="#555"
              autoFocus
            />
            <Pressable
              style={[styles.modalPrimaryBtn, (otp.length !== 4 || loading) && styles.btnDisabled]}
              disabled={otp.length !== 4 || loading}
              onPress={handleVerifyOtp}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.modalPrimaryText}>START TRIP</Text>}
            </Pressable>
            <Pressable onPress={() => { setShowOtpModal(false); setOtp(""); }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* End Trip Confirmation Modal */}
      <Modal transparent visible={showCompleteModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>End Trip?</Text>
            <Text style={styles.modalSub}>Please confirm the trip summary</Text>
            <View style={styles.summaryBox}>
              <SummaryRow label="Passenger" value={ride.customer?.name ?? "—"} />
              <SummaryRow label="Drop" value={ride.drop.label} />
              <SummaryRow label="Distance" value={`${ride.distanceKm} km`} />
              <SummaryRow label="Payment" value={ride.paymentMethod} />
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>Your Earnings</Text>
                <Text style={styles.earningsAmount}>₹{ride.quotedFare}</Text>
              </View>
            </View>
            <Pressable
              style={[styles.modalPrimaryBtn, loading && styles.btnDisabled]}
              onPress={handleCompleteRide}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.modalPrimaryText}>CONFIRM COMPLETION</Text>}
            </Pressable>
            <Pressable onPress={() => setShowCompleteModal(false)}>
              <Text style={styles.modalCancel}>Back</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal transparent visible={showCancelModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel Ride?</Text>
            <Text style={styles.modalSub}>
              Are you sure you want to cancel this ride? This may affect your rating.
            </Text>
            <Pressable style={[styles.modalPrimaryBtn, { backgroundColor: "#ef4444" }]} onPress={handleCancelRide}>
              <Text style={styles.modalPrimaryText}>YES, CANCEL</Text>
            </Pressable>
            <Pressable onPress={() => setShowCancelModal(false)}>
              <Text style={styles.modalCancel}>No, keep the ride</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  map: { flex: 1 },
  carMarker: { alignItems: "center" },
  carEmoji: { fontSize: 28 },

  // Top buttons
  topRow: {
    position: "absolute",
    top: 50,
    right: 16,
    gap: 10,
    flexDirection: "column",
    alignItems: "flex-end",
  },
  iconBtn: {
    backgroundColor: "rgba(0,0,0,0.7)",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  callBtn: { backgroundColor: "rgba(22,163,74,0.85)" },
  iconBtnText: { fontSize: 20 },

  // Bottom card
  card: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    gap: 6,
    marginBottom: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontWeight: "700", fontSize: 13 },
  statusSub: { color: "#9ca3af", fontSize: 13, marginBottom: 14 },

  // Passenger row
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontSize: 18, fontWeight: "700" },
  passengerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  passengerSub: { color: "#9ca3af", fontSize: 12, marginTop: 1 },
  payBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  cashBadge: { backgroundColor: "#1c3a1e" },
  upiBadge: { backgroundColor: "#1a237e" },
  payBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  divider: { height: 1, backgroundColor: "#222", marginBottom: 14 },

  // Location
  locationBlock: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "flex-start" },
  locIcon: { color: "#16a34a", fontSize: 12, marginTop: 3 },
  locLabel: { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  locText: { color: "#fff", fontSize: 14, fontWeight: "600", marginTop: 2 },

  // Fare
  fareRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  fareLabel: { color: "#6b7280", fontSize: 12 },
  fareAmount: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2 },

  // Buttons
  primaryBtn: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#000", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  btnDisabled: { opacity: 0.5 },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ef444455",
  },
  cancelText: { color: "#ef4444", fontWeight: "600", fontSize: 14 },
  terminalBox: { paddingVertical: 14, alignItems: "center" },
  terminalText: { fontSize: 17, fontWeight: "700" },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#111",
    width: "100%",
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 6 },
  modalSub: { color: "#9ca3af", fontSize: 14, marginBottom: 20, lineHeight: 20 },
  otpInput: {
    backgroundColor: "#000",
    borderRadius: 12,
    padding: 16,
    color: "#fff",
    fontSize: 32,
    textAlign: "center",
    letterSpacing: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalPrimaryBtn: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 14,
  },
  modalPrimaryText: { color: "#000", fontWeight: "800", fontSize: 15 },
  modalCancel: { color: "#9ca3af", textAlign: "center", fontSize: 14 },

  // Summary
  summaryBox: {
    backgroundColor: "#000",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: "#6b7280", fontSize: 13 },
  summaryValue: { color: "#fff", fontSize: 13, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1f1f1f",
  },
  earningsLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  earningsAmount: { color: "#16a34a", fontSize: 22, fontWeight: "900" },
});
