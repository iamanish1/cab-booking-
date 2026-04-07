import React, { useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BOTTOM_BAR_HEIGHT } from "../components/BottomBar";
import { getWalletSummary, getWalletTransactions } from "../services/customerApi";
import { formatCurrency, formatRelativeDate } from "../utils/location";

export default function Wallet({ walletSummary, onWalletUpdated }) {
  const [summary, setSummary] = useState(walletSummary);
  const [transactions, setTransactions] = useState(walletSummary?.recentTransactions || []);

  useEffect(() => {
    setSummary(walletSummary);
    setTransactions(walletSummary?.recentTransactions || []);
  }, [walletSummary]);

  useEffect(() => {
    let ignore = false;

    const loadWallet = async () => {
      try {
        const [summaryResponse, transactionsResponse] = await Promise.all([
          getWalletSummary(),
          getWalletTransactions(20),
        ]);

        if (!ignore) {
          setSummary(summaryResponse);
          setTransactions(transactionsResponse.items || []);
          onWalletUpdated(summaryResponse);
        }
      } catch {
        return null;
      }
      return null;
    };

    loadWallet();

    return () => {
      ignore = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const completedTrips = summary?.cashbackProgress?.completedTrips || 0;
  const cashbackTargetTrips = summary?.cashbackProgress?.targetTrips || 10;
  const remainingTrips = summary?.cashbackProgress?.remainingTrips || 0;
  const progress = cashbackTargetTrips
    ? (completedTrips / cashbackTargetTrips) * 100
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Wallet</Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(summary?.balance || 0)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Cashback Progress</Text>

          <Text style={styles.primaryText}>
            {completedTrips} / {cashbackTargetTrips} Trips
          </Text>

          <Text style={styles.secondaryText}>
            Complete {remainingTrips} more trips to unlock cashback
          </Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Summary</Text>

          <View style={styles.row}>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              <Text style={styles.statValue}>{completedTrips}</Text>
              <Text style={styles.statLabel}>Completed Trips</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="gift-outline" size={22} color="#fff" />
              <Text style={styles.statValue}>{remainingTrips}</Text>
              <Text style={styles.statLabel}>Trips Remaining</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>

          <FlatList
            data={transactions}
            keyExtractor={(item) => item._id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.divider} />}
            renderItem={({ item }) => (
              <View style={styles.transactionRow}>
                <View>
                  <Text style={styles.transactionTitle}>{item.title}</Text>
                  <Text style={styles.transactionDate}>{formatRelativeDate(item.createdAt)}</Text>
                </View>

                <Text style={styles.transactionAmount}>
                  {item.direction === "credit" ? "+" : "-"} {formatCurrency(item.amount)}
                </Text>
              </View>
            )}
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color="#A1A1A1" />
          <Text style={styles.infoText}>
            Balance updates automatically after each completed trip.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingBottom: BOTTOM_BAR_HEIGHT,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  balanceLabel: {
    color: "#555",
    fontSize: 13,
    marginBottom: 6,
  },
  balanceValue: {
    color: "#000",
    fontSize: 32,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#111",
    borderRadius: 18,
    padding: 20,
    marginBottom: 28,
  },
  cardLabel: {
    color: "#A1A1A1",
    fontSize: 13,
    marginBottom: 8,
  },
  primaryText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  secondaryText: {
    color: "#A1A1A1",
    fontSize: 14,
    marginBottom: 16,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#222",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  statValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
  },
  statLabel: {
    color: "#A1A1A1",
    fontSize: 12,
    marginTop: 4,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  transactionTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  transactionDate: {
    color: "#777",
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#222",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0D0D0D",
    padding: 14,
    borderRadius: 12,
  },
  infoText: {
    color: "#A1A1A1",
    fontSize: 13,
    flex: 1,
  },
});
