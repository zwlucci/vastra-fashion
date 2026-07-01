import dotenv from "dotenv";
import http from "node:http";
import { allowedOrigins, app } from "./app.js";
import { initSocket } from "./socket.js";

dotenv.config();

const port = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const server = http.createServer(app);
initSocket(server, allowedOrigins);

server.listen(port, () => {
  console.log(`VASTRA API listening on http://127.0.0.1:${port}`);
});
