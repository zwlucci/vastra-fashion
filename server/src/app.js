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
import { orderRoutes } from "./routes/orderRoutes.js";
import { orderNotificationRoutes } from "./routes/orderNotificationRoutes.js";
import { productRoutes, vendorRoutes } from "./routes/productRoutes.js";
import { reviewRoutes } from "./routes/reviewRoutes.js";
import { vendorPublicRoutes } from "./routes/vendorPublicRoutes.js";
import { wishlistRoutes } from "./routes/wishlistRoutes.js";
import { wardrobeRoutes } from "./routes/wardrobeRoutes.js";
import { productReviewRoutes, vendorReviewRoutes } from "./routes/entityReviewRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
const uploadsDir = path.resolve(__dirname, "../uploads");
const uploadFolders = new Set(["products", "profiles", "wardrobe"]);
export const allowedOrigins = new Set([
  process.env.CLIENT_URL,
  "http://127.0.0.1:5173",
  "http://localhost:5173"
].filter(Boolean));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "22mb" }));
fs.mkdirSync(path.join(uploadsDir, "products"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "profiles"), { recursive: true });
fs.mkdirSync(path.join(uploadsDir, "wardrobe"), { recursive: true });
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
    frontend: process.env.CLIENT_URL || "http://127.0.0.1:5173"
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
app.use("/api/vendors", vendorPublicRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/wardrobe", wardrobeRoutes);
app.use("/api/product-reviews", productReviewRoutes);
app.use("/api/vendor-reviews", vendorReviewRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/order-notifications", orderNotificationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/contact", contactRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
