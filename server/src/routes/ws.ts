import type { FastifyInstance } from "fastify";

export function registerWsRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket) => {
    socket.on("message", (data) => socket.send(data));
  });
}