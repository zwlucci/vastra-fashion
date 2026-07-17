import { Router } from "express";
import multer from "multer";
import {
  createProductReview,
  createVendorReview,
  deleteProductReview,
  deleteVendorReview,
  getProductReviewEligibility,
  listProductReviews,
  listVendorReviews,
  updateProductReview,
  updateVendorReview
} from "../controllers/entityReviewController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";
import { allowedReviewImageMimeTypes, reviewImageLimit, reviewImageMaxBytes } from "../utils/imageUpload.js";
import { entityReviewSchema, validate } from "../utils/validators.js";

export const productReviewRoutes = Router();
export const vendorReviewRoutes = Router();

const productReviewUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: reviewImageMaxBytes, files: reviewImageLimit },
  fileFilter(_req, file, callback) {
    if (!allowedReviewImageMimeTypes.has(file.mimetype)) {
      return callback(new AppError("Only JPEG, PNG, and WEBP images are supported.", 400));
    }
    return callback(null, true);
  }
}).array("images", reviewImageLimit);

function parseProductReviewUpload(req, res, next) {
  if (!req.is("multipart/form-data")) return next();

  return productReviewUpload(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") return next(new AppError("Each image must be smaller than 5 MB.", 400));
      if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") return next(new AppError("You can upload a maximum of 5 images.", 400));
    }
    return next(error);
  });
}

productReviewRoutes.get("/product/:productId", asyncHandler(listProductReviews));
productReviewRoutes.get("/product/:productId/eligibility", authenticateUser, asyncHandler(getProductReviewEligibility));
productReviewRoutes.post("/product/:productId", authenticateUser, parseProductReviewUpload, validate(entityReviewSchema), asyncHandler(createProductReview));
productReviewRoutes.put("/:reviewId", authenticateUser, parseProductReviewUpload, validate(entityReviewSchema), asyncHandler(updateProductReview));
productReviewRoutes.delete("/:reviewId", authenticateUser, asyncHandler(deleteProductReview));

vendorReviewRoutes.get("/vendor/:vendorId", asyncHandler(listVendorReviews));
vendorReviewRoutes.post("/vendor/:vendorId", authenticateUser, validate(entityReviewSchema), asyncHandler(createVendorReview));
vendorReviewRoutes.put("/:reviewId", authenticateUser, validate(entityReviewSchema), asyncHandler(updateVendorReview));
vendorReviewRoutes.delete("/:reviewId", authenticateUser, asyncHandler(deleteVendorReview));
