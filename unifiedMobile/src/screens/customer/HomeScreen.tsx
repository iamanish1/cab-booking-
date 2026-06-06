import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapPicker from "../../components/MapPicker";
import { fetchRideOptions } from "../../services/customerApi";
import { formatCurrency, resolveLocation } from "../../utils/location";
import type { LocationPoint, NormalizedCustomer, CustomerScreen } from "../../types";

interface Props {
  userData: NormalizedCustomer;
  popularLocations: string[];
  setScreen: (s: CustomerScreen) => void;
}

export default function CustomerHomeScreen({ userData, popularLocations, setScreen }: Props) {
  const [destination, setDestination] = useState<LocationPoint | null>(null);
  const [customDestText, setCustomDestText] = useState("");
  const [showLocOptions, setShowLocOptions] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [rideType, setRideType] = useState<string | null>(null);
  const [rideOptions, setRideOptions] = useState<any[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [pickupLocation, setPickupLocation] = useState<LocationPoint | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const locations = popularLocations.length
    ? popularLocations
    : ["Railway Station", "Bus Stand", "Airport", "Raghunath Market", "Trikuta Nagar", "GMC Hospital"];

  const profilePickup = useMemo(
    () => resolveLocation(userData.defaultArea || userData.city || "Jammu", "Jammu"),
    [userData.defaultArea, userData.city]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setPickupLocation({
          label: "Current Location",
          address: "Current Location",
          coordinates: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        });
      } catch { /* use profile location */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const activePickup = pickupLocation || profilePickup;
  const destinationLabel = destination?.label || customDestText;

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      const resolvedDrop = destination || (customDestText.trim().length >= 3
        ? resolveLocation(customDestText, "Jammu") : null);

      if (!resolvedDrop?.coordinates) { setRideOptions([]); return; }

      try {
        setOptionsLoading(true);
        const res = await fetchRideOptions(activePickup.coordinates, resolvedDrop.coordinates);
        if (!ignore) setRideOptions(res.options || []);
      } catch {
        if (!ignore) setRideOptions([]);
      } finally {
        if (!ignore) setOptionsLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, [destination, customDestText, activePickup.coordinates]);

  const handleContinue = () => {
    setHasInteracted(true);
    if (!destinationLabel || destinationLabel.trim().length < 3 || !rideType) return;
    const finalDest = destination || resolveLocation(customDestText, "Jammu");
    setScreen({
      NAME: "BOOK-RIDE",
      DATA: { pickupLocation: activePickup, destinationLocation: finalDest, rideType },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.name}>{userData.fullName || "Passenger"}</Text>
          </View>
          <View style={styles.areaPill}>
            <Text style={styles.areaText}>{userData.defaultArea || userData.city || "Jammu"}</Text>
          </View>
        </View>

        {/* Pickup indicator */}
        <View style={styles.pickupRow}>
          <Text style={styles.pickupDot}>●</Text>
          <Text style={styles.pickupText} numberOfLines={1}>
            {pickupLocation ? "Current Location" : (userData.defaultArea || "Jammu")}
          </Text>
          {!pickupLocation && <ActivityIndicator size="small" color="#555" style={{ marginLeft: 6 }} />}
        </View>

        {/* Destination card */}
        <View style={styles.card}>
          <Pressable
            style={styles.destHeader}
            onPress={() => setShowLocOptions((p) => !p)}
          >
            <Text style={[styles.destText, !destinationLabel && styles.destPlaceholder]} numberOfLines={2}>
              {destinationLabel || "Where to go today?"}
            </Text>
            <Text style={styles.chevron}>{showLocOptions ? "▲" : "▼"}</Text>
          </Pressable>

          {hasInteracted && (!destinationLabel || destinationLabel.trim().length < 3) && (
            <Text style={styles.errorText}>Please select a destination</Text>
          )}

          {showLocOptions && (
            <View style={styles.optionsList}>
              {locations.map((place) => (
                <Pressable
                  key={place}
                  style={styles.optionItem}
                  onPress={() => {
                    setDestination(resolveLocation(place, "Jammu"));
                    setCustomDestText("");
                    setShowLocOptions(false);
                  }}
                >
                  <Text style={styles.optionText}>{place}</Text>
                </Pressable>
              ))}
              <TextInput
                placeholder="Enter precise location"
                placeholderTextColor="#555"
                value={customDestText}
                onChangeText={(t) => { setCustomDestText(t); setDestination(null); }}
                style={styles.textInput}
              />
            </View>
          )}

          <Pressable style={styles.mapBtn} onPress={() => setShowMapPicker(true)}>
            <Text style={styles.mapBtnText}>📍  Choose on Map</Text>
          </Pressable>
        </View>

        {/* Ride type cards */}
        <View style={styles.rideRow}>
          {(["shared", "personal"] as const).map((typeKey) => {
            const option = rideOptions.find((o) => o.rideType === typeKey);
            const isActive = rideType === typeKey;
            return (
              <Pressable
                key={typeKey}
                style={[styles.rideCard, isActive && styles.rideCardActive]}
                onPress={() => setRideType(typeKey)}
              >
                <Text style={[styles.rideText, isActive && styles.rideTextActive]}>
                  {typeKey === "shared" ? "Shared" : "Personal"}
                </Text>
                <Text style={[styles.rideRate, isActive && styles.rideTextActive]}>
                  {typeKey === "shared" ? "₹12/km" : "₹10/km"}
                </Text>
                {optionsLoading ? (
                  <ActivityIndicator color={isActive ? "#000" : "#fff"} size="small" />
                ) : option ? (
                  <Text style={[styles.rideMeta, isActive && styles.rideTextActive]}>
                    {formatCurrency(option.estimatedFare)} · {option.etaMinutes} min
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.continueBtn, (!destinationLabel || !rideType) && styles.continueBtnDisabled]}
          disabled={!destinationLabel || !rideType}
          onPress={handleContinue}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </Pressable>
      </ScrollView>

      <MapPicker
        visible={showMapPicker}
        title="Select Destination"
        initialCoord={pickupLocation?.coordinates}
        onConfirm={(loc) => { setDestination(loc); setCustomDestText(""); setShowMapPicker(false); setShowLocOptions(false); }}
        onCancel={() => setShowMapPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", paddingTop: 14 },
  scroll: { alignItems: "center", paddingBottom: 100 },
  topBar: {
    width: "92%", flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  welcome: { color: "#666", fontSize: 13 },
  name: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 4 },
  areaPill: { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#222" },
  areaText: { color: "#ddd", fontWeight: "600" },
  pickupRow: { width: "92%", flexDirection: "row", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 },
  pickupDot: { color: "#4ade80", fontSize: 10, marginRight: 8 },
  pickupText: { color: "#777", fontSize: 13, flex: 1 },
  card: {
    width: "92%", backgroundColor: "#111", borderRadius: 16, padding: 18,
    marginBottom: 18, borderWidth: 1, borderColor: "#1f1f1f",
  },
  destHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  destText: { color: "#fff", fontSize: 22, fontWeight: "700", flex: 1, paddingRight: 12 },
  destPlaceholder: { color: "#444" },
  chevron: { color: "#555", fontSize: 14 },
  errorText: { color: "#ef4444", fontSize: 13, marginBottom: 10 },
  optionsList: { backgroundColor: "#0f0f0f", borderRadius: 12, marginBottom: 14, overflow: "hidden", borderWidth: 1, borderColor: "#1a1a1a" },
  optionItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  optionText: { fontSize: 16, color: "#f5f5f5" },
  textInput: {
    paddingVertical: 14, paddingHorizontal: 16, backgroundColor: "#0a0a0a",
    color: "#fff", margin: 12, borderRadius: 12, fontSize: 15,
    borderWidth: 1, borderColor: "#222",
  },
  mapBtn: { paddingVertical: 14, borderRadius: 10, backgroundColor: "#0f0f0f", alignItems: "center", borderWidth: 1, borderColor: "#1f1f1f" },
  mapBtnText: { color: "#ddd", fontWeight: "600" },
  rideRow: { width: "92%", flexDirection: "row", gap: 12, marginBottom: 24 },
  rideCard: {
    flex: 1, backgroundColor: "#111", paddingVertical: 20, borderRadius: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#222", gap: 4,
  },
  rideCardActive: { backgroundColor: "#fff" },
  rideText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  rideRate: { fontSize: 16, fontWeight: "900", color: "#4ade80" },
  rideMeta: { fontSize: 12, color: "#666" },
  rideTextActive: { color: "#000" },
  continueBtn: {
    width: "92%", paddingVertical: 17, backgroundColor: "#fff",
    borderRadius: 14, alignItems: "center",
  },
  continueBtnDisabled: { backgroundColor: "#1a1a1a" },
  continueBtnText: { color: "#000", fontSize: 16, fontWeight: "800" },
});
