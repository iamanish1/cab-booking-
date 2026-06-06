import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapPicker from "../../components/MapPicker";
import { createRide, estimateRide } from "../../services/customerApi";
import { formatCurrency, resolveLocation } from "../../utils/location";
import type { CustomerScreen, LocationPoint, NormalizedCustomer, FareEstimate } from "../../types";

interface Props {
  userData: NormalizedCustomer;
  data: Extract<CustomerScreen, { NAME: "BOOK-RIDE" }>["DATA"];
  setScreen: (s: CustomerScreen) => void;
  onRideCreated: (rideId: string) => void;
}

export default function BookRideScreen({ userData, data, setScreen, onRideCreated }: Props) {
  const [pickup, setPickup] = useState<LocationPoint | null>(data.pickupLocation || null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI">("CASH");
  const [passengerCount, setPassengerCount] = useState(1);
  const [estimate, setEstimate] = useState<FareEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const destination = data.destinationLocation;
  const rideType = data.rideType;
  const maxCapacity = rideType === "shared" ? 2 : 4;

  useEffect(() => {
    if (pickup) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) {
          if (!cancelled) setPickup(resolveLocation(userData.defaultArea || userData.city, "Jammu"));
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setPickup({ label: "Current Location", address: "Current Location", coordinates: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      } catch {
        if (!cancelled) setPickup(resolveLocation(userData.defaultArea || userData.city, "Jammu"));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!destination || !pickup) { setEstimate(null); return; }
      try {
        setLoadingEstimate(true);
        const res = await estimateRide({ pickup, drop: destination, rideType, passengerCount });
        if (!ignore) setEstimate(res);
      } catch (err: any) {
        if (!ignore) { setEstimate(null); Alert.alert("Estimate failed", err.message); }
      } finally {
        if (!ignore) setLoadingEstimate(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, [rideType, destination, pickup, passengerCount]);

  const confirmRide = async () => {
    if (!destination || !pickup) {
      Alert.alert("Location required", "Could not determine pickup location.");
      return;
    }
    try {
      setSubmitting(true);
      const result = await createRide({
        city: "Jammu",
        rideType,
        pickup,
        drop: destination,
        paymentMethod,
        passengerCount,
      });
      await onRideCreated(result.rideId);
    } catch (err: any) {
      Alert.alert("Ride creation failed", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setScreen({ NAME: "HOME", DATA: {} })} style={styles.backBtn}>
          <Text style={styles.backText}>{"<"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Confirm Ride</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Pickup */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Pickup</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationDot}>●</Text>
            <Text style={styles.locationText} numberOfLines={2}>
              {pickup?.label || "Detecting location..."}
            </Text>
            <Pressable onPress={() => setShowMapPicker(true)} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          </View>
        </View>

        {/* Drop */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Destination</Text>
          <View style={styles.locationRow}>
            <Text style={[styles.locationDot, { color: "#ef4444" }]}>◆</Text>
            <Text style={styles.locationText} numberOfLines={2}>{destination?.label}</Text>
          </View>
        </View>

        {/* Ride type badge */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ride Type</Text>
          <View style={styles.rideTypeBadge}>
            <Text style={styles.rideTypeText}>
              {rideType === "shared" ? "Shared Ride · ₹12/km" : "Personal Ride · ₹10/km"}
            </Text>
          </View>
        </View>

        {/* Passengers */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Passengers</Text>
          <View style={styles.counterRow}>
            <Pressable
              style={[styles.counterBtn, passengerCount === 1 && styles.counterBtnDisabled]}
              onPress={() => setPassengerCount((v) => Math.max(1, v - 1))}
              disabled={passengerCount === 1}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </Pressable>
            <View style={styles.counterDisplay}>
              <Text style={styles.counterNum}>{passengerCount}</Text>
              <Text style={styles.counterLabel}>{passengerCount === 1 ? "passenger" : "passengers"}</Text>
            </View>
            <Pressable
              style={[styles.counterBtn, passengerCount === maxCapacity && styles.counterBtnDisabled]}
              onPress={() => setPassengerCount((v) => Math.min(maxCapacity, v + 1))}
              disabled={passengerCount === maxCapacity}
            >
              <Text style={styles.counterBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.capacityNote}>Max {maxCapacity} passengers for {rideType} ride</Text>
        </View>

        {/* Fare */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Fare Estimate</Text>
          {loadingEstimate ? (
            <ActivityIndicator color="#fff" />
          ) : estimate ? (
            <>
              <Row label="Distance" value={`${estimate.distanceKm} km`} />
              <Row label="ETA" value={`${estimate.etaMinutes} min`} />
              <View style={styles.divider} />
              <Row label="Total" value={formatCurrency(estimate.fareEstimate)} bold />
            </>
          ) : (
            <Text style={styles.mutedText}>{pickup ? "Calculating fare..." : "Select pickup to calculate"}</Text>
          )}
        </View>

        {/* Payment */}
        <View style={[styles.card, { marginBottom: 140 }]}>
          <Text style={styles.cardLabel}>Payment Method</Text>
          {(["CASH", "UPI"] as const).map((method) => (
            <Pressable
              key={method}
              style={[styles.paymentOption, paymentMethod === method && styles.paymentActive]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text style={styles.paymentIcon}>{method === "CASH" ? "💵" : "📱"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentText}>{method === "CASH" ? "Cash" : "UPI / Card"}</Text>
                <Text style={styles.paymentSub}>{method === "CASH" ? "Pay directly to driver" : "Secure online payment"}</Text>
              </View>
              {paymentMethod === method && <Text style={styles.checkMark}>✓</Text>}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.confirmBtn, (!pickup || submitting) && styles.confirmBtnDisabled]}
          onPress={confirmRide}
          disabled={!pickup || submitting}
        >
          {submitting
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.confirmBtnText}>
                {`Confirm Ride${estimate ? ` · ${formatCurrency(estimate.fareEstimate)}` : ""}`}
              </Text>}
        </Pressable>
      </View>

      <MapPicker
        visible={showMapPicker}
        title="Select Pickup Location"
        initialCoord={pickup?.coordinates}
        onConfirm={(loc) => { setPickup(loc); setShowMapPicker(false); }}
        onCancel={() => setShowMapPicker(false)}
      />
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={[rowStyles.label, bold && rowStyles.boldLabel]}>{label}</Text>
      <Text style={[rowStyles.value, bold && rowStyles.boldValue]}>{value}</Text>
    </View>
  );
}
const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 4 },
  label: { color: "#777", fontSize: 14 },
  value: { color: "#fff", fontSize: 14 },
  boldLabel: { color: "#fff", fontWeight: "600" },
  boldValue: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    height: 60, paddingHorizontal: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 1, borderBottomColor: "#1a1a1a",
  },
  backBtn: { width: 32 },
  backText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: "#0f0f0f", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#1a1a1a" },
  cardLabel: { color: "#666", fontSize: 12, fontWeight: "600", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationDot: { color: "#4ade80", fontSize: 10 },
  locationText: { flex: 1, color: "#fff", fontSize: 15 },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#333" },
  changeBtnText: { color: "#aaa", fontSize: 13 },
  rideTypeBadge: { backgroundColor: "#1a1a1a", borderRadius: 10, padding: 12, alignSelf: "flex-start" },
  rideTypeText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  counterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  counterBtnDisabled: { opacity: 0.3 },
  counterBtnText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  counterDisplay: { alignItems: "center", flex: 1 },
  counterNum: { color: "#fff", fontSize: 28, fontWeight: "700" },
  counterLabel: { color: "#666", fontSize: 13, marginTop: 2 },
  capacityNote: { color: "#555", fontSize: 12, marginTop: 8, textAlign: "center" },
  divider: { height: 1, backgroundColor: "#1a1a1a", marginVertical: 8 },
  mutedText: { color: "#666", fontSize: 14 },
  paymentOption: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1a1a1a", marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  paymentActive: { borderColor: "#fff", backgroundColor: "#ffffff08" },
  paymentIcon: { fontSize: 22 },
  paymentText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  paymentSub: { color: "#555", fontSize: 12, marginTop: 2 },
  checkMark: { color: "#4ade80", fontSize: 18, fontWeight: "700" },
  footer: { position: "absolute", bottom: 0, width: "100%", padding: 16, paddingBottom: 32, backgroundColor: "#000", borderTopWidth: 1, borderTopColor: "#1a1a1a" },
  confirmBtn: { backgroundColor: "#fff", height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  confirmBtnDisabled: { backgroundColor: "#1a1a1a" },
  confirmBtnText: { color: "#000", fontSize: 16, fontWeight: "800" },
});
