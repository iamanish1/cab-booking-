import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTrips, updateProfile } from "../../services/customerApi";
import { formatCurrency, formatRelativeDate } from "../../utils/location";
import type { NormalizedCustomer, WalletSummary } from "../../types";

interface Props {
  userData: NormalizedCustomer;
  walletSummary: WalletSummary | null;
  onUserUpdated: (updater: (prev: NormalizedCustomer) => NormalizedCustomer) => void;
  onLogout: () => void;
}

export default function CustomerProfileScreen({ userData, walletSummary, onUserUpdated, onLogout }: Props) {
  const [modal, setModal] = useState<"EDIT" | "TRIPS" | null>(null);
  const [editName, setEditName] = useState(userData.fullName || "");
  const [editArea, setEditArea] = useState(userData.defaultArea || "");
  const [trips, setTrips] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [saving, setSaving] = useState(false);

  const initials = userData.fullName
    ? userData.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const loadTrips = async () => {
    try {
      setLoadingTrips(true);
      const res = await getTrips();
      setTrips(res.rides || []);
      setModal("TRIPS");
    } catch (err: any) {
      Alert.alert("Trips unavailable", err.message);
    } finally {
      setLoadingTrips(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const updated = await updateProfile({ fullName: editName, defaultArea: editArea });
      onUserUpdated((prev) => ({
        ...prev,
        fullName: updated.fullName,
        defaultArea: updated.defaultArea,
      }));
      setModal(null);
    } catch (err: any) {
      Alert.alert("Update failed", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={styles.heroSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{userData.fullName}</Text>
          <Text style={styles.mobile}>+91 {userData.mobile}</Text>
        </View>

        {/* Wallet balance */}
        {walletSummary && (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            <Text style={styles.balanceValue}>{formatCurrency(walletSummary.balance)}</Text>
            {walletSummary.cashbackProgress && (
              <Text style={styles.cashbackText}>
                {walletSummary.cashbackProgress.remainingTrips} trips until next cashback
              </Text>
            )}
          </View>
        )}

        {/* Info rows */}
        <View style={styles.infoCard}>
          <InfoRow icon="location-outline" label="Area" value={userData.defaultArea || userData.city || "Jammu"} />
          <InfoRow icon="business-outline" label="City" value={userData.city || "Jammu"} />
        </View>

        {/* Actions */}
        <View style={styles.actionsCard}>
          <ActionBtn icon="create-outline" label="Edit Profile" onPress={() => setModal("EDIT")} />
          <View style={styles.actionDivider} />
          <ActionBtn
            icon="receipt-outline"
            label="My Trips"
            loading={loadingTrips}
            onPress={loadTrips}
          />
        </View>

        <Pressable style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      {/* Edit profile modal */}
      <Modal visible={modal === "EDIT"} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
              placeholderTextColor="#555"
            />
            <Text style={styles.modalLabel}>Default Area</Text>
            <TextInput
              style={styles.modalInput}
              value={editArea}
              onChangeText={setEditArea}
              placeholder="e.g. Railway Station"
              placeholderTextColor="#555"
            />
            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              disabled={saving}
              onPress={saveProfile}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
            </Pressable>
            <Pressable onPress={() => setModal(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Trips modal */}
      <Modal visible={modal === "TRIPS"} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "75%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={styles.modalTitle}>My Trips</Text>
              <Pressable onPress={() => setModal(null)}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>
            {trips.length === 0
              ? <Text style={styles.emptyText}>No trips yet</Text>
              : <FlatList
                  data={trips}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => (
                    <View style={styles.tripItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tripRoute} numberOfLines={1}>
                          {item.pickup?.label} → {item.drop?.label}
                        </Text>
                        <Text style={styles.tripMeta}>{formatRelativeDate(item.completedAt)} · {item.rideType}</Text>
                      </View>
                      <Text style={styles.tripFare}>{formatCurrency(item.finalFare)}</Text>
                    </View>
                  )}
                />}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="#666" />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, loading }: { icon: any; label: string; onPress: () => void; loading?: boolean }) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.actionLabel}>{loading ? "Loading..." : label}</Text>
      <Ionicons name="chevron-forward-outline" size={16} color="#444" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
  heroSection: { alignItems: "center", marginBottom: 28 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center",
    marginBottom: 12, borderWidth: 2, borderColor: "#333",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  name: { color: "#fff", fontSize: 22, fontWeight: "700" },
  mobile: { color: "#666", fontSize: 14, marginTop: 4 },
  balanceCard: {
    backgroundColor: "#0f0f0f", borderRadius: 18, padding: 20,
    alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#1a1a1a",
  },
  balanceLabel: { color: "#666", fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  balanceValue: { color: "#fff", fontSize: 34, fontWeight: "900", marginVertical: 6 },
  cashbackText: { color: "#4ade80", fontSize: 13 },
  infoCard: { backgroundColor: "#0f0f0f", borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#1a1a1a" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  infoContent: {},
  infoLabel: { color: "#555", fontSize: 12 },
  infoValue: { color: "#fff", fontSize: 15, fontWeight: "600", marginTop: 2 },
  actionsCard: { backgroundColor: "#0f0f0f", borderRadius: 18, overflow: "hidden", marginBottom: 24, borderWidth: 1, borderColor: "#1a1a1a" },
  actionBtn: { flexDirection: "row", alignItems: "center", padding: 18, gap: 14 },
  actionLabel: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "600" },
  actionDivider: { height: 1, backgroundColor: "#1a1a1a" },
  logoutBtn: { paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: "#ef444433", alignItems: "center" },
  logoutText: { color: "#ef4444", fontWeight: "700", fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#0f0f0f", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: "#1a1a1a" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 20 },
  modalLabel: { color: "#666", fontSize: 13, marginBottom: 6 },
  modalInput: {
    backgroundColor: "#1a1a1a", borderRadius: 12, padding: 14, color: "#fff",
    fontSize: 15, marginBottom: 16, borderWidth: 1, borderColor: "#222",
  },
  saveBtn: { backgroundColor: "#fff", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#000", fontWeight: "800", fontSize: 15 },
  cancelText: { color: "#666", textAlign: "center", marginTop: 16, fontSize: 14 },
  emptyText: { color: "#666", textAlign: "center", paddingVertical: 24 },
  tripItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  tripRoute: { color: "#fff", fontSize: 14, fontWeight: "600" },
  tripMeta: { color: "#666", fontSize: 12, marginTop: 3 },
  tripFare: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
