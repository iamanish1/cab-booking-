const { SOCKET_EVENT } = require("../config/constants");

let ioInstance = null;

function setSocketServer(io) {
  ioInstance = io;

  io.on("connection", (socket) => {
    socket.on("ride:subscribe", ({ rideId, customerId }) => {
      if (rideId) socket.join(`ride:${rideId}`);
      if (customerId) socket.join(`customer:${customerId}`);
    });

    socket.on("ride:unsubscribe", ({ rideId, customerId }) => {
      if (rideId) socket.leave(`ride:${rideId}`);
      if (customerId) socket.leave(`customer:${customerId}`);
    });

    socket.on("driver:subscribe", ({ driverId }) => {
      if (driverId) socket.join(`driver:${driverId}`);
    });

    socket.on("driver:unsubscribe", ({ driverId }) => {
      if (driverId) socket.leave(`driver:${driverId}`);
    });
  });
}

function emitToRide(rideId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`ride:${String(rideId)}`).emit(event, payload);
}

function emitToCustomer(customerId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`customer:${String(customerId)}`).emit(event, payload);
}

function emitToDriver(driverId, event, payload) {
  if (!ioInstance) return;
  ioInstance.to(`driver:${String(driverId)}`).emit(event, payload);
}

function emitRideLifecycle(ride, event, extra = {}) {
  const payload = {
    rideId: String(ride._id),
    status: ride.status,
    serverTime: new Date().toISOString(),
    version: ride.statusVersion,
    ...extra,
  };

  emitToRide(ride._id, event, payload);
  emitToCustomer(ride.customerId, event, payload);
}

module.exports = {
  SOCKET_EVENT,
  emitRideLifecycle,
  emitToCustomer,
  emitToDriver,
  setSocketServer,
};
