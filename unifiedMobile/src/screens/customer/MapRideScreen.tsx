import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { cancelRide, getRide, rateRide } from "../../services/customerApi";
import { subscribeToRide } from "../../services/customerSocket";
import RatingModal from "../../components/RatingModal";
import { formatCurrency, normalizeRide } from "../../utils/location";
import type { NormalizedRide, CustomerScreen } from "../../types";

interface Props {
  setScreen: (s: CustomerScreen) => void;
  rideId: string;
  ride: NormalizedRide | null;
  customerId: string;
  onRideUpdated: (r: any) => void;
  onRideCompleted: () => Promise<void>;
  onWalletUpdated: (w: any) => void;
}

const STATUS_TEXT: Record<string, string> = {
  SEARCHING_DRIVER: "Finding a driver...",
  DRIVER_ASSIGNED: "Driver assigned — heading to you",
  DRIVER_ARRIVING: "Driver is arriving",
  VERIFY_CODE: "Share OTP to start ride",
  ON_TRIP: "On trip",
  COMPLETED: "Trip completed",
  CANCELLED_BY_CUSTOMER: "Ride cancelled",
  CANCELLED_BY_DRIVER: "Ride cancelled by driver",
  NO_DRIVER_AVAILABLE: "No driver available right now",
};

function buildMapHTML(
  pickup: { lat: number; lng: number } | null,
  drop: { lat: number; lng: number } | null
): string {
  const pLat = pickup?.lat ?? 32.7266;
  const pLng = pickup?.lng ?? 74.8570;
  const dLat = drop?.lat ?? pLat;
  const dLng = drop?.lng ?? pLng;
  const midLat = (pLat + dLat) / 2;
  const midLng = (pLng + dLng) / 2;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>* { margin:0; padding:0; } html,body { width:100%; height:100%; background:#111; } #map { width:100%; height:100%; }</style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${midLat},${midLng}],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,subdomains:['a','b','c']}).addTo(map);
    var gI = L.divIcon({html:'<div style="font-size:24px">🟢</div>',className:'',iconSize:[24,24],iconAnchor:[12,12]});
    var rI = L.divIcon({html:'<div style="font-size:24px">🔴</div>',className:'',iconSize:[24,24],iconAnchor:[12,12]});
    var cI = L.divIcon({html:'<div style="font-size:28px">🛺</div>',className:'',iconSize:[28,28],iconAnchor:[14,14]});
    L.marker([${pLat},${pLng}],{icon:gI}).addTo(map).bindPopup('Pickup');
    L.marker([${dLat},${dLng}],{icon:rI}).addTo(map).bindPopup('Drop');
    var driverMarker=null; var routeLine=null;
    map.fitBounds([[${pLat},${pLng}],[${dLat},${dLng}]],{padding:[50,50]});
    function refreshRoute(){
      if(routeLine){map.removeLayer(routeLine);routeLine=null;}
      if(driverMarker){
        routeLine=L.polyline([driverMarker.getLatLng(),[${pLat},${pLng}],[${dLat},${dLng}]],{color:'#3b82f6',weight:3}).addTo(map);
      }
    }
    function onMsg(e){
      try{
        var d=JSON.parse(e.data);
        if(d.type==='driver'){
          var ll=[d.lat,d.lng];
          if(!driverMarker){driverMarker=L.marker(ll,{icon:cI}).addTo(map).bindPopup('Driver');}
          else{driverMarker.setLatLng(ll);}
          map.panTo(ll); refreshRoute();
        }
      }catch(_){}
    }
    document.addEventListener('message',onMsg); window.addEventListener('message',onMsg);
  </script>
</body>
</html>`;
}

const POLL_MS = 8000;

export default function CustomerMapRideScreen({
  setScreen, rideId, ride, customerId,
  onRideUpdated, onRideCompleted, onWalletUpdated,
}: Props) {
  const [currentRide, setCurrentRide] = useState<NormalizedRide | null>(ride);
  const [loading, setLoading] = useState(!ride);
  const [showCompletion, setShowCompletion] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const webViewRef = useRef<WebView>(null);
  const prevStatus = useRef(ride?.status);

  useEffect(() => { setCurrentRide(ride); }, [ride]);

  useEffect(() => {
    if (driverLocation && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `onMsg({data:JSON.stringify({type:'driver',lat:${driverLocation.lat},lng:${driverLocation.lng}})}); true;`
      );
    }
  }, [driverLocation]);

  const refreshRide = async () => {
    if (!rideId) { setLoading(false); return; }
    try {
      const raw = await getRide(rideId);
      const normalized = normalizeRide(raw);
      setCurrentRide(normalized);
      onRideUpdated(raw);
      if (prevStatus.current !== "COMPLETED" && normalized?.status === "COMPLETED") {
        setShowCompletion(true);
      }
      prevStatus.current = normalized?.status;
    } catch {
      /* ignore poll errors */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    refreshRide();

    const unsubscribe = subscribeToRide(rideId, customerId, (eventName, payload) => {
      if (!mounted) return;
      if (eventName === "ride:driver_location" && payload?.driverLocation) {
        setDriverLocation({ lat: payload.driverLocation.lat, lng: payload.driverLocation.lng });
      }
      if (eventName === "wallet:updated") onWalletUpdated(payload);
      if (["ride:cancelled", "ride:completed", "ride:driver_assigned", "ride:driver_arriving", "ride:started"].includes(eventName)) {
        refreshRide();
      }
    });

    const interval = setInterval(refreshRide, POLL_MS);
    return () => { mounted = false; clearInterval(interval); unsubscribe(); };
  }, [rideId, customerId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (!currentRide) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No active ride found.</Text>
        <Pressable style={styles.homeBtn} onPress={() => setScreen({ NAME: "HOME", DATA: {} })}>
          <Text style={styles.homeBtnText}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  const driver = currentRide.driver;
  const canCancel = ["SEARCHING_DRIVER", "DRIVER_ASSIGNED", "DRIVER_ARRIVING", "VERIFY_CODE"].includes(currentRide.status);
  const isTerminal = ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_DRIVER", "NO_DRIVER_AVAILABLE"].includes(currentRide.status);
  const showOtp = ["VERIFY_CODE", "DRIVER_ARRIVING"].includes(currentRide.status);

  const pickup = currentRide.pickup?.coordinates ?? null;
  const drop = currentRide.drop?.coordinates ?? null;

  const handleCancel = async () => {
    try {
      await cancelRide(currentRide.id, "Cancelled by passenger");
      onRideUpdated(null);
      setScreen({ NAME: "HOME", DATA: {} });
    } catch { /* best effort */ }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: buildMapHTML(pickup, drop) }}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
      />

      <View style={styles.statusPill}>
        <Text style={styles.statusText}>{STATUS_TEXT[currentRide.status] || currentRide.status}</Text>
      </View>

      <View style={styles.sheet}>
        {/* Driver info */}
        <View style={styles.driverRow}>
          <View style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{driver?.name || "Assigning driver..."}</Text>
            <Text style={styles.driverMeta}>
              {driver ? `⭐ ${driver.rating || "4.8"}  ·  ${driver.vehicleNumber}` : "Please wait"}
            </Text>
          </View>
          {driver?.mobile ? (
            <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${driver.mobile}`)}>
              <Ionicons name="call-outline" size={18} color="#fff" />
            </Pressable>
          ) : null}
        </View>

        {/* Route */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <Text style={styles.routeDot}>●</Text>
            <Text style={styles.routeText} numberOfLines={1}>{currentRide.pickup?.label}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <Text style={[styles.routeDot, { color: "#ef4444" }]}>■</Text>
            <Text style={styles.routeText} numberOfLines={1}>{currentRide.drop?.label}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareText}>{formatCurrency(currentRide.fare)}</Text>
            <Text style={styles.payText}>{currentRide.paymentMethod}</Text>
          </View>
        </View>

        {/* OTP */}
        {showOtp && (
          <View style={styles.otpCard}>
            <Text style={styles.otpTitle}>Your Ride OTP</Text>
            <Text style={styles.otpSub}>Share this with your driver to start the ride</Text>
            <View style={styles.otpBox}>
              <Text style={styles.otpCode}>{currentRide.otpCode || "----"}</Text>
            </View>
          </View>
        )}

        {canCancel && (
          <Pressable style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel Ride</Text>
          </Pressable>
        )}

        {isTerminal && (
          <Pressable style={styles.goHomeBtn} onPress={() => setScreen({ NAME: "HOME", DATA: {} })}>
            <Text style={styles.goHomeBtnText}>Back to Home</Text>
          </Pressable>
        )}
      </View>

      {/* Rating / completion modal */}
      <RatingModal
        visible={showCompletion}
        driverName={currentRide?.driver?.name}
        fare={currentRide?.fare}
        onSubmit={async (rating) => {
          if (rideId) {
            try { await rateRide(rideId, rating); } catch { /* ignore rating errors */ }
          }
          setShowCompletion(false);
          await onRideCompleted();
        }}
        onSkip={async () => {
          setShowCompletion(false);
          await onRideCompleted();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#fff", marginBottom: 12 },
  homeBtn: { backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  homeBtnText: { color: "#000", fontWeight: "700" },
  map: { flex: 1 },
  statusPill: {
    position: "absolute", top: 50, alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
  },
  statusText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sheet: {
    position: "absolute", bottom: 0, width: "100%",
    backgroundColor: "#000", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  driverRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#222", marginRight: 12 },
  driverName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  driverMeta: { color: "#777", fontSize: 13, marginTop: 2 },
  callBtn: { padding: 10, backgroundColor: "#1a1a1a", borderRadius: 12 },
  routeCard: { backgroundColor: "#0f0f0f", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#1a1a1a" },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDot: { color: "#4ade80", fontSize: 10 },
  routeText: { color: "#ccc", fontSize: 14, flex: 1 },
  routeLine: { width: 1, height: 12, backgroundColor: "#222", marginLeft: 4, marginVertical: 4 },
  fareRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  fareText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  payText: { color: "#777", fontSize: 14 },
  otpCard: { backgroundColor: "#0f0f0f", borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#1a1a1a" },
  otpTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  otpSub: { color: "#777", textAlign: "center", marginVertical: 6, fontSize: 13 },
  otpBox: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: "#000", borderWidth: 1, borderColor: "#333", marginTop: 4 },
  otpCode: { color: "#fff", fontSize: 32, letterSpacing: 8, fontWeight: "700" },
  cancelBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "#ef444455", alignItems: "center", marginTop: 4 },
  cancelText: { color: "#ef4444", fontWeight: "700" },
  goHomeBtn: { marginTop: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: "#fff", alignItems: "center" },
  goHomeBtnText: { color: "#000", fontWeight: "700" },
});
