import { io } from "socket.io-client";
import { API_BASE_URL } from "./api";

const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/v1$/, "");

const RIDE_EVENTS = [
  "ride:searching",
  "ride:driver_assigned",
  "ride:driver_location",
  "ride:driver_arriving",
  "ride:otp_ready",
  "ride:started",
  "ride:completed",
  "ride:cancelled",
  "wallet:updated",
];

export function subscribeToRide({ rideId, customerId, onEvent }) {
  const socket = io(SOCKET_BASE_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    socket.emit("ride:subscribe", { rideId, customerId });
  });

  RIDE_EVENTS.forEach((eventName) => {
    socket.on(eventName, (payload) => {
      onEvent?.(eventName, payload);
    });
  });

  return () => {
    socket.emit("ride:unsubscribe", { rideId, customerId });
    socket.disconnect();
  };
}
