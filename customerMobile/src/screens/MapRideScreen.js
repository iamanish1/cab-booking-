import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { cancelRide, getRide } from "../services/customerApi";
import { subscribeToRide } from "../services/rideSocket";
import { formatCurrency, normalizeRide } from "../utils/location";

const POLL_INTERVAL_MS = 8000;

const STATUS_TEXT = {
  SEARCHING_DRIVER: "Finding a driver...",
  DRIVER_ASSIGNED: "Driver assigned — heading to you",
  DRIVER_ARRIVING: "Driver is arriving",
  VERIFY_CODE: "Share OTP to start ride",
  ON_TRIP: "On trip",
  COMPLETED: "Trip completed",
  CANCELLED_BY_CUSTOMER: "Ride cancelled",
  CANCELLED_BY_DRIVER: "Ride cancelled by driver",
  NO_DRIVER_AVAILABLE: "No driver available",
};

function getRideMapHTML(pickup, drop) {
  const pLat = pickup?.lat ?? 28.6139;
  const pLng = pickup?.lng ?? 77.209;
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
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #111; }
    #map { width: 100%; height: 100%; }
    .emoji-icon { font-size: 24px; line-height: 1; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false })
               .setView([${midLat}, ${midLng}], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, subdomains: ['a','b','c']
    }).addTo(map);

    var greenIcon = L.divIcon({ html: '<div class="emoji-icon">🟢</div>', className: '', iconSize: [24,24], iconAnchor: [12,12] });
    var redIcon   = L.divIcon({ html: '<div class="emoji-icon">🔴</div>', className: '', iconSize: [24,24], iconAnchor: [12,12] });
    var carIcon   = L.divIcon({ html: '<div class="emoji-icon">🚗</div>', className: '', iconSize: [30,30], iconAnchor: [15,15] });

    var pickupMarker = L.marker([${pLat}, ${pLng}], { icon: greenIcon }).addTo(map).bindPopup('Pickup');
    var dropMarker   = L.marker([${dLat}, ${dLng}], { icon: redIcon }).addTo(map).bindPopup('Drop');
    var driverMarker = null;
    var routeLine    = null;

    var bounds = [[${pLat}, ${pLng}], [${dLat}, ${dLng}]];
    map.fitBounds(bounds, { padding: [50, 50] });

    function refreshRoute() {
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      var coords = [];
      if (driverMarker) coords.push(driverMarker.getLatLng());
      coords.push(pickupMarker.getLatLng());
      coords.push(dropMarker.getLatLng());
      if (coords.length >= 2) {
        routeLine = L.polyline(coords, { color: '#3b82f6', weight: 3 }).addTo(map);
      }
    }

    function onMsg(e) {
      try {
        var d = JSON.parse(e.data);
        if (d.type === 'driver') {
          var ll = [d.lat, d.lng];
          if (!driverMarker) {
            driverMarker = L.marker(ll, { icon: carIcon }).addTo(map).bindPopup('Driver');
          } else {
            driverMarker.setLatLng(ll);
          }
          map.panTo(ll);
          refreshRoute();
        }
        if (d.type === 'focus') {
          if (driverMarker) map.panTo(driverMarker.getLatLng());
          else map.panTo(pickupMarker.getLatLng());
        }
      } catch(_) {}
    }
    document.addEventListener('message', onMsg);
    window.addEventListener('message', onMsg);
  </script>
</body>
</html>`;
}

export default function MapRideScreen({
  setScreen,
  rideId,
  ride,
  customerId,
  onRideUpdated,
  onRideCompleted,
  onWalletUpdated,
}) {
  const [currentRide, setCurrentRide] = useState(ride);
  const [loading, setLoading] = useState(!ride);
  const [error, setError] = useState("");
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const webViewRef = useRef(null);
  const previousStatus = useRef(ride?.status);
  const rideUpdatedRef = useRef(onRideUpdated);
  const walletUpdatedRef = useRef(onWalletUpdated);

  useEffect(() => { rideUpdatedRef.current = onRideUpdated; }, [onRideUpdated]);
  useEffect(() => { walletUpdatedRef.current = onWalletUpdated; }, [onWalletUpdated]);
  useEffect(() => { setCurrentRide(ride); }, [ride]);

  // Send driver location to WebView whenever it updates
  useEffect(() => {
    if (driverLocation && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `onMsg({ data: JSON.stringify({ type: 'driver', lat: ${driverLocation.latitude}, lng: ${driverLocation.longitude} }) }); true;`
      );
    }
  }, [driverLocation]);

  useEffect(() => {
    let isMounted = true;

    const refreshRide = async () => {
      if (!rideId) { setLoading(false); return; }
      try {
        const response = await getRide(rideId);
        const normalized = normalizeRide(response);
        if (!isMounted) return;
        setCurrentRide(normalized);
        setError("");
        rideUpdatedRef.current?.(response);
        if (previousStatus.current !== "COMPLETED" && normalized?.status === "COMPLETED") {
          setShowCompletionModal(true);
        }
        previousStatus.current = normalized?.status;
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    refreshRide();

    const unsubscribe = subscribeToRide({
      rideId,
      customerId,
      onEvent: async (eventName, payload) => {
        if (!isMounted) return;

        if (eventName === "ride:driver_location" && payload?.driverLocation) {
          const { lat, lng } = payload.driverLocation;
          setDriverLocation({ latitude: lat, longitude: lng });
        }

        if (eventName === "wallet:updated") {
          walletUpdatedRef.current?.(payload);
        }

        if (
          payload?.rideId === rideId ||
          eventName === "ride:cancelled" ||
          eventName === "ride:completed" ||
          eventName === "ride:driver_assigned" ||
          eventName === "ride:driver_arriving" ||
          eventName === "ride:started"
        ) {
          await refreshRide();
        }
      },
    });

    const intervalId = setInterval(refreshRide, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [customerId, rideId]);

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
        <TouchableOpacity style={styles.homeButton} onPress={() => setScreen({ NAME: "HOME", DATA: {} })}>
          <Text style={styles.homeButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const driver = currentRide.driver;
  const showOtpSection = ["VERIFY_CODE", "DRIVER_ARRIVING"].includes(currentRide.status);
  const canCancel = ["SEARCHING_DRIVER", "DRIVER_ASSIGNED", "DRIVER_ARRIVING", "VERIFY_CODE"].includes(currentRide.status);
  const isTerminal = ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_DRIVER", "NO_DRIVER_AVAILABLE"].includes(currentRide.status);

  const pickup = currentRide.pickup?.coordinates;
  const drop = currentRide.drop?.coordinates;
  const mapHTML = getRideMapHTML(pickup, drop);

  const handleCancelRide = async () => {
    try {
      await cancelRide(currentRide.id, "Cancelled from customer app");
      onRideUpdated(null);
      setScreen({ NAME: "HOME", DATA: {} });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: mapHTML }}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
      />

      {/* Status pill */}
      <View style={styles.statusPill}>
        <Text style={styles.statusText}>{STATUS_TEXT[currentRide.status] || currentRide.status}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        {/* Driver row */}
        <View style={styles.driverRow}>
          <View style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{driver?.name || "Assigning driver..."}</Text>
            <Text style={styles.driverMeta}>
              {driver ? `⭐ ${driver.rating || "4.8"}  •  ${driver.vehicleNumber}` : "Please wait"}
            </Text>
          </View>
          {driver?.mobileNumber ? (
            <TouchableOpacity
              style={styles.callBtn}
              onPress={() => Linking.openURL(`tel:${driver.mobileNumber}`)}
            >
              <Ionicons name="call-outline" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Route row */}
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
            <Text style={styles.fare}>{formatCurrency(currentRide.fare)}</Text>
            <Text style={styles.payment}>{currentRide.paymentMethod}</Text>
          </View>
        </View>

        {/* OTP section */}
        {showOtpSection && (
          <View style={styles.otpCard}>
            <Text style={styles.otpTitle}>Your Ride OTP</Text>
            <Text style={styles.otpSubtitle}>Share this code with your driver to start the ride</Text>
            <View style={styles.otpBox}>
              <Text style={styles.otpText}>{currentRide.otpCode || "----"}</Text>
            </View>
          </View>
        )}

        {canCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelRide}>
            <Text style={styles.cancelText}>Cancel Ride</Text>
          </TouchableOpacity>
        )}

        {isTerminal && (
          <TouchableOpacity style={styles.homeBtn} onPress={() => setScreen({ NAME: "HOME", DATA: {} })}>
            <Text style={styles.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Completion modal */}
      <Modal transparent visible={showCompletionModal} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            <Text style={styles.modalTitle}>Trip Completed!</Text>
            <Text style={styles.modalSub}>Thanks for riding with us</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={async () => {
                setShowCompletionModal(false);
                await onRideCompleted();
              }}
            >
              <Text style={styles.modalBtnText}>Go Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#fff", marginBottom: 12 },
  homeButton: { backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  homeButtonText: { color: "#000", fontWeight: "700" },
  map: { flex: 1 },
  statusPill: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  errorText: { color: "#f87171", fontSize: 12, marginTop: 4, textAlign: "center" },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#000",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    elevation: 30,
  },
  driverRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#333", marginRight: 12 },
  driverName: { color: "#fff", fontSize: 16, fontWeight: "700" },
  driverMeta: { color: "#aaa", fontSize: 13, marginTop: 2 },
  callBtn: { padding: 10, backgroundColor: "#1f1f1f", borderRadius: 12 },
  routeCard: { backgroundColor: "#111", borderRadius: 14, padding: 14, marginBottom: 12 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDot: { color: "#4ade80", fontSize: 10 },
  routeText: { color: "#ccc", fontSize: 14, flex: 1 },
  routeLine: { width: 1, height: 12, backgroundColor: "#333", marginLeft: 4, marginVertical: 4 },
  fareRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  fare: { color: "#fff", fontSize: 17, fontWeight: "700" },
  payment: { color: "#aaa", fontSize: 14 },
  otpCard: { backgroundColor: "#111", borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 12 },
  otpTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  otpSubtitle: { color: "#aaa", textAlign: "center", marginVertical: 6, fontSize: 13 },
  otpBox: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: "#000", borderWidth: 1, borderColor: "#333" },
  otpText: { color: "#fff", fontSize: 28, letterSpacing: 6, fontWeight: "700" },
  cancelBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: "#ef4444", alignItems: "center", marginTop: 4 },
  cancelText: { color: "#ef4444", fontWeight: "700" },
  homeBtn: { marginTop: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: "#fff", alignItems: "center" },
  homeBtnText: { color: "#000", fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "80%", backgroundColor: "#111", borderRadius: 20, padding: 24, alignItems: "center" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 12 },
  modalSub: { color: "#aaa", marginVertical: 8 },
  modalBtn: { marginTop: 16, backgroundColor: "#fff", paddingVertical: 12, paddingHorizontal: 32, borderRadius: 14 },
  modalBtnText: { color: "#000", fontWeight: "700" },
});
