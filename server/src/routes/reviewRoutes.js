import { Router } from "express";
import { createReview, listReviews } from "../controllers/reviewController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { reviewSchema, validate } from "../utils/validators.js";

export const reviewRoutes = Router();

reviewRoutes.get("/", asyncHandler(listReviews));
reviewRoutes.post("/", authenticateUser, validate(reviewSchema), asyncHandler(createReview));
