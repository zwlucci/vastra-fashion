import { Router } from "express";
import { addToWishlist, getWishlist, removeFromWishlist } from "../controllers/wishlistController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate, wishlistSchema } from "../utils/validators.js";

export const wishlistRoutes = Router();

wishlistRoutes.use(authenticateUser);
wishlistRoutes.get("/", asyncHandler(getWishlist));
wishlistRoutes.post("/", validate(wishlistSchema), asyncHandler(addToWishlist));
wishlistRoutes.delete("/:productId", asyncHandler(removeFromWishlist));
