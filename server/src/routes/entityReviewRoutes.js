import { Router } from "express";
import {
  createProductReview,
  createVendorReview,
  deleteProductReview,
  deleteVendorReview,
  listProductReviews,
  listVendorReviews,
  updateProductReview,
  updateVendorReview
} from "../controllers/entityReviewController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { entityReviewSchema, validate } from "../utils/validators.js";

export const productReviewRoutes = Router();
export const vendorReviewRoutes = Router();

productReviewRoutes.get("/product/:productId", asyncHandler(listProductReviews));
productReviewRoutes.post("/product/:productId", authenticateUser, validate(entityReviewSchema), asyncHandler(createProductReview));
productReviewRoutes.put("/:reviewId", authenticateUser, validate(entityReviewSchema), asyncHandler(updateProductReview));
productReviewRoutes.delete("/:reviewId", authenticateUser, asyncHandler(deleteProductReview));

vendorReviewRoutes.get("/vendor/:vendorId", asyncHandler(listVendorReviews));
vendorReviewRoutes.post("/vendor/:vendorId", authenticateUser, validate(entityReviewSchema), asyncHandler(createVendorReview));
vendorReviewRoutes.put("/:reviewId", authenticateUser, validate(entityReviewSchema), asyncHandler(updateVendorReview));
vendorReviewRoutes.delete("/:reviewId", authenticateUser, asyncHandler(deleteVendorReview));
