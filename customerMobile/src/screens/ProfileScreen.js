import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTrips, updateProfile } from "../services/customerApi";
import { formatCurrency } from "../utils/location";

export default function ProfileScreen({ userData, walletSummary, onUserUpdated, onLogout }) {
  const [activeModal, setActiveModal] = useState(null);
  const [editName, setEditName] = useState(userData?.fullName || "");
  const [editArea, setEditArea] = useState(userData?.defaultArea || userData?.city || "");
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [saving, setSaving] = useState(false);

  const initials =
    userData?.fullName
      ?.split(" ")
      .map((name) => name[0])
      .join("")
      .toUpperCase() || "U";

  const loadTrips = async () => {
    try {
      setLoadingTrips(true);
      const response = await getTrips();
      setTrips(response.rides || []);
      setActiveModal("MY_TRIPS");
    } catch (error) {
      Alert.alert("Trips unavailable", error.message);
    } finally {
      setLoadingTrips(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const updated = await updateProfile({
        fullName: editName,
        defaultArea: editArea,
      });

      onUserUpdated((currentUser) => ({
        ...currentUser,
        fullName: updated.fullName,
        city: updated.city,
        defaultArea: updated.defaultArea,
      }));
      setActiveModal(null);
    } catch (error) {
      Alert.alert("Profile update failed", error.message);
    } finally {
      setSaving(false);
    }
  };

  const Row = ({ icon, label, onPress }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={styles.rowText}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#777" />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <Text style={styles.name}>{userData?.fullName}</Text>
        <Text style={styles.sub}>
          +91 {userData?.mobileNumber} - {userData?.defaultArea || userData?.city}
        </Text>
      </View>

      <View style={styles.upiCard}>
        <Text style={styles.upiLabel}>UPI Wallet</Text>
        <Text style={styles.upiAmount}>{formatCurrency(walletSummary?.balance || 0)}</Text>
      </View>

      <View style={styles.section}>
        <Row icon="person-outline" label="Edit Profile" onPress={() => setActiveModal("EDIT_PROFILE")} />
        <Row
          icon="time-outline"
          label={loadingTrips ? "Loading Trips..." : "My Trips"}
          onPress={loadTrips}
        />
        <Row icon="help-circle-outline" label="Help & Support" onPress={() => null} />
      </View>

      <Pressable onPress={onLogout} style={styles.logout}>
        <Ionicons name="log-out-outline" size={20} color="#ff4444" />
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>

      <Modal transparent visible={activeModal === "EDIT_PROFILE"} animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Full Name"
              placeholderTextColor="#666"
              style={styles.input}
            />

            <TextInput
              value={editArea}
              onChangeText={setEditArea}
              placeholder="Preferred Area"
              placeholderTextColor="#666"
              style={styles.input}
            />

            <Pressable style={styles.primaryBtn} onPress={saveProfile}>
              <Text style={styles.primaryText}>{saving ? "Saving..." : "Save Changes"}</Text>
            </Pressable>

            <Pressable onPress={() => setActiveModal(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={activeModal === "MY_TRIPS"} animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Your Trips</Text>

            {trips.length ? (
              trips.map((trip) => (
                <View key={trip._id} style={styles.tripItem}>
                  <Text style={styles.tripMain}>
                    {trip.pickup?.label} -> {trip.drop?.label}
                  </Text>
                  <Text style={styles.tripSub}>
                    {formatCurrency(trip.finalFare || trip.quotedFare || trip.fareEstimate)} - {trip.status}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.tripSub}>No trips yet.</Text>
            )}

            <Pressable style={[styles.primaryBtn, { marginTop: 10 }]} onPress={() => setActiveModal(null)}>
              <Text style={styles.primaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  avatar: {
    height: 90,
    width: 90,
    borderRadius: 45,
    backgroundColor: "#1f1f1f",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  sub: {
    color: "#888",
    fontSize: 13,
    marginTop: 4,
  },
  upiCard: {
    backgroundColor: "#111",
    borderRadius: 14,
    padding: 18,
    marginBottom: 30,
  },
  upiLabel: {
    color: "#aaa",
    fontSize: 12,
  },
  upiAmount: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  section: {
    backgroundColor: "#0e0e0e",
    borderRadius: 14,
    overflow: "hidden",
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 30,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ff444420",
  },
  logoutText: {
    color: "#ff4444",
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#111",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#000",
    borderRadius: 12,
    padding: 14,
    color: "#fff",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  primaryBtn: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#000",
    fontWeight: "700",
  },
  cancelText: {
    textAlign: "center",
    marginTop: 12,
    color: "#777",
  },
  tripItem: {
    backgroundColor: "#000",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  tripMain: {
    color: "#fff",
    fontWeight: "600",
  },
  tripSub: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
});
