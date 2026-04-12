import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const DELHI_CENTER = { latitude: 28.6139, longitude: 77.209 };

function getMapHTML(lat, lng) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #111; }
    #map { width: 100%; height: 100%; }
    #pin {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -100%);
      font-size: 34px; z-index: 9999; pointer-events: none; line-height: 1;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="pin">📍</div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false })
               .setView([${lat}, ${lng}], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, subdomains: ['a','b','c']
    }).addTo(map);

    function emit() {
      var c = map.getCenter();
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'loc', lat: c.lat, lng: c.lng })
      );
    }

    map.on('moveend', emit);

    function onMsg(e) {
      try {
        var d = JSON.parse(e.data);
        if (d.type === 'goto') map.setView([d.lat, d.lng], d.z || 15);
      } catch(_) {}
    }
    document.addEventListener('message', onMsg);
    window.addEventListener('message', onMsg);

    setTimeout(emit, 600);
  </script>
</body>
</html>`;
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "CabBookingApp/1.0", "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data?.display_name) {
      const parts = data.display_name.split(", ");
      return { label: parts.slice(0, 3).join(", "), address: data.display_name };
    }
  } catch { /* network error */ }
  return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, address: "" };
}

async function searchPlaces(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=in`,
      { headers: { "User-Agent": "CabBookingApp/1.0", "Accept-Language": "en" } }
    );
    const data = await res.json();
    return (data || []).map((item) => ({
      label: item.display_name.split(", ").slice(0, 3).join(", "),
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch { return []; }
}

export default function MapPicker({ visible, title, initialCoord, onConfirm, onCancel }) {
  const webViewRef = useRef(null);
  const geocodeTimer = useRef(null);
  const searchTimer = useRef(null);

  const startCoord = initialCoord
    ? { latitude: initialCoord.lat, longitude: initialCoord.lng }
    : DELHI_CENTER;

  const [selectedCoord, setSelectedCoord] = useState(startCoord);
  const [addressLabel, setAddressLabel] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const geocodeCoord = useCallback((latitude, longitude) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      const result = await reverseGeocode(latitude, longitude);
      setAddressLabel(result.label);
      setGeocoding(false);
    }, 800);
  }, []);

  // Receive location from WebView map center
  const handleWebViewMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "loc") {
        setSelectedCoord({ latitude: data.lat, longitude: data.lng });
        geocodeCoord(data.lat, data.lng);
      }
    } catch (_) {}
  }, [geocodeCoord]);

  const goToMyLocation = useCallback(async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setSelectedCoord({ latitude, longitude });
      geocodeCoord(latitude, longitude);
      webViewRef.current?.injectJavaScript(
        `map.setView([${latitude}, ${longitude}], 15); true;`
      );
    } catch { /* location unavailable */ }
    finally { setLocating(false); }
  }, [geocodeCoord]);

  const handleSearchChange = useCallback((text) => {
    setSearchText(text);
    setSearchResults([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) return;
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchPlaces(text);
      setSearchResults(results);
      setSearching(false);
    }, 600);
  }, []);

  const handleSelectSearchResult = (item) => {
    setSelectedCoord({ latitude: item.lat, longitude: item.lng });
    setAddressLabel(item.label);
    setSearchText(item.label);
    setSearchResults([]);
    webViewRef.current?.injectJavaScript(
      `map.setView([${item.lat}, ${item.lng}], 15); true;`
    );
  };

  const handleConfirm = async () => {
    setGeocoding(true);
    const result = await reverseGeocode(selectedCoord.latitude, selectedCoord.longitude);
    setGeocoding(false);
    onConfirm({
      coordinates: { lat: selectedCoord.latitude, lng: selectedCoord.longitude },
      label: result.label || addressLabel,
      address: result.address || addressLabel,
    });
  };

  useEffect(() => {
    if (visible) {
      setSearchText("");
      setSearchResults([]);
      setMapReady(false);
      if (!initialCoord) {
        goToMyLocation();
      } else {
        geocodeCoord(startCoord.latitude, startCoord.longitude);
      }
    }
    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [visible]);

  const mapHTML = getMapHTML(startCoord.latitude, startCoord.longitude);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerSide}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title || "Select Location"}</Text>
          <View style={styles.headerSide} />
        </View>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a place..."
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator color="#fff" style={styles.searchSpinner} size="small" />}
        </View>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <FlatList
              data={searchResults}
              keyExtractor={(_, i) => String(i)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleSelectSearchResult(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resultText} numberOfLines={2}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map */}
        <View style={styles.mapWrapper}>
          <WebView
            ref={webViewRef}
            style={styles.map}
            source={{ html: mapHTML }}
            javaScriptEnabled
            onMessage={handleWebViewMessage}
            onLoad={() => setMapReady(true)}
            scrollEnabled={false}
            bounces={false}
          />

          {/* My Location FAB */}
          <TouchableOpacity
            style={styles.myLocBtn}
            onPress={goToMyLocation}
            disabled={locating}
            activeOpacity={0.8}
          >
            {locating
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.myLocIcon}>⊕</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Bottom panel */}
        <View style={styles.bottom}>
          <View style={styles.addressRow}>
            {geocoding
              ? <ActivityIndicator color="#aaa" size="small" />
              : <Text style={styles.addressText} numberOfLines={2}>
                  {addressLabel || "Move the map to select a location"}
                </Text>
            }
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, geocoding && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={geocoding}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#111",
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerSide: { width: 60 },
  cancelText: { color: "#888", fontSize: 15 },
  title: { color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#222",
    color: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  searchSpinner: { marginLeft: 10 },
  resultsContainer: {
    position: "absolute",
    top: 148,
    left: 16,
    right: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    zIndex: 100,
    elevation: 10,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: "#333",
  },
  resultItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  resultText: { color: "#fff", fontSize: 14 },
  mapWrapper: { flex: 1, position: "relative" },
  map: { flex: 1 },
  myLocBtn: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "#fff",
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  myLocIcon: { fontSize: 24, color: "#000" },
  bottom: {
    backgroundColor: "#111",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  addressRow: { minHeight: 40, justifyContent: "center", marginBottom: 14 },
  addressText: { color: "#fff", fontSize: 14, textAlign: "center" },
  confirmBtn: {
    backgroundColor: "#fff",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
