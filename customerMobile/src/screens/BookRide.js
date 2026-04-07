import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapPicker from "../components/MapPicker";
import { createRide, estimateRide } from "../services/customerApi";
import { formatCurrency, resolveLocation } from "../utils/location";

export default function BookRide({ userData, setScreen, data, onRideCreated }) {
  const [pickupLocation, setPickupLocation] = useState(
    data?.pickupLocation || null
  );
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [numberOfPeople, setNumberOfPeople] = useState(1);
  const [estimate, setEstimate] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const destinationLocation = data?.destinationLocation;
  const maxCapacity = data?.rideType === "shared" ? 2 : 4;

  // If no pickup from HomeScreen, try GPS then profile
  useEffect(() => {
    if (pickupLocation) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) {
          if (!cancelled) {
            setPickupLocation(
              resolveLocation(userData?.defaultArea || userData?.city, userData?.city)
            );
          }
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const { latitude, longitude } = pos.coords;
        setPickupLocation({
          label: "Current Location",
          address: "Current Location",
          coordinates: { lat: latitude, lng: longitude },
        });
      } catch {
        if (!cancelled) {
          setPickupLocation(
            resolveLocation(userData?.defaultArea || userData?.city, userData?.city)
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Recalculate estimate when pickup, destination or pax changes
  useEffect(() => {
    let ignore = false;

    const loadEstimate = async () => {
      if (!destinationLocation || !pickupLocation) {
        setEstimate(null);
        return;
      }
      try {
        setLoadingEstimate(true);
        const response = await estimateRide({
          pickup: {
            label: pickupLocation.label,
            address: pickupLocation.address,
            coordinates: pickupLocation.coordinates,
          },
          drop: {
            label: destinationLocation.label,
            address: destinationLocation.address,
            coordinates: destinationLocation.coordinates,
          },
          rideType: data.rideType,
          passengerCount: numberOfPeople,
        });
        if (!ignore) setEstimate(response);
      } catch (error) {
        if (!ignore) {
          setEstimate(null);
          Alert.alert("Estimate failed", error.message);
        }
      } finally {
        if (!ignore) setLoadingEstimate(false);
      }
    };

    loadEstimate();
    return () => { ignore = true; };
  }, [data.rideType, destinationLocation, pickupLocation, numberOfPeople]);

  const goBack = () => setScreen({ NAME: "HOME", DATA: {} });

  const confirmRide = async () => {
    if (!destinationLocation || !pickupLocation) {
      Alert.alert("Location required", "Could not determine pickup location.");
      return;
    }
    try {
      setSubmitting(true);
      const response = await createRide({
        city: userData?.city || "Delhi",
        rideType: data.rideType,
        pickup: {
          label: pickupLocation.label,
          address: pickupLocation.address,
          coordinates: pickupLocation.coordinates,
        },
        drop: {
          label: destinationLocation.label,
          address: destinationLocation.address,
          coordinates: destinationLocation.coordinates,
        },
        paymentMethod,
        passengerCount: numberOfPeople,
      });
      await onRideCreated(response.rideId);
    } catch (error) {
      Alert.alert("Ride creation failed", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMapConfirm = (locationResult) => {
    setPickupLocation(locationResult);
    setShowMapPicker(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Text style={styles.backIcon}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Ride</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pickup */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pickup Location</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationInfo}>
              <Text style={styles.locationDot}>●</Text>
              <Text style={styles.locationLabel} numberOfLines={2}>
                {pickupLocation?.label || "Detecting location..."}
              </Text>
            </View>
            <TouchableOpacity style={styles.changeBtn} onPress={() => setShowMapPicker(true)}>
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Destination */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Destination</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationDot}>◆</Text>
            <Text style={styles.locationLabel} numberOfLines={2}>
              {destinationLocation?.label || "Selected destination"}
            </Text>
          </View>
        </View>

        {/* Passengers */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Number of Passengers</Text>
          <View style={styles.peopleSelector}>
            <TouchableOpacity
              style={[styles.peopleButton, numberOfPeople === 1 && styles.peopleButtonDisabled]}
              onPress={() => setNumberOfPeople((v) => Math.max(1, v - 1))}
              disabled={numberOfPeople === 1}
            >
              <Text style={styles.peopleButtonText}>-</Text>
            </TouchableOpacity>

            <View style={styles.peopleCount}>
              <Text style={styles.peopleNumber}>{numberOfPeople}</Text>
              <Text style={styles.peopleLabel}>
                {numberOfPeople === 1 ? "passenger" : "passengers"}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.peopleButton, numberOfPeople === maxCapacity && styles.peopleButtonDisabled]}
              onPress={() => setNumberOfPeople((v) => Math.min(maxCapacity, v + 1))}
              disabled={numberOfPeople === maxCapacity}
            >
              <Text style={styles.peopleButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.capacityText}>Max capacity: {maxCapacity} passengers</Text>
        </View>

        {/* Fare */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fare Details</Text>
          {loadingEstimate ? (
            <ActivityIndicator color="#fff" />
          ) : estimate ? (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>{data.rideType === "shared" ? "Shared Ride" : "Personal Ride"}</Text>
                <Text style={styles.value}>{formatCurrency(estimate.fareBreakdown.baseFare)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Distance</Text>
                <Text style={styles.value}>{estimate.distanceKm} km</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>ETA</Text>
                <Text style={styles.value}>{estimate.etaMinutes} min</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(estimate.fareEstimate)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.label}>
              {pickupLocation ? "Calculating fare..." : "Select pickup to load fare details"}
            </Text>
          )}
        </View>

        {/* Payment */}
        <View style={[styles.card, { marginBottom: 30 }]}>
          <Text style={styles.cardTitle}>Payment Method</Text>
          {["UPI", "CASH"].map((method) => (
            <TouchableOpacity
              key={method}
              style={[styles.paymentOption, paymentMethod === method && styles.paymentActive]}
              onPress={() => setPaymentMethod(method)}
            >
              <Text style={styles.paymentText}>{method}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmButton, (!pickupLocation || submitting) && styles.confirmDisabled]}
          onPress={confirmRide}
          disabled={!pickupLocation || submitting}
        >
          <Text style={styles.confirmText}>
            {submitting
              ? "Confirming..."
              : `Confirm Ride${estimate ? ` - ${formatCurrency(estimate.fareEstimate)}` : ""}`}
          </Text>
        </TouchableOpacity>
      </View>

      <MapPicker
        visible={showMapPicker}
        title="Select Pickup Location"
        initialCoord={pickupLocation?.coordinates}
        onConfirm={handleMapConfirm}
        onCancel={() => setShowMapPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
  },
  backIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "600" },
  content: { padding: 16, paddingBottom: 160, gap: 16 },
  card: { backgroundColor: "#0f0f0f", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#1f1f1f" },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  locationRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  locationInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  locationDot: { color: "#4ade80", fontSize: 10, marginRight: 8 },
  locationLabel: { color: "#fff", fontSize: 15, flex: 1 },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#333", marginLeft: 10 },
  changeBtnText: { color: "#aaa", fontSize: 13 },
  peopleSelector: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  peopleButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1f1f1f", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2f2f2f" },
  peopleButtonDisabled: { backgroundColor: "#0a0a0a", borderColor: "#1a1a1a" },
  peopleButtonText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  peopleCount: { alignItems: "center", flex: 1 },
  peopleNumber: { color: "#fff", fontSize: 32, fontWeight: "700" },
  peopleLabel: { color: "#999", fontSize: 13, marginTop: 2 },
  capacityText: { color: "#666", fontSize: 12, marginTop: 8, textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 4 },
  label: { color: "#9f9f9f", fontSize: 14 },
  value: { color: "#fff", fontSize: 14 },
  divider: { height: 1, backgroundColor: "#1f1f1f", marginVertical: 10 },
  totalLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  totalValue: { color: "#fff", fontSize: 16, fontWeight: "700" },
  paymentOption: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1f1f1f", marginTop: 8 },
  paymentActive: { borderColor: "#fff", backgroundColor: "#ffffff10" },
  paymentText: { color: "#fff", fontSize: 15 },
  footer: { position: "absolute", bottom: 100, width: "100%", paddingHorizontal: 16 },
  confirmButton: { backgroundColor: "#fff", height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  confirmDisabled: { backgroundColor: "#2a2a2a" },
  confirmText: { color: "#000", fontSize: 16, fontWeight: "700" },
});
