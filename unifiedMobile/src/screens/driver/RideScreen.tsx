import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  arriveAtPickup,
  cancelRide,
  completeRide,
  updateLocation,
  verifyRideOtp,
} from "../../services/driverApi";
import { subscribeToRideEvents } from "../../services/driverSocket";
import { getSession } from "../../services/session";
import type { ActiveDriverRide, DriverProfile } from "../../types";

interface Props {
  ride: ActiveDriverRide;
  driver: DriverProfile;
  onRideDone: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; sub: string; color: string }> = {
  DRIVER_ASSIGNED: { label: "Head to Pickup", sub: "Navigate to the passenger's pickup point", color: "#f59e0b" },
  DRIVER_ARRIVING: { label: "You've Arrived", sub: "Ask the passenger for their OTP", color: "#3b82f6" },
  VERIFY_CODE: { label: "Verify OTP", sub: "Enter the passenger's 4-digit OTP", color: "#8b5cf6" },
  ON_TRIP: { label: "Ride in Progress", sub: "Heading to the drop location", color: "#4ade80" },
  COMPLETED: { label: "Trip Completed!", sub: "Great job! You've completed this ride.", color: "#4ade80" },
  CANCELLED_BY_CUSTOMER: { label: "Ride Cancelled", sub: "The customer cancelled this ride.", color: "#ef4444" },
  CANCELLED_BY_DRIVER: { label: "Ride Cancelled", sub: "You cancelled this ride.", color: "#ef4444" },
};

function buildMapHTML(pickup: { lat: number; lng: number }, drop: { lat: number; lng: number }): string {
  const midLat = (pickup.lat + drop.lat) / 2;
  const midLng = (pickup.lng + drop.lng) / 2;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>*{margin:0;padding:0}html,body{width:100%;height:100%;background:#111}#map{width:100%;height:100%}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${midLat},${midLng}],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,subdomains:['a','b','c']}).addTo(map);
    var gI=L.divIcon({html:'<div style="font-size:24px">🟢</div>',className:'',iconSize:[24,24],iconAnchor:[12,12]});
    var rI=L.divIcon({html:'<div style="font-size:24px">🔴</div>',className:'',iconSize:[24,24],iconAnchor:[12,12]});
    var cI=L.divIcon({html:'<div style="font-size:28px">🛺</div>',className:'',iconSize:[28,28],iconAnchor:[14,14]});
    L.marker([${pickup.lat},${pickup.lng}],{icon:gI}).addTo(map).bindPopup('Pickup');
    L.marker([${drop.lat},${drop.lng}],{icon:rI}).addTo(map).bindPopup('Drop');
    var dM=null; var rl=null; var onTrip=false;
    map.fitBounds([[${pickup.lat},${pickup.lng}],[${drop.lat},${drop.lng}]],{padding:[50,50]});
    function refreshRoute(){
      if(rl){map.removeLayer(rl);rl=null;}
      if(dM){
        var dest=onTrip?[${drop.lat},${drop.lng}]:[${pickup.lat},${pickup.lng}];
        rl=L.polyline([dM.getLatLng(),dest],{color:'#3b82f6',weight:3,dashArray:'6,3'}).addTo(map);
      }
    }
    function onMsg(e){
      try{
        var d=JSON.parse(e.data);
        if(d.type==='driver'){
          if(!dM){dM=L.marker([d.lat,d.lng],{icon:cI}).addTo(map);}else{dM.setLatLng([d.lat,d.lng]);}
          refreshRoute();
        }
        if(d.type==='ontrip'){onTrip=d.value;refreshRoute();}
        if(d.type==='focus'){if(dM)map.setView(dM.getLatLng(),15);}
      }catch(_){}
    }
    document.addEventListener('message',onMsg); window.addEventListener('message',onMsg);
  </script>
</body>
</html>`;
}

export default function DriverRideScreen({ ride: initialRide, driver, onRideDone }: Props) {
  const [ride, setRide] = useState<ActiveDriverRide>(initialRide);
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [driverCoord, setDriverCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const locationWatch = useRef<Location.LocationSubscription | null>(null);
  const webViewRef = useRef<WebView>(null);

  const cfg = STATUS_CONFIG[ride.status] ?? { label: ride.status, sub: "", color: "#6b7280" };
  const isPreTrip = ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "VERIFY_CODE"].includes(ride.status);
  const isOnTrip = ride.status === "ON_TRIP";
  const isTerminal = ["COMPLETED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_DRIVER", "NO_DRIVER_AVAILABLE"].includes(ride.status);

  useEffect(() => {
    if (driverCoord && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `onMsg({data:JSON.stringify({type:'driver',lat:${driverCoord.latitude},lng:${driverCoord.longitude}})}); true;`
      );
    }
  }, [driverCoord]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      `onMsg({data:JSON.stringify({type:'ontrip',value:${isOnTrip}})}); true;`
    );
  }, [isOnTrip]);

  useEffect(() => {
    const unsub = subscribeToRideEvents(ride._id, (eventName, payload) => {
      if (payload?.status) setRide((prev) => ({ ...prev, status: payload.status }));
      if (eventName === "ride:otp_ready" || payload?.status === "VERIFY_CODE") setShowOtpModal(true);
      if (eventName === "ride:completed") setTimeout(onRideDone, 2500);
      if (eventName === "ride:cancelled") setTimeout(onRideDone, 2500);
    });
    return unsub;
  }, [ride._id]);

  useEffect(() => {
    if (isTerminal && ride.status !== "COMPLETED") {
      const t = setTimeout(onRideDone, 2500);
      return () => clearTimeout(t);
    }
  }, [ride.status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;
      const session = getSession();
      locationWatch.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (pos) => {
          if (cancelled) return;
          const { latitude, longitude } = pos.coords;
          setDriverCoord({ latitude, longitude });
          if (session) updateLocation(session.userId, latitude, longitude).catch(() => {});
        }
      );
    })();
    return () => { cancelled = true; locationWatch.current?.remove(); };
  }, []);

  const handleArrive = async () => {
    try {
      setLoading(true);
      await arriveAtPickup(ride._id);
      setRide((p) => ({ ...p, status: "DRIVER_ARRIVING" }));
    } catch (err: any) {
      if (err.message?.includes("does not allow")) setRide((p) => ({ ...p, status: "DRIVER_ARRIVING" }));
      else Alert.alert("Error", err.message);
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 4) return;
    try {
      setLoading(true);
      await verifyRideOtp(ride._id, otp);
      setRide((p) => ({ ...p, status: "ON_TRIP" }));
      setShowOtpModal(false);
      setOtp("");
    } catch (err: any) {
      Alert.alert("Wrong OTP", err.message || "Invalid OTP. Ask the passenger to refresh.");
    } finally { setLoading(false); }
  };

  const handleComplete = async () => {
    try {
      setLoading(true);
      await completeRide(ride._id, ride.quotedFare);
      setRide((p) => ({ ...p, status: "COMPLETED", finalFare: ride.quotedFare }));
      setShowCompleteModal(false);
      setTimeout(onRideDone, 2500);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    setShowCancelModal(false);
    try {
      await cancelRide(ride._id, "Cancelled by driver");
      onRideDone();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: buildMapHTML(ride.pickup, ride.drop) }}
        javaScriptEnabled scrollEnabled={false} bounces={false}
      />

      {/* Floating buttons */}
      <SafeAreaView style={styles.topButtons} pointerEvents="box-none">
        <Pressable style={styles.floatBtn} onPress={() => webViewRef.current?.injectJavaScript(`onMsg({data:JSON.stringify({type:'focus'})}); true;`)}>
          <Text style={styles.floatBtnText}>⊕</Text>
        </Pressable>
        {ride.customer?.mobile && (
          <Pressable style={[styles.floatBtn, styles.callFloatBtn]} onPress={() => Linking.openURL(`tel:${ride.customer!.mobile}`)}>
            <Text style={styles.floatBtnText}>📞</Text>
          </Pressable>
        )}
      </SafeAreaView>

      {/* Bottom card */}
      <View style={styles.card}>
        <View style={[styles.statusPill, { backgroundColor: cfg.color + "22" }]}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={styles.statusSub}>{cfg.sub}</Text>

        {/* Passenger info */}
        <View style={styles.passengerRow}>
          <View style={styles.passengerAvatar}>
            <Text style={styles.passengerInitial}>
              {ride.customer?.name ? ride.customer.name.charAt(0).toUpperCase() : "P"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.passengerName}>{ride.customer?.name || "Passenger"}</Text>
            <Text style={styles.passengerSub}>{ride.passengerCount} pax · {ride.rideType}</Text>
          </View>
          <View style={[styles.payBadge, ride.paymentMethod === "CASH" ? styles.cashBadge : styles.upiBadge]}>
            <Text style={styles.payBadgeText}>{ride.paymentMethod}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {isPreTrip && (
          <View style={styles.locBlock}>
            <Text style={styles.locDot}>●</Text>
            <View>
              <Text style={styles.locLabel}>PICKUP</Text>
              <Text style={styles.locText} numberOfLines={2}>{ride.pickup.label}</Text>
            </View>
          </View>
        )}

        {isOnTrip && (
          <View style={styles.locBlock}>
            <Text style={[styles.locDot, { color: "#ef4444" }]}>■</Text>
            <View>
              <Text style={styles.locLabel}>DROP</Text>
              <Text style={styles.locText} numberOfLines={2}>{ride.drop.label}</Text>
            </View>
          </View>
        )}

        <View style={styles.fareRow}>
          <View>
            <Text style={styles.fareLabel}>Fare</Text>
            <Text style={styles.fareAmount}>₹{ride.finalFare ?? ride.quotedFare}</Text>
          </View>
          <View>
            <Text style={styles.fareLabel}>Distance</Text>
            <Text style={styles.fareAmount}>{ride.distanceKm} km</Text>
          </View>
        </View>

        {ride.status === "DRIVER_ASSIGNED" && (
          <Pressable style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleArrive} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>I'VE ARRIVED AT PICKUP</Text>}
          </Pressable>
        )}

        {(ride.status === "DRIVER_ARRIVING" || ride.status === "VERIFY_CODE") && (
          <Pressable style={styles.primaryBtn} onPress={() => setShowOtpModal(true)}>
            <Text style={styles.primaryBtnText}>VERIFY PASSENGER OTP</Text>
          </Pressable>
        )}

        {isOnTrip && (
          <Pressable style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={() => setShowCompleteModal(true)} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>END TRIP</Text>}
          </Pressable>
        )}

        {isTerminal && (
          <View style={styles.terminalBox}>
            <Text style={[styles.terminalText, { color: cfg.color }]}>
              {ride.status === "COMPLETED" ? `₹${ride.finalFare ?? ride.quotedFare} earned` : "Returning to home screen..."}
            </Text>
          </View>
        )}

        {isPreTrip && (
          <Pressable style={styles.cancelBtn} onPress={() => setShowCancelModal(true)}>
            <Text style={styles.cancelText}>Cancel Ride</Text>
          </Pressable>
        )}
      </View>

      {/* OTP modal */}
      <Modal transparent visible={showOtpModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Passenger OTP</Text>
            <Text style={styles.modalSub}>Ask the passenger to show their 4-digit OTP</Text>
            <TextInput
              value={otp} onChangeText={setOtp}
              keyboardType="number-pad" maxLength={4}
              style={styles.otpInput} placeholder="• • • •"
              placeholderTextColor="#555" autoFocus
            />
            <Pressable
              style={[styles.modalPrimaryBtn, (otp.length !== 4 || loading) && styles.btnDisabled]}
              disabled={otp.length !== 4 || loading} onPress={handleVerifyOtp}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.modalPrimaryText}>START TRIP</Text>}
            </Pressable>
            <Pressable onPress={() => { setShowOtpModal(false); setOtp(""); }}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Complete modal */}
      <Modal transparent visible={showCompleteModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>End Trip?</Text>
            <Text style={styles.modalSub}>Confirm the trip summary</Text>
            <View style={styles.summaryBox}>
              <SRow label="Passenger" value={ride.customer?.name ?? "—"} />
              <SRow label="Drop" value={ride.drop.label} />
              <SRow label="Distance" value={`${ride.distanceKm} km`} />
              <SRow label="Payment" value={ride.paymentMethod} />
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>Your Earnings</Text>
                <Text style={styles.earningsAmount}>₹{ride.quotedFare}</Text>
              </View>
            </View>
            <Pressable style={[styles.modalPrimaryBtn, loading && styles.btnDisabled]} onPress={handleComplete} disabled={loading}>
              {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.modalPrimaryText}>CONFIRM COMPLETION</Text>}
            </Pressable>
            <Pressable onPress={() => setShowCompleteModal(false)}>
              <Text style={styles.modalCancel}>Back</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Cancel modal */}
      <Modal transparent visible={showCancelModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel Ride?</Text>
            <Text style={styles.modalSub}>This may affect your rating.</Text>
            <Pressable style={[styles.modalPrimaryBtn, { backgroundColor: "#ef4444" }]} onPress={handleCancel}>
              <Text style={styles.modalPrimaryText}>YES, CANCEL</Text>
            </Pressable>
            <Pressable onPress={() => setShowCancelModal(false)}>
              <Text style={styles.modalCancel}>No, keep the ride</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  map: { flex: 1 },
  topButtons: { position: "absolute", top: 50, right: 16, gap: 10 },
  floatBtn: { backgroundColor: "rgba(0,0,0,0.7)", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  callFloatBtn: { backgroundColor: "rgba(74,222,128,0.85)" },
  floatBtnText: { fontSize: 20 },
  card: { position: "absolute", bottom: 0, width: "100%", backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  statusPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, gap: 6, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontWeight: "700", fontSize: 13 },
  statusSub: { color: "#9ca3af", fontSize: 13, marginBottom: 14 },
  passengerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  passengerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  passengerInitial: { color: "#fff", fontSize: 18, fontWeight: "700" },
  passengerName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  passengerSub: { color: "#9ca3af", fontSize: 12, marginTop: 1 },
  payBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  cashBadge: { backgroundColor: "#1c3a1e" },
  upiBadge: { backgroundColor: "#1a237e" },
  payBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#222", marginBottom: 14 },
  locBlock: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "flex-start" },
  locDot: { color: "#4ade80", fontSize: 12, marginTop: 3 },
  locLabel: { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  locText: { color: "#fff", fontSize: 14, fontWeight: "600", marginTop: 2 },
  fareRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  fareLabel: { color: "#6b7280", fontSize: 12 },
  fareAmount: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 2 },
  primaryBtn: { backgroundColor: "#fff", paddingVertical: 15, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#000", fontWeight: "800", fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  cancelBtn: { paddingVertical: 12, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: "#ef444455" },
  cancelText: { color: "#ef4444", fontWeight: "600", fontSize: 14 },
  terminalBox: { paddingVertical: 14, alignItems: "center" },
  terminalText: { fontSize: 17, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { backgroundColor: "#111", width: "100%", borderRadius: 20, padding: 24 },
  modalTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 6 },
  modalSub: { color: "#9ca3af", fontSize: 14, marginBottom: 20 },
  otpInput: { backgroundColor: "#000", borderRadius: 12, padding: 16, color: "#fff", fontSize: 32, textAlign: "center", letterSpacing: 12, marginBottom: 20, borderWidth: 1, borderColor: "#333" },
  modalPrimaryBtn: { backgroundColor: "#fff", paddingVertical: 15, borderRadius: 14, alignItems: "center", marginBottom: 14 },
  modalPrimaryText: { color: "#000", fontWeight: "800", fontSize: 15 },
  modalCancel: { color: "#9ca3af", textAlign: "center", fontSize: 14 },
  summaryBox: { backgroundColor: "#000", borderRadius: 12, padding: 16, marginBottom: 20, gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { color: "#6b7280", fontSize: 13 },
  summaryValue: { color: "#fff", fontSize: 13, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  earningsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#1f1f1f" },
  earningsLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  earningsAmount: { color: "#4ade80", fontSize: 22, fontWeight: "900" },
});
