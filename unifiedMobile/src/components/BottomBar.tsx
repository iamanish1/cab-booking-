import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CustomerScreen } from "../types";

export const BOTTOM_BAR_HEIGHT = 88;

interface Props {
  screen: CustomerScreen;
  setScreen: (s: CustomerScreen) => void;
}

const TABS: Array<{ name: CustomerScreen["NAME"]; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { name: "HOME", label: "Home", icon: "home-outline" },
  { name: "WALLET", label: "Wallet", icon: "wallet-outline" },
  { name: "PROFILE", label: "Profile", icon: "person-outline" },
];

export default function BottomBar({ screen, setScreen }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {TABS.map(({ name, label, icon }) => {
          const isActive = screen.NAME === name;
          return (
            <Pressable
              key={name}
              onPress={() => setScreen({ NAME: name, DATA: {} } as CustomerScreen)}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name={icon} size={22} color={isActive ? "#fff" : "#555"} />
              <Text style={[styles.label, { color: isActive ? "#fff" : "#555" }]}>{label}</Text>
              {isActive && <View style={styles.dot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", bottom: 0, width: "100%" },
  bar: {
    height: BOTTOM_BAR_HEIGHT,
    backgroundColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 28,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -6 } },
      android: { elevation: 20 },
    }),
  },
  item: { flex: 1, alignItems: "center", gap: 4 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  dot: { marginTop: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
});
