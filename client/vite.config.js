import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_DEV_BACKEND_URL || `http://127.0.0.1:${env.VITE_API_PORT || "5000"}`;

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      proxy: {
        "/api": { target: backendTarget, changeOrigin: true },
        "/uploads": { target: backendTarget, changeOrigin: true },
        "/socket.io": { target: backendTarget, changeOrigin: true, ws: true }
      }
    }
  };
});
