import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getWalletSummary, getWalletTransactions } from "../../services/customerApi";
import { formatCurrency, formatRelativeDate } from "../../utils/location";
import type { WalletSummary, WalletTransaction } from "../../types";

interface Props {
  walletSummary: WalletSummary | null;
  onWalletUpdated: (w: WalletSummary) => void;
}

export default function CustomerWalletScreen({ walletSummary, onWalletUpdated }: Props) {
  const [summary, setSummary] = useState<WalletSummary | null>(walletSummary);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(
    walletSummary?.recentTransactions || []
  );
  const [loading, setLoading] = useState(!walletSummary);

  useEffect(() => {
    setSummary(walletSummary);
    setTransactions(walletSummary?.recentTransactions || []);
  }, [walletSummary]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        setLoading(true);
        const [s, t] = await Promise.all([getWalletSummary(), getWalletTransactions(30)]);
        if (!ignore) {
          setSummary(s);
          setTransactions(t.items || []);
          onWalletUpdated(s);
        }
      } catch { /* silent */ } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  const completed = summary?.cashbackProgress?.completedTrips || 0;
  const target = summary?.cashbackProgress?.targetTrips || 10;
  const progress = Math.min(1, completed / target);

  return (
    <View style={styles.container}>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Wallet Balance</Text>
        <Text style={styles.balanceAmount}>{formatCurrency(summary?.balance)}</Text>

        {/* Cashback progress */}
        <View style={styles.cashbackSection}>
          <View style={styles.cashbackHeader}>
            <Text style={styles.cashbackTitle}>Cashback Progress</Text>
            <Text style={styles.cashbackCount}>{completed}/{target} trips</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={styles.cashbackNote}>
            {summary?.cashbackProgress?.remainingTrips || target - completed} more trip{(target - completed) !== 1 ? "s" : ""} to earn cashback
          </Text>
        </View>
      </View>

      {/* Transaction list */}
      <Text style={styles.sectionTitle}>Transaction History</Text>

      {loading ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
      ) : transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySub}>Complete a ride to see your history</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.txItem}>
              <View style={[styles.txIcon, item.direction === "credit" ? styles.creditIcon : styles.debitIcon]}>
                <Ionicons
                  name={item.direction === "credit" ? "arrow-down-outline" : "arrow-up-outline"}
                  size={16}
                  color={item.direction === "credit" ? "#4ade80" : "#ef4444"}
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txTitle}>{item.title}</Text>
                <Text style={styles.txDate}>{formatRelativeDate(item.createdAt)}</Text>
              </View>
              <Text style={[styles.txAmount, item.direction === "credit" ? styles.creditAmount : styles.debitAmount]}>
                {item.direction === "credit" ? "+" : "−"}{formatCurrency(item.amount)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  balanceCard: {
    margin: 16, backgroundColor: "#0f0f0f", borderRadius: 20,
    padding: 24, borderWidth: 1, borderColor: "#1a1a1a",
  },
  balanceLabel: { color: "#666", fontSize: 13, fontWeight: "600", textTransform: "uppercase" },
  balanceAmount: { color: "#fff", fontSize: 42, fontWeight: "900", marginVertical: 8 },
  cashbackSection: { marginTop: 16 },
  cashbackHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  cashbackTitle: { color: "#777", fontSize: 13 },
  cashbackCount: { color: "#fff", fontSize: 13, fontWeight: "700" },
  progressBar: { height: 6, backgroundColor: "#1a1a1a", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#4ade80", borderRadius: 3 },
  cashbackNote: { color: "#555", fontSize: 12, marginTop: 8 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginHorizontal: 16, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  txItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#0f0f0f" },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 12 },
  creditIcon: { backgroundColor: "#052010" },
  debitIcon: { backgroundColor: "#200505" },
  txInfo: { flex: 1 },
  txTitle: { color: "#fff", fontSize: 14, fontWeight: "600" },
  txDate: { color: "#555", fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "700" },
  creditAmount: { color: "#4ade80" },
  debitAmount: { color: "#ef4444" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyText: { color: "#666", fontSize: 16, fontWeight: "600", marginTop: 12 },
  emptySub: { color: "#444", fontSize: 13, marginTop: 6 },
});
