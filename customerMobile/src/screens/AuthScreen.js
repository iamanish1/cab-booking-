import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { fetchPopularLocations, requestOtp, verifyOtp } from "../services/customerApi";

function PrimaryButton({ title, onPress, disabled = false, loading = false }) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <Text style={[styles.primaryButtonText, disabled && styles.primaryButtonTextDisabled]}>
        {loading ? "Please wait..." : title}
      </Text>
    </TouchableOpacity>
  );
}

export default function AuthScreen({ onAuthenticated }) {
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [areas, setAreas] = useState([
    "Connaught Place",
    "Dwarka",
    "Rohini",
    "Karol Bagh",
    "Saket",
  ]);
  const [requestId, setRequestId] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    const loadAreas = async () => {
      try {
        const result = await fetchPopularLocations("Delhi");
        if (result?.locations?.length) {
          setAreas(result.locations);
        }
      } catch {
        return null;
      }
      return null;
    };

    loadAreas();
  }, []);

  const handleSendOtp = async () => {
    try {
      setSendingOtp(true);
      const response = await requestOtp(mobileNumber);
      setRequestId(response.requestId);
      setOtpSent(true);

      if (response.otpPreview) {
        Alert.alert("OTP for local testing", `Use ${response.otpPreview}`);
      }
    } catch (error) {
      Alert.alert("Could not send OTP", error.message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setVerifyingOtp(true);
      await verifyOtp({
        requestId,
        mobile: mobileNumber,
        otp,
        profile: {
          fullName,
          city: "Delhi",
          defaultArea: selectedArea,
        },
      });
      await onAuthenticated();
    } catch (error) {
      Alert.alert("Sign in failed", error.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const isSendOtpEnabled =
    fullName.trim().length > 1 && mobileNumber.length === 10 && selectedArea.length > 0;
  const isVerifyOtpEnabled = otp.length === 6 && requestId.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>CAB</Text>
          </View>
          <Text style={styles.title}>Customer Sign In</Text>
          <Text style={styles.subtitle}>Verify your phone to book rides</Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#999999"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Enter 10-digit mobile number"
                placeholderTextColor="#999999"
                value={mobileNumber}
                onChangeText={(text) => setMobileNumber(text.replace(/[^0-9]/g, "").slice(0, 10))}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Select Area</Text>
            <TouchableOpacity style={styles.areaSelector} onPress={() => setShowAreaModal(true)}>
              <Text style={selectedArea ? styles.areaSelectorTextFilled : styles.areaSelectorText}>
                {selectedArea || "Choose your area"}
              </Text>
              <Text style={styles.areaSelectorIcon}>v</Text>
            </TouchableOpacity>
          </View>

          {!otpSent ? (
            <PrimaryButton
              title="Send OTP"
              onPress={handleSendOtp}
              disabled={!isSendOtpEnabled}
              loading={sendingOtp}
            />
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Enter OTP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#999999"
                  value={otp}
                  onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>

              <PrimaryButton
                title="Verify OTP & Continue"
                onPress={handleVerifyOtp}
                disabled={!isVerifyOtpEnabled}
                loading={verifyingOtp}
              />
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Configure `EXPO_PUBLIC_API_URL` if you are running the backend on another device.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showAreaModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAreaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Area</Text>
              <TouchableOpacity onPress={() => setShowAreaModal(false)}>
                <Text style={styles.modalClose}>x</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {areas.map((area) => (
                <TouchableOpacity
                  key={area}
                  style={styles.areaOption}
                  onPress={() => {
                    setSelectedArea(area);
                    setShowAreaModal(false);
                  }}
                >
                  <Text style={styles.areaOptionText}>{area}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 30,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333333",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
  },
  formSection: {
    flex: 1,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#FAFAFA",
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  countryCodeBox: {
    height: 50,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
    marginRight: 10,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  phoneInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#FAFAFA",
  },
  areaSelector: {
    height: 50,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  areaSelectorText: {
    fontSize: 16,
    color: "#999999",
  },
  areaSelectorTextFilled: {
    fontSize: 16,
    color: "#000000",
  },
  areaSelectorIcon: {
    fontSize: 12,
    color: "#666666",
  },
  primaryButton: {
    height: 50,
    backgroundColor: "#000000",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  primaryButtonDisabled: {
    backgroundColor: "#CCCCCC",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  primaryButtonTextDisabled: {
    color: "#999999",
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
  },
  modalClose: {
    fontSize: 24,
    color: "#666666",
  },
  areaOption: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  areaOptionText: {
    fontSize: 16,
    color: "#000000",
  },
});
