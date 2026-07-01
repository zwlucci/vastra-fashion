import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { AppError } from "./errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, "../../uploads");
const maxBytes = 3 * 1024 * 1024;
const maxVideoBytes = 15 * 1024 * 1024;
const allowedMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);
const allowedVideoMimeTypes = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"]
]);

export async function saveImage(imageData, folder) {
  if (!imageData) return null;

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(imageData);
  if (!match) {
    throw new AppError("Image upload must be a valid base64 data URL", 400);
  }

  const [, mimeType, base64] = match;
  const extension = allowedMimeTypes.get(mimeType);
  if (!extension) {
    throw new AppError("Image must be JPG, PNG, WEBP, or GIF", 400);
  }

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > maxBytes) {
    throw new AppError("Image must be smaller than 3MB", 400);
  }

  const uploadRoot = path.join(uploadsRoot, folder);
  await fs.mkdir(uploadRoot, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadRoot, fileName), buffer);
  return `/uploads/${folder}/${fileName}`;
}

export async function saveProductImage(imageData) {
  return saveImage(imageData, "products");
}

export async function saveWardrobeImage(imageData) {
  return saveImage(imageData, "wardrobe");
}

export async function saveProductMedia(mediaData, declaredType = "image") {
  if (!mediaData) return null;
  if (declaredType === "image") return saveProductImage(mediaData);

  const match = /^data:(video\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(mediaData);
  if (!match) throw new AppError("Video upload must be a valid base64 data URL", 400);
  const [, mimeType, base64] = match;
  const extension = allowedVideoMimeTypes.get(mimeType);
  if (!extension) throw new AppError("Video must be MP4 or WEBM", 400);
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > maxVideoBytes) {
    throw new AppError("Video must be smaller than 15MB", 400);
  }
  const uploadRoot = path.join(uploadsRoot, "products");
  await fs.mkdir(uploadRoot, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadRoot, fileName), buffer);
  return `/uploads/products/${fileName}`;
}

export async function saveProfileImage(imageData) {
  if (!imageData) return null;

  // Validate the avatar with the same rules as stored uploads, but keep the
  // compact data URL in the user record so profile images are not dependent on
  // static file path resolution in local development.
  await saveImage(imageData, "profiles");
  return imageData;
}
