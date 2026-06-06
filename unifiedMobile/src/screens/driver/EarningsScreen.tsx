import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getDriverEarnings } from "../../services/driverApi";
import { getSession } from "../../services/session";

interface RecentRide {
  _id: string;
  finalFare?: number;
  quotedFare?: number;
  completedAt?: string;
  rideType?: string;
}

interface EarningsData {
  totalEarnings: number;
  totalRides: number;
  todayEarnings: number;
  todayRides: number;
  recentRides: RecentRide[];
}

interface Props {
  onBack: () => void;
}

export default function EarningsScreen({ onBack }: Props) {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = getSession();
    if (!session) return;
    try {
      setLoading(true);
      setError(null);
      const result = await getDriverEarnings(session.userId);
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#000" />
        </Pressable>
        <Text style={styles.title}>My Earnings</Text>
        <Pressable onPress={load} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#6b7280" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : data ? (
        <FlatList
          data={data.recentRides}
          keyExtractor={(r) => r._id}
          ListHeaderComponent={
            <>
              {/* Summary cards */}
              <View style={styles.cardRow}>
                <SummaryCard
                  label="Today's Earnings"
                  value={`₹${data.todayEarnings}`}
                  sub={`${data.todayRides} ride${data.todayRides !== 1 ? "s" : ""}`}
                  highlight
                />
                <SummaryCard
                  label="Total Earnings"
                  value={`₹${data.totalEarnings}`}
                  sub={`${data.totalRides} ride${data.totalRides !== 1 ? "s" : ""} total`}
                />
              </View>

              <Text style={styles.sectionLabel}>Recent Trips</Text>
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.rideRow}>
              <View style={styles.rideLeft}>
                <View style={[styles.typeBadge, item.rideType === "shared" && styles.typeBadgeShared]}>
                  <Text style={styles.typeText}>{item.rideType === "shared" ? "Shared" : "Personal"}</Text>
                </View>
                <Text style={styles.rideDate}>{formatDate(item.completedAt)}</Text>
              </View>
              <Text style={styles.rideFare}>₹{item.finalFare ?? item.quotedFare ?? 0}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🛺</Text>
              <Text style={styles.emptyText}>No completed rides yet</Text>
              <Text style={styles.emptySub}>Go online and start accepting rides to see your earnings here.</Text>
            </View>
          }
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </SafeAreaView>
  );
}

function SummaryCard({ label, value, sub, highlight }: {
  label: string; value: string; sub: string; highlight?: boolean;
}) {
  return (
    <View style={[styles.summaryCard, highlight && styles.summaryCardHighlight]}>
      <Text style={[styles.summaryLabel, highlight && styles.summaryLabelLight]}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryValueLight]}>{value}</Text>
      <Text style={[styles.summarySub, highlight && styles.summarySubLight]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  backBtn: { padding: 4 },
  refreshBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "800", color: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: "#ef4444", fontSize: 15, textAlign: "center", marginBottom: 16 },
  retryBtn: { backgroundColor: "#000", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: "#fff", fontWeight: "700" },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1, backgroundColor: "#f5f5f5", borderRadius: 20, padding: 16,
  },
  summaryCardHighlight: { backgroundColor: "#000" },
  summaryLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  summaryLabelLight: { color: "#9ca3af" },
  summaryValue: { fontSize: 26, fontWeight: "900", color: "#000" },
  summaryValueLight: { color: "#fff" },
  summarySub: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  summarySubLight: { color: "#6b7280" },
  sectionLabel: { fontSize: 15, fontWeight: "800", color: "#000", marginBottom: 12 },
  rideRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  rideLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  typeBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  typeBadgeShared: { backgroundColor: "#dbeafe" },
  typeText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  rideDate: { fontSize: 13, color: "#9ca3af" },
  rideFare: { fontSize: 17, fontWeight: "800", color: "#16a34a" },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: "800", color: "#000", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#9ca3af", textAlign: "center", lineHeight: 20 },
});
