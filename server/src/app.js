import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { adminRoutes } from "./routes/adminRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { cartRoutes } from "./routes/cartRoutes.js";
import { contactRoutes } from "./routes/contactRoutes.js";
import { messageRoutes } from "./routes/messageRoutes.js";
import { newsletterRoutes } from "./routes/newsletterRoutes.js";
import { orderRoutes } from "./routes/orderRoutes.js";
import { orderNotificationRoutes } from "./routes/orderNotificationRoutes.js";
import { productRoutes, vendorRoutes } from "./routes/productRoutes.js";
import { reviewRoutes } from "./routes/reviewRoutes.js";
import { homepageCategoryRoutes } from "./routes/homepageCategoryRoutes.js";
import { vendorPublicRoutes } from "./routes/vendorPublicRoutes.js";
import { wishlistRoutes } from "./routes/wishlistRoutes.js";
import { wardrobeRoutes } from "./routes/wardrobeRoutes.js";
import { productReviewRoutes, vendorReviewRoutes } from "./routes/entityReviewRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
const uploadsDir = path.resolve(__dirname, "../uploads");
const uploadFolders = new Set(["products", "profiles", "wardrobe", "homepage-categories"]);
const frontendPort = String(process.env.FRONTEND_PORT || "5173");
export const allowedOrigins = new Set([
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || "").split(",").map((origin) => origin.trim()),
  `http://127.0.0.1:${frontendPort}`,
  `http://localhost:${frontendPort}`
].filter(Boolean));

function isPrivateNetworkHostname(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

export function corsOrigin(origin, callback) {
  if (!origin || allowedOrigins.has(origin)) return callback(null, true);

  try {
    const url = new URL(origin);
    if (url.protocol === "http:" && url.port === frontendPort && isPrivateNetworkHostname(url.hostname)) {
      return callback(null, true);
    }
  } catch {
    // Invalid origins are rejected below.
  }

  return callback(new Error(`CORS blocked origin: ${origin}`));
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "22mb" }));
fs.mkdirSync(path.join(uploadsDir, "products"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "profiles"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "wardrobe"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "homepage-categories"), { recursive: true });
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders(res) {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
  })
);
app.use(morgan("dev"));

app.get("/uploads/:folder/:file", (req, res) => {
  const { folder, file } = req.params;
  if (!uploadFolders.has(folder) || file !== path.basename(file)) {
    return res.status(404).json({ message: "Uploaded file not found" });
  }

  return res.sendFile(path.join(uploadsDir, folder, file), (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({ message: "Uploaded file not found" });
    }
  });
});

app.get("/", (_req, res) => {
  res.json({
    message: "VASTRA API is running",
    health: "/api/health",
    apiBase: "/api",
    frontend: process.env.CLIENT_URL || `http://localhost:${frontendPort}`
  });
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).send();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "vastra-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/homepage-categories", homepageCategoryRoutes);
app.use("/api/vendors", vendorPublicRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/wardrobe", wardrobeRoutes);
app.use("/api/product-reviews", productReviewRoutes);
app.use("/api/vendor-reviews", vendorReviewRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/order-notifications", orderNotificationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/contact", contactRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
