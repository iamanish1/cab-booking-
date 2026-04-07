import * as Location from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapPicker from "../components/MapPicker";
import { fetchRideOptions } from "../services/customerApi";
import { formatCurrency, resolveLocation } from "../utils/location";

const BOTTOM_BAR_HEIGHT = 60;

function ChevronDown() {
  return <Text style={{ fontSize: 16, color: "#999" }}>v</Text>;
}

export default function HomeScreen({ userData, homeMetadata, setScreen }) {
  const [destination, setDestination] = useState(null); // full location object { label, address, coordinates }
  const [customDestText, setCustomDestText] = useState("");
  const [showLocationOptions, setShowLocationOptions] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [rideType, setRideType] = useState(null);
  const [destinationError, setDestinationError] = useState("");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [rideOptions, setRideOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [pickupLocation, setPickupLocation] = useState(null); // real GPS location for pickup

  const popularLocations = homeMetadata?.popularLocations?.length
    ? homeMetadata.popularLocations
    : ["Airport", "Railway Station", "Bus Stand", "Mall", "Hospital"];

  // Default pickup from user profile (fallback if GPS unavailable)
  const profilePickup = useMemo(
    () => resolveLocation(userData?.defaultArea || userData?.city || "Connaught Place", userData?.city),
    [userData?.defaultArea, userData?.city]
  );

  // Auto-detect GPS location for pickup on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
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
        // GPS unavailable, fall back to profile area
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activePickup = pickupLocation || profilePickup;

  // Display label for destination
  const destinationLabel = destination?.label || customDestText;

  // Load ride options when destination changes
  useEffect(() => {
    let ignore = false;

    const loadRideOptions = async () => {
      const destCoords = destination?.coordinates;
      if (!destination && customDestText.trim().length < 3) {
        setRideOptions([]);
        return;
      }

      const resolvedDrop = destination
        ? destination
        : resolveLocation(customDestText, userData?.city);

      if (!resolvedDrop?.coordinates) {
        setRideOptions([]);
        return;
      }

      try {
        setOptionsLoading(true);
        const response = await fetchRideOptions({
          pickup: activePickup.coordinates,
          drop: resolvedDrop.coordinates,
        });
        if (!ignore) setRideOptions(response.options || []);
      } catch {
        if (!ignore) setRideOptions([]);
      } finally {
        if (!ignore) setOptionsLoading(false);
      }
    };

    loadRideOptions();
    return () => { ignore = true; };
  }, [destination, customDestText, activePickup.coordinates, userData?.city]);

  const handleContinue = () => {
    setHasInteracted(true);
    if (!destinationLabel || destinationLabel.trim().length < 3) {
      setDestinationError("Please select or enter a destination");
      return;
    }
    if (!rideType) return;

    const finalDestination = destination || resolveLocation(customDestText, userData?.city);

    setScreen({
      NAME: "BOOK-RIDE",
      DATA: {
        pickupLocation: activePickup,
        destinationLocation: finalDestination,
        rideType,
      },
    });
  };

  const handleMapConfirm = (locationResult) => {
    setDestination(locationResult);
    setCustomDestText("");
    setDestinationError("");
    setShowMapPicker(false);
    setShowLocationOptions(false);
  };

  const isFormComplete = destinationLabel.trim().length >= 3 && rideType !== null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ width: "100%" }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.welcomeText}>Welcome back</Text>
            <Text style={styles.userText}>{userData?.fullName || "Customer"}</Text>
          </View>
          <View style={styles.cityPill}>
            <Text style={styles.cityText}>{userData?.defaultArea || userData?.city || "Delhi"}</Text>
          </View>
        </View>

        {/* Pickup indicator */}
        <View style={styles.pickupRow}>
          <Text style={styles.pickupDot}>●</Text>
          <Text style={styles.pickupText} numberOfLines={1}>
            {pickupLocation ? "Current Location" : (userData?.defaultArea || userData?.city || "Delhi")}
          </Text>
          {!pickupLocation && <ActivityIndicator size="small" color="#555" style={{ marginLeft: 6 }} />}
        </View>

        <View style={styles.mainCard}>
          <TouchableOpacity
            style={styles.destinationHeader}
            onPress={() => setShowLocationOptions((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.destinationText} numberOfLines={2}>
              {destinationLabel || "Where to go today?"}
            </Text>
            <View style={styles.dropdownIcon}>
              <ChevronDown />
            </View>
          </TouchableOpacity>

          {destinationError && hasInteracted ? (
            <Text style={styles.errorText}>{destinationError}</Text>
          ) : null}

          {showLocationOptions ? (
            <View style={styles.optionsList}>
              {popularLocations.map((place) => (
                <TouchableOpacity
                  key={place}
                  style={styles.optionItem}
                  onPress={() => {
                    setDestination(resolveLocation(place, userData?.city));
                    setCustomDestText("");
                    setDestinationError("");
                    setShowLocationOptions(false);
                  }}
                  activeOpacity={0.6}
                >
                  <Text style={styles.optionText}>{place}</Text>
                </TouchableOpacity>
              ))}

              <TextInput
                placeholder="Enter precise location"
                placeholderTextColor="#777"
                value={customDestText}
                onChangeText={(text) => {
                  setCustomDestText(text);
                  setDestination(null);
                  if (hasInteracted) {
                    setDestinationError(
                      text.trim().length < 3 ? "Destination must be at least 3 characters" : ""
                    );
                  }
                }}
                style={styles.textInput}
              />
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => setShowMapPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.mapButtonText}>Choose on Map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rideOptions}>
          {["shared", "personal"].map((typeKey) => {
            const option = rideOptions.find((item) => item.rideType === typeKey);
            const isActive = rideType === typeKey;

            return (
              <TouchableOpacity
                key={typeKey}
                style={[styles.rideCard, isActive && styles.rideCardActive]}
                onPress={() => setRideType(typeKey)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rideText, isActive && { color: "#000" }]}>
                  {typeKey === "shared" ? "Shared Ride" : "Personal Ride"}
                </Text>
                {optionsLoading ? (
                  <ActivityIndicator color={isActive ? "#000" : "#fff"} size="small" />
                ) : option ? (
                  <>
                    <Text style={[styles.metaText, isActive && { color: "#333" }]}>
                      {formatCurrency(option.estimatedFare)}
                    </Text>
                    <Text style={[styles.metaText, isActive && { color: "#333" }]}>
                      {option.etaMinutes} min
                    </Text>
                  </>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !isFormComplete && styles.continueButtonDisabled]}
          disabled={!isFormComplete}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>

      <MapPicker
        visible={showMapPicker}
        title="Select Destination"
        initialCoord={pickupLocation?.coordinates}
        onConfirm={handleMapConfirm}
        onCancel={() => setShowMapPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0E0E", paddingTop: 14 },
  scrollContent: { alignItems: "center", paddingBottom: BOTTOM_BAR_HEIGHT + 20 },
  topBar: {
    width: "92%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  welcomeText: { color: "#777", fontSize: 13 },
  userText: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: 4 },
  cityPill: { backgroundColor: "#1C1C1C", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  cityText: { color: "#EDEDED", fontWeight: "600" },
  pickupRow: {
    width: "92%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  pickupDot: { color: "#4ade80", fontSize: 10, marginRight: 8 },
  pickupText: { color: "#777", fontSize: 13, flex: 1 },
  mainCard: {
    width: "92%",
    backgroundColor: "#141414",
    borderRadius: 10,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  destinationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  destinationText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
    flex: 1,
    paddingRight: 12,
  },
  dropdownIcon: { opacity: 0.7 },
  errorText: { color: "#FF4444", fontSize: 13, marginBottom: 10, paddingLeft: 4 },
  optionsList: { backgroundColor: "#1A1A1A", borderRadius: 10, marginBottom: 14, overflow: "hidden" },
  optionItem: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#2A2A2A" },
  optionText: { fontSize: 18, color: "#F5F5F5" },
  textInput: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#0F0F0F",
    color: "#FFF",
    borderRadius: 12,
    margin: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    fontSize: 16,
  },
  mapButton: { marginTop: 10, paddingVertical: 14, borderRadius: 10, backgroundColor: "#1F1F1F", alignItems: "center" },
  mapButtonText: { color: "#EDEDED", fontWeight: "600", letterSpacing: 0.3 },
  rideOptions: { width: "92%", flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  rideCard: {
    width: "48%",
    backgroundColor: "#141414",
    paddingVertical: 20,
    borderRadius: 7,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
    gap: 6,
  },
  rideCardActive: { backgroundColor: "#FFFFFF" },
  rideText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  metaText: { fontSize: 12, color: "#AAA" },
  continueButton: {
    width: "92%",
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  continueButtonDisabled: { backgroundColor: "#2A2A2A" },
  continueText: { color: "#000", fontSize: 16, fontWeight: "800", letterSpacing: 0.4 },
});
