const https = require("https");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Send push notification(s) via Expo Push API (no SDK required)
async function sendExpoPushNotification(tokens, { title, body, data = {} }) {
  if (!tokens || !tokens.length) return;

  const messages = tokens
    .filter((t) => t && t.startsWith("ExponentPushToken["))
    .map((to) => ({ to, title, body, data, sound: "default", priority: "high" }));

  if (!messages.length) return;

  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(messages);
    const url = new URL(EXPO_PUSH_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { sendExpoPushNotification };
