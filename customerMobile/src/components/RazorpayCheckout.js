import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";

function getCheckoutHTML({ keyId, orderId, amount, currency, prefillName, prefillContact }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; }
    body { background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .loader { color: #fff; font-family: sans-serif; font-size: 16px; }
  </style>
</head>
<body>
  <div class="loader">Opening payment...</div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function send(data) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }

    var options = {
      key: '${keyId}',
      amount: ${amount},
      currency: '${currency}',
      order_id: '${orderId}',
      name: 'EasyRidess',
      description: 'Cab Booking Payment',
      prefill: {
        name: '${prefillName}',
        contact: '${prefillContact}',
      },
      theme: { color: '#ffffff' },
      handler: function(response) {
        send({
          type: 'success',
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: function() {
          send({ type: 'dismissed' });
        }
      }
    };

    var rzp = new Razorpay(options);

    rzp.on('payment.failed', function(response) {
      send({
        type: 'failed',
        description: response.error.description || 'Payment failed',
      });
    });

    rzp.open();
  </script>
</body>
</html>`;
}

export default function RazorpayCheckout({ visible, orderData, userData, onSuccess, onDismiss, onFail }) {
  if (!visible || !orderData) return null;

  const html = getCheckoutHTML({
    keyId: orderData.keyId,
    orderId: orderData.orderId,
    amount: orderData.amount,
    currency: orderData.currency || "INR",
    prefillName: userData?.name || "",
    prefillContact: userData?.mobile || "",
  });

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "success")   onSuccess(data);
      if (data.type === "dismissed") onDismiss();
      if (data.type === "failed")    onFail(data.description || "Payment failed");
    } catch (_) {}
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Complete Payment</Text>
          <TouchableOpacity onPress={onDismiss} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <WebView
          style={styles.webview}
          source={{ html }}
          javaScriptEnabled
          onMessage={handleMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.loadingText}>Opening payment gateway...</Text>
            </View>
          )}
        />
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
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: "#111",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  cancelText: { color: "#888", fontSize: 15 },
  webview: { flex: 1 },
  loadingOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: { color: "#aaa", fontSize: 14 },
});
