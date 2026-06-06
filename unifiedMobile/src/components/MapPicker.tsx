import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const JAMMU_CENTER = { latitude: 32.7266, longitude: 74.8570 };

function buildMapHTML(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;background:#111}
    #map{width:100%;height:100%}
    #pin{position:fixed;top:50%;left:50%;transform:translate(-50%,-100%);font-size:34px;z-index:9999;pointer-events:none;line-height:1}
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="pin">📍</div>
  <script>
    var map=L.map('map',{zoomControl:true,attributionControl:false}).setView([${lat},${lng}],15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,subdomains:['a','b','c']}).addTo(map);
    function emit(){
      var c=map.getCenter();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'loc',lat:c.lat,lng:c.lng}));
    }
    map.on('moveend',emit);
    function onMsg(e){
      try{var d=JSON.parse(e.data);if(d.type==='goto')map.setView([d.lat,d.lng],d.z||15);}catch(_){}
    }
    document.addEventListener('message',onMsg); window.addEventListener('message',onMsg);
    setTimeout(emit,600);
  </script>
</body>
</html>`;
}

async function reverseGeocode(lat: number, lng: number): Promise<{ label: string; address: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "JammuCabApp/1.0", "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data?.display_name) {
      const parts = data.display_name.split(", ");
      return { label: parts.slice(0, 3).join(", "), address: data.display_name };
    }
  } catch { /* network error */ }
  return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, address: "" };
}

async function searchPlaces(query: string): Promise<Array<{ label: string; address: string; lat: number; lng: number }>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " Jammu")}&format=json&limit=6&countrycodes=in`,
      { headers: { "User-Agent": "JammuCabApp/1.0", "Accept-Language": "en" } }
    );
    const data = await res.json();
    return (data || []).map((item: any) => ({
      label: item.display_name.split(", ").slice(0, 3).join(", "),
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch { return []; }
}

interface Props {
  visible: boolean;
  title?: string;
  initialCoord?: { lat: number; lng: number };
  onConfirm: (location: { coordinates: { lat: number; lng: number }; label: string; address: string }) => void;
  onCancel: () => void;
}

export default function MapPicker({ visible, title, initialCoord, onConfirm, onCancel }: Props) {
  const webViewRef = useRef<WebView>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = initialCoord
    ? { latitude: initialCoord.lat, longitude: initialCoord.lng }
    : JAMMU_CENTER;

  const [coord, setCoord] = useState(start);
  const [addressLabel, setAddressLabel] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const geocodeCoord = useCallback((lat: number, lng: number) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      const result = await reverseGeocode(lat, lng);
      setAddressLabel(result.label);
      setGeocoding(false);
    }, 800);
  }, []);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "loc") {
        setCoord({ latitude: data.lat, longitude: data.lng });
        geocodeCoord(data.lat, data.lng);
      }
    } catch { /* ignored */ }
  }, [geocodeCoord]);

  const goToMyLocation = useCallback(async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      setCoord({ latitude, longitude });
      geocodeCoord(latitude, longitude);
      webViewRef.current?.injectJavaScript(`map.setView([${latitude},${longitude}],15); true;`);
    } catch { /* location unavailable */ } finally { setLocating(false); }
  }, [geocodeCoord]);

  const handleSearchChange = useCallback((text: string) => {
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

  const selectSearchResult = (item: any) => {
    setCoord({ latitude: item.lat, longitude: item.lng });
    setAddressLabel(item.label);
    setSearchText(item.label);
    setSearchResults([]);
    webViewRef.current?.injectJavaScript(`map.setView([${item.lat},${item.lng}],15); true;`);
  };

  const handleConfirm = async () => {
    setGeocoding(true);
    const result = await reverseGeocode(coord.latitude, coord.longitude);
    setGeocoding(false);
    onConfirm({
      coordinates: { lat: coord.latitude, lng: coord.longitude },
      label: result.label || addressLabel,
      address: result.address || addressLabel,
    });
  };

  useEffect(() => {
    if (visible) {
      setSearchText(""); setSearchResults([]);
      if (!initialCoord) goToMyLocation();
      else geocodeCoord(start.latitude, start.longitude);
    }
    return () => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onCancel} style={styles.headerSide}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{title || "Select Location"}</Text>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search in Jammu..."
            placeholderTextColor="#666"
            value={searchText}
            onChangeText={handleSearchChange}
            autoCorrect={false}
          />
          {searching && <ActivityIndicator color="#fff" size="small" style={{ marginLeft: 10 }} />}
        </View>

        {searchResults.length > 0 && (
          <View style={styles.resultsBox}>
            <FlatList
              data={searchResults}
              keyExtractor={(_, i) => String(i)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.resultItem} onPress={() => selectSearchResult(item)}>
                  <Text style={styles.resultText} numberOfLines={2}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        )}

        <View style={styles.mapWrap}>
          <WebView
            ref={webViewRef}
            style={styles.map}
            source={{ html: buildMapHTML(start.latitude, start.longitude) }}
            javaScriptEnabled
            onMessage={handleWebViewMessage}
            scrollEnabled={false}
            bounces={false}
          />
          <Pressable style={styles.myLocBtn} onPress={goToMyLocation} disabled={locating}>
            {locating ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.myLocIcon}>⊕</Text>}
          </Pressable>
        </View>

        <View style={styles.bottom}>
          <View style={styles.addrRow}>
            {geocoding
              ? <ActivityIndicator color="#aaa" size="small" />
              : <Text style={styles.addrText} numberOfLines={2}>{addressLabel || "Move the map to select a location"}</Text>}
          </View>
          <Pressable
            style={[styles.confirmBtn, geocoding && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={geocoding}
          >
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#111", paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16 },
  headerSide: { width: 60 },
  cancelText: { color: "#888", fontSize: 15 },
  title: { color: "#fff", fontSize: 17, fontWeight: "700", textAlign: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#111", paddingHorizontal: 16, paddingBottom: 10 },
  searchInput: { flex: 1, backgroundColor: "#1a1a1a", color: "#fff", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, fontSize: 15 },
  resultsBox: { position: "absolute", top: 148, left: 16, right: 16, backgroundColor: "#1a1a1a", borderRadius: 10, zIndex: 100, elevation: 10, maxHeight: 220, borderWidth: 1, borderColor: "#333" },
  resultItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#2a2a2a" },
  resultText: { color: "#fff", fontSize: 14 },
  mapWrap: { flex: 1, position: "relative" },
  map: { flex: 1 },
  myLocBtn: { position: "absolute", bottom: 16, right: 16, backgroundColor: "#fff", width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", elevation: 4 },
  myLocIcon: { fontSize: 24, color: "#000" },
  bottom: { backgroundColor: "#111", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 },
  addrRow: { minHeight: 40, justifyContent: "center", marginBottom: 14 },
  addrText: { color: "#fff", fontSize: 14, textAlign: "center" },
  confirmBtn: { backgroundColor: "#fff", paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: "#000", fontWeight: "800", fontSize: 16 },
});
