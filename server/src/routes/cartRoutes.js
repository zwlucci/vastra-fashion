import { Router } from "express";
import { addToCart, getCart, removeCartItem, updateCartItem } from "../controllers/cartController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cartSchema, quantitySchema, validate } from "../utils/validators.js";

export const cartRoutes = Router();

cartRoutes.use(authenticateUser);
cartRoutes.get("/", asyncHandler(getCart));
cartRoutes.post("/", validate(cartSchema), asyncHandler(addToCart));
cartRoutes.put("/:itemId", validate(quantitySchema), asyncHandler(updateCartItem));
cartRoutes.delete("/:itemId", asyncHandler(removeCartItem));
