import { io, Socket } from "socket.io-client";
import { SOCKET_BASE_URL } from "./api";

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
] as const;

export function subscribeToRide(
  rideId: string,
  customerId: string,
  onEvent: (eventName: string, payload: any) => void
): () => void {
  const socket: Socket = io(SOCKET_BASE_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    socket.emit("ride:subscribe", { rideId, customerId });
  });

  RIDE_EVENTS.forEach((eventName) => {
    socket.on(eventName, (payload: any) => onEvent(eventName, payload));
  });

  return () => {
    socket.emit("ride:unsubscribe", { rideId, customerId });
    socket.disconnect();
  };
}
