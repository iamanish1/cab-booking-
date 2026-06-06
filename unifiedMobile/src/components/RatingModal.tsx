import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  driverName?: string;
  fare?: number;
  onSubmit: (rating: number) => void;
  onSkip: () => void;
}

export default function RatingModal({ visible, driverName, fare, onSubmit, onSkip }: Props) {
  const [selected, setSelected] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await onSubmit(selected);
    } finally {
      setSubmitting(false);
      setSelected(0);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>✅</Text>
          <Text style={styles.title}>Trip Completed!</Text>
          {fare !== undefined && (
            <Text style={styles.fare}>Total fare: ₹{fare}</Text>
          )}
          <Text style={styles.sub}>How was your ride{driverName ? ` with ${driverName}` : ""}?</Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setSelected(star)} style={styles.starBtn}>
                <Text style={[styles.star, { color: star <= selected ? "#f59e0b" : "#d1d5db" }]}>
                  ★
                </Text>
              </Pressable>
            ))}
          </View>

          {selected > 0 && (
            <Text style={styles.ratingLabel}>{LABELS[selected]}</Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.skipBtn} onPress={onSkip} disabled={submitting}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable
              style={[styles.submitBtn, (!selected || submitting) && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!selected || submitting}
            >
              <Text style={styles.submitText}>{submitting ? "Submitting..." : "Rate Driver"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 44,
    alignItems: "center",
  },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "900", color: "#000", marginBottom: 4 },
  fare: { fontSize: 18, fontWeight: "700", color: "#16a34a", marginBottom: 8 },
  sub: { fontSize: 15, color: "#6b7280", marginBottom: 24, textAlign: "center" },
  stars: { flexDirection: "row", gap: 8, marginBottom: 8 },
  starBtn: { padding: 4 },
  star: { fontSize: 44 },
  ratingLabel: { fontSize: 14, color: "#6b7280", marginBottom: 20, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 12, width: "100%", marginTop: 16 },
  skipBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 16,
    borderWidth: 1.5, borderColor: "#e5e7eb", alignItems: "center",
  },
  skipText: { fontWeight: "700", color: "#6b7280", fontSize: 15 },
  submitBtn: {
    flex: 2, paddingVertical: 16, borderRadius: 16,
    backgroundColor: "#000", alignItems: "center",
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontWeight: "800", color: "#fff", fontSize: 15 },
});
