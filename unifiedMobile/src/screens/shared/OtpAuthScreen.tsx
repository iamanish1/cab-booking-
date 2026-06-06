import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { UserRole, DriverProfile, NormalizedCustomer } from "../../types";
import * as customerApi from "../../services/customerApi";
import * as driverApi from "../../services/driverApi";
import { fetchPopularLocations } from "../../services/customerApi";

interface Props {
  role: UserRole;
  onBack: () => void;
  onAuthenticated: () => void;
}

export default function OtpAuthScreen({ role, onBack, onAuthenticated }: Props) {
  const isDriver = role === "driver";

  const [step, setStep] = useState<"form" | "otp">("form");
  const [mode, setMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [otpPreview, setOtpPreview] = useState("");

  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");

  // Customer-specific
  const [fullName, setFullName] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [areas, setAreas] = useState([
    "Railway Station", "Bus Stand", "Raghunath Market",
    "Gandhi Nagar", "Trikuta Nagar", "Bakshi Nagar",
    "GMC Hospital", "Airport",
  ]);
  const [showAreaModal, setShowAreaModal] = useState(false);

  // Driver-specific
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleCapacity, setVehicleCapacity] = useState("");

  useEffect(() => {
    if (!isDriver) {
      fetchPopularLocations("Jammu")
        .then((res) => { if (res?.locations?.length) setAreas(res.locations); })
        .catch(() => {});
    }
  }, [isDriver]);

  const isLoginMode = mode === "LOGIN";

  const canSendOtp = isDriver
    ? mobile.length === 10 && (isLoginMode || (driverName.trim().length > 1 && vehicleNumber.trim() && vehicleCapacity.trim()))
    : mobile.length === 10 && fullName.trim().length > 1 && selectedArea.length > 0;

  const sendOtp = async () => {
    try {
      setLoading(true);
      const fn = isDriver ? driverApi.requestOtp : customerApi.requestOtp;
      const result = await fn(mobile);
      setRequestId(result.requestId);
      if (result.otpPreview) setOtpPreview(result.otpPreview);
      setStep("otp");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndLogin = async () => {
    try {
      setLoading(true);
      if (isDriver) {
        const profile = isLoginMode
          ? { role: "driver" as const }
          : { role: "driver" as const, fullName: driverName, city: "Jammu", vehicleNumber, vehicleCapacity };
        await driverApi.verifyOtp({ requestId, mobile, otp, profile });
      } else {
        await customerApi.verifyOtp({
          requestId, mobile, otp,
          profile: { fullName, city: "Jammu", defaultArea: selectedArea },
        });
      }
      onAuthenticated();
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
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.brand}>{isDriver ? "Driver Login" : "Passenger Login"}</Text>
          <Text style={styles.sub}>{isDriver ? "Sign in to start driving" : "Sign in to book rides"}</Text>
        </View>

        <View style={styles.card}>
          {/* Customer fields */}
          {!isDriver && (
            <>
              <InputRow icon="person-outline" placeholder="Full name" value={fullName} onChangeText={setFullName} />
              <Pressable style={styles.areaRow} onPress={() => setShowAreaModal(true)}>
                <Ionicons name="location-outline" size={18} color="#777" style={{ marginRight: 10 }} />
                <Text style={[styles.areaText, selectedArea ? styles.areaFilled : null]}>
                  {selectedArea || "Select your area in Jammu"}
                </Text>
                <Ionicons name="chevron-down-outline" size={16} color="#555" />
              </Pressable>
            </>
          )}

          {/* Driver register fields */}
          {isDriver && mode === "REGISTER" && (
            <>
              <InputRow icon="person-outline" placeholder="Full name" value={driverName} onChangeText={setDriverName} />
              <InputRow icon="car-outline" placeholder="Vehicle number (e.g. JK01AB1234)" value={vehicleNumber} onChangeText={setVehicleNumber} />
              <InputRow icon="people-outline" placeholder="Vehicle capacity (seats)" keyboardType="number-pad" value={vehicleCapacity} onChangeText={setVehicleCapacity} />
            </>
          )}

          {/* Mobile */}
          <InputRow
            icon="call-outline"
            placeholder="Mobile number (10 digits)"
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={(t) => setMobile(t.replace(/\D/g, "").slice(0, 10))}
          />

          <Pressable
            style={[styles.primaryBtn, (!canSendOtp || loading) && styles.disabled]}
            disabled={!canSendOtp || loading}
            onPress={sendOtp}
          >
            <Text style={styles.primaryText}>{loading ? "Sending OTP..." : "Send OTP"}</Text>
          </Pressable>
        </View>

        {isDriver && (
          <Pressable onPress={() => setMode((m) => m === "LOGIN" ? "REGISTER" : "LOGIN")}>
            <Text style={styles.switchText}>
              {isLoginMode ? "New driver? Register here" : "Already registered? Login"}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* OTP Modal */}
      <Modal visible={step === "otp"} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter OTP</Text>
            <Text style={styles.modalSub}>Sent to +91 {mobile}</Text>
            {otpPreview ? (
              <Text style={styles.otpPreview}>Dev OTP: {otpPreview}</Text>
            ) : null}
            <TextInput
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              placeholder="• • • • • •"
              placeholderTextColor="#555"
              autoFocus
            />
            <Pressable
              style={[styles.primaryBtn, (otp.length !== 6 || loading) && styles.disabled]}
              disabled={otp.length !== 6 || loading}
              onPress={verifyAndLogin}
            >
              <Text style={styles.primaryText}>{loading ? "Verifying..." : "Verify & Continue"}</Text>
            </Pressable>
            <Pressable onPress={() => { setStep("form"); setOtp(""); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Area picker modal */}
      <Modal visible={showAreaModal} transparent animationType="slide" onRequestClose={() => setShowAreaModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "70%" }]}>
            <View style={styles.areaModalHeader}>
              <Text style={styles.modalTitle}>Select Area</Text>
              <Pressable onPress={() => setShowAreaModal(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>
            <ScrollView>
              {areas.map((area) => (
                <Pressable
                  key={area}
                  style={styles.areaOption}
                  onPress={() => { setSelectedArea(area); setShowAreaModal(false); }}
                >
                  <Text style={styles.areaOptionText}>{area}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

interface InputRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: "default" | "phone-pad" | "number-pad";
}
function InputRow({ icon, placeholder, value, onChangeText, keyboardType = "default" }: InputRowProps) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color="#777" />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#555"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.input}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  header: { marginBottom: 32 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#111",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  brand: { fontSize: 28, fontWeight: "900", color: "#fff" },
  sub: { color: "#666", marginTop: 6, fontSize: 14 },
  card: { backgroundColor: "#0f0f0f", borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: "#1a1a1a" },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: "#1f1f1f",
    paddingVertical: 14, gap: 10,
  },
  input: { flex: 1, color: "#fff", fontSize: 15 },
  areaRow: {
    flexDirection: "row", alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: "#1f1f1f",
    paddingVertical: 14,
  },
  areaText: { flex: 1, color: "#555", fontSize: 15 },
  areaFilled: { color: "#fff" },
  primaryBtn: {
    backgroundColor: "#fff", paddingVertical: 15, borderRadius: 14,
    marginTop: 24, alignItems: "center",
  },
  disabled: { opacity: 0.4 },
  primaryText: { color: "#000", fontWeight: "800", fontSize: 15 },
  switchText: { textAlign: "center", color: "#888", fontWeight: "600", marginTop: 10, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#0f0f0f", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderWidth: 1, borderColor: "#1f1f1f",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  modalSub: { color: "#666", marginVertical: 6, fontSize: 14 },
  otpPreview: { color: "#4ade80", fontSize: 12, marginBottom: 4 },
  otpInput: {
    borderBottomWidth: 2, borderBottomColor: "#fff",
    fontSize: 28, letterSpacing: 12, textAlign: "center",
    paddingVertical: 16, marginVertical: 20, color: "#fff",
  },
  cancelText: { textAlign: "center", marginTop: 16, color: "#666", fontSize: 14 },
  areaModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  areaOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  areaOptionText: { color: "#fff", fontSize: 16 },
});
