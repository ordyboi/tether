import type { FastifyInstance } from "fastify";

export function registerWsRoutes(app: FastifyInstance) {
  // TODO: add authentication (JWT handshake), origin check, and per-IP
  // connection limits before this becomes the production location transport.
  app.get("/ws", { websocket: true }, (socket) => {
    socket.on("message", (data) => socket.send(data));
  });
}