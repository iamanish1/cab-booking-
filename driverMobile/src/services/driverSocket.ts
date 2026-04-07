import { io, Socket } from "socket.io-client";
import { SOCKET_BASE_URL } from "./api";

let socket: Socket | null = null;

export function connectDriverSocket(driverId: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_BASE_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    socket?.emit("driver:subscribe", { driverId });
  });

  return socket;
}

export function subscribeToRideEvents(
  rideId: string,
  onEvent: (eventName: string, payload: any) => void
): () => void {
  if (!socket) return () => {};

  socket.emit("ride:subscribe", { rideId });

  const RIDE_EVENTS = [
    "ride:driver_arriving",
    "ride:otp_ready",
    "ride:started",
    "ride:completed",
    "ride:cancelled",
  ];

  const handlers: Array<[string, (payload: any) => void]> = RIDE_EVENTS.map((event) => {
    const handler = (payload: any) => onEvent(event, payload);
    socket?.on(event, handler);
    return [event, handler];
  });

  return () => {
    socket?.emit("ride:unsubscribe", { rideId });
    handlers.forEach(([event, handler]) => socket?.off(event, handler));
  };
}

export function onRideOffer(callback: (offer: any) => void): () => void {
  if (!socket) return () => {};
  socket.on("ride:offer", callback);
  return () => socket?.off("ride:offer", callback);
}

export function disconnectDriverSocket(driverId: string): void {
  if (!socket) return;
  socket.emit("driver:unsubscribe", { driverId });
  socket.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
