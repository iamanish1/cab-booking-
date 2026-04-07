import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { requestOtp, verifyOtp } from "../services/driverApi";
import { DriverProfile } from "../helpers/types";

type AuthMode = "LOGIN" | "REGISTER";

interface Props {
  onAuthenticated: (driver: DriverProfile) => void;
}

export default function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<AuthMode>("LOGIN");
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [otpPreview, setOtpPreview] = useState("");

  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [vehicleCapacity, setVehicleCapacity] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");

  const isLogin = mode === "LOGIN";

  const canSendOTP =
    mobile.length === 10 &&
    (isLogin || (name.trim() && city.trim() && vehicleCapacity && vehicleNumber.trim()));

  const sendOTP = async () => {
    try {
      setLoading(true);
      const result = await requestOtp(mobile);
      setRequestId(result.requestId);
      if (result.otpPreview) setOtpPreview(result.otpPreview);
      setShowOTP(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndLogin = async () => {
    try {
      setLoading(true);
      const profile = isLogin
        ? { role: "driver" as const }
        : {
            role: "driver" as const,
            fullName: name,
            city,
            vehicleNumber,
            vehicleCapacity,
          };

      const result = await verifyOtp({ requestId, mobile, otp, profile });
      setShowOTP(false);
      onAuthenticated(result.driver);
    } catch (err: any) {
      Alert.alert("Invalid OTP", err.message || "Please try again");
      setOtp("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brand}>DRIVER</Text>
          <Text style={styles.subTitle}>
            {isLogin ? "Sign in to drive" : "Register as a driver"}
          </Text>
        </View>

        <View style={styles.card}>
          {!isLogin && (
            <>
              <Input icon="person-outline" placeholder="Full name" value={name} onChangeText={setName} />
              <Input icon="location-outline" placeholder="City (e.g. Delhi)" value={city} onChangeText={setCity} />
              <Input
                icon="car-outline"
                placeholder="Vehicle number (e.g. DL01AB1234)"
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
              />
              <Input
                icon="people-outline"
                placeholder="Vehicle capacity (seats)"
                keyboardType="number-pad"
                value={vehicleCapacity}
                onChangeText={setVehicleCapacity}
              />
            </>
          )}

          <Input
            icon="call-outline"
            placeholder="Mobile number (10 digits)"
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={setMobile}
          />

          <Pressable
            style={[styles.primaryBtn, (!canSendOTP || loading) && styles.disabledBtn]}
            disabled={!canSendOTP || loading}
            onPress={sendOTP}
          >
            <Text style={styles.primaryText}>{loading ? "Sending..." : "Send OTP"}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => setMode((p) => (p === "LOGIN" ? "REGISTER" : "LOGIN"))}>
          <Text style={styles.switchText}>
            {isLogin ? "New driver? Register here" : "Already registered? Login"}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showOTP} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter OTP</Text>
            <Text style={styles.modalSub}>Sent to +91 {mobile}</Text>
            {otpPreview ? (
              <Text style={styles.otpPreviewText}>Dev preview: {otpPreview}</Text>
            ) : null}

            <TextInput
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              placeholder="••••••"
              placeholderTextColor="#999"
            />

            <Pressable
              style={[styles.primaryBtn, (otp.length !== 6 || loading) && styles.disabledBtn]}
              disabled={otp.length !== 6 || loading}
              onPress={verifyAndLogin}
            >
              <Text style={styles.primaryText}>{loading ? "Verifying..." : "Verify & Continue"}</Text>
            </Pressable>

            <Pressable onPress={() => { setShowOTP(false); setOtp(""); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

interface InputProps {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "phone-pad" | "number-pad";
}

function Input({ icon, placeholder, value, onChangeText, keyboardType = "default" }: InputProps) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color="#777" />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#777"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  header: { marginBottom: 36 },
  brand: { fontSize: 32, fontWeight: "800", color: "#000", letterSpacing: 2 },
  subTitle: { color: "#666", marginTop: 6, fontSize: 14 },
  card: { backgroundColor: "#000", borderRadius: 16, padding: 20, marginBottom: 20 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
    paddingVertical: 12,
    gap: 10,
  },
  input: { flex: 1, color: "#fff", fontSize: 15 },
  primaryBtn: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    alignItems: "center",
  },
  disabledBtn: { opacity: 0.4 },
  primaryText: { color: "#000", fontWeight: "700", fontSize: 15 },
  switchText: { textAlign: "center", color: "#000", fontWeight: "600", marginTop: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#000" },
  modalSub: { color: "#666", marginVertical: 6 },
  otpPreviewText: { color: "#16a34a", fontSize: 12, marginBottom: 4 },
  otpInput: {
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    fontSize: 22,
    letterSpacing: 10,
    textAlign: "center",
    paddingVertical: 14,
    marginVertical: 20,
    color: "#000",
  },
  cancelText: { textAlign: "center", marginTop: 14, color: "#666" },
});
