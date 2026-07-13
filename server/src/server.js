import dotenv from "dotenv";
import http from "node:http";
import { networkInterfaces } from "node:os";
import { app, corsOrigin } from "./app.js";
import { initSocket } from "./socket.js";

dotenv.config();

const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const server = http.createServer(app);
initSocket(server, corsOrigin);

server.listen(port, host, () => {
  const networkAddresses = Object.values(networkInterfaces())
    .flat()
    .filter((address) => address?.family === "IPv4" && !address.internal)
    .map((address) => address.address);

  console.log(`Backend local:   http://localhost:${port}`);
  networkAddresses.forEach((address) => {
    console.log(`Backend network: http://${address}:${port}`);
  });
});
