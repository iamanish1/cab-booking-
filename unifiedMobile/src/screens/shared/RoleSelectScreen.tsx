import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  SafeAreaView,
} from "react-native";
import type { UserRole } from "../../types";

interface Props {
  onSelectRole: (role: UserRole) => void;
}

export default function RoleSelectScreen({ onSelectRole }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>JC</Text>
          </View>
          <Text style={styles.brand}>Jammu Cab</Text>
          <Text style={styles.tagline}>Fast, affordable auto rides across Jammu</Text>
        </View>

        <View style={styles.cards}>
          <Pressable
            style={({ pressed }) => [styles.card, styles.userCard, pressed && styles.cardPressed]}
            onPress={() => onSelectRole("customer")}
          >
            <Text style={styles.cardEmoji}>🧑‍💼</Text>
            <Text style={styles.cardTitle}>Ride with us</Text>
            <Text style={styles.cardSub}>Book an auto anywhere in Jammu</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Login as Passenger</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.card, styles.driverCard, pressed && styles.cardPressed]}
            onPress={() => onSelectRole("driver")}
          >
            <Text style={styles.cardEmoji}>🛺</Text>
            <Text style={[styles.cardTitle, { color: "#fff" }]}>Drive with us</Text>
            <Text style={[styles.cardSub, { color: "#aaa" }]}>Earn money driving your auto</Text>
            <View style={[styles.pill, styles.driverPill]}>
              <Text style={[styles.pillText, { color: "#000" }]}>Login as Driver</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.pricingRow}>
          <View style={styles.pricingBadge}>
            <Text style={styles.pricingLabel}>Personal</Text>
            <Text style={styles.pricingValue}>₹10/km</Text>
          </View>
          <View style={styles.pricingDivider} />
          <View style={styles.pricingBadge}>
            <Text style={styles.pricingLabel}>Shared</Text>
            <Text style={styles.pricingValue}>₹12/km</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 },
  header: { alignItems: "center", marginBottom: 40 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: { fontSize: 26, fontWeight: "900", color: "#000" },
  brand: { fontSize: 30, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  tagline: { color: "#666", fontSize: 14, marginTop: 8, textAlign: "center" },
  cards: { gap: 14, marginBottom: 28 },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#222",
    backgroundColor: "#0f0f0f",
  },
  userCard: {},
  driverCard: { backgroundColor: "#111" },
  cardPressed: { opacity: 0.75 },
  cardEmoji: { fontSize: 38, marginBottom: 12 },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 6 },
  cardSub: { fontSize: 14, color: "#666", marginBottom: 18 },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
  },
  driverPill: { backgroundColor: "#fff" },
  pillText: { color: "#000", fontWeight: "700", fontSize: 14 },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    backgroundColor: "#0a0a0a",
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#1a1a1a",
  },
  pricingBadge: { alignItems: "center" },
  pricingLabel: { color: "#666", fontSize: 12, fontWeight: "600" },
  pricingValue: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2 },
  pricingDivider: { width: 1, height: 32, backgroundColor: "#222" },
});
