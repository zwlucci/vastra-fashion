import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { AppError } from "./errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, "../../uploads");
const maxBytes = 3 * 1024 * 1024;
const maxVideoBytes = 15 * 1024 * 1024;
export const reviewImageLimit = 5;
export const reviewImageMaxBytes = 5 * 1024 * 1024;
const allowedMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);
export const allowedReviewImageMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);
const allowedVideoMimeTypes = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"]
]);

function hasImageSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

async function writeUpload(buffer, folder, extension) {
  const uploadRoot = path.join(uploadsRoot, folder);
  await fs.mkdir(uploadRoot, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadRoot, fileName), buffer);
  return `/uploads/${folder}/${fileName}`;
}

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

  return writeUpload(buffer, folder, extension);
}

export async function saveProductImage(imageData) {
  return saveImage(imageData, "products");
}

export async function saveWardrobeImage(imageData) {
  return saveImage(imageData, "wardrobe");
}

export async function saveHomepageCategoryIcon(imageData) {
  return saveImage(imageData, "homepage-categories");
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
  return writeUpload(buffer, "products", extension);
}

export async function saveReviewImageFiles(files = []) {
  if (!files.length) return [];
  if (files.length > reviewImageLimit) {
    throw new AppError("You can upload a maximum of 5 images.", 400);
  }

  for (const file of files) {
    const extension = allowedReviewImageMimeTypes.get(file.mimetype);
    if (!extension || !hasImageSignature(file.buffer, file.mimetype)) {
      throw new AppError("Only JPEG, PNG, and WEBP images are supported.", 400);
    }
    if (!file.buffer.length || file.buffer.length > reviewImageMaxBytes) {
      throw new AppError("Each image must be smaller than 5 MB.", 400);
    }
  }

  const imageUrls = [];
  try {
    for (const file of files) {
      imageUrls.push(await writeUpload(file.buffer, "product-reviews", allowedReviewImageMimeTypes.get(file.mimetype)));
    }
  } catch (error) {
    await deleteUploadedFiles(imageUrls);
    throw error;
  }
  return imageUrls;
}

export async function deleteUploadedFiles(urls = []) {
  await Promise.all((urls || []).map(async (url) => {
    if (!url || typeof url !== "string" || !url.startsWith("/uploads/")) return;
    const relativePath = url.replace(/^\/uploads\//, "");
    const absolutePath = path.resolve(uploadsRoot, relativePath);
    if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) return;
    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      if (error.code !== "ENOENT") console.warn(`[VASTRA upload cleanup] Could not delete ${url}`);
    }
  }));
}

export async function saveProfileImage(imageData) {
  if (!imageData) return null;

  // Validate the avatar with the same rules as stored uploads, but keep the
  // compact data URL in the user record so profile images are not dependent on
  // static file path resolution in local development.
  await saveImage(imageData, "profiles");
  return imageData;
}
