import { Router } from "express";
import { cancelOrder, createOrder, getOrder, listOrders, requestOrderItemReturn, requestOrderReturn } from "../controllers/orderController.js";
import { validateCoupon } from "../controllers/couponController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkoutSchema, couponCodeSchema, returnOrderSchema, validate } from "../utils/validators.js";

export const orderRoutes = Router();

orderRoutes.use(authenticateUser);
orderRoutes.post("/", validate(checkoutSchema), asyncHandler(createOrder));
orderRoutes.get("/", asyncHandler(listOrders));
orderRoutes.post("/coupons/validate", validate(couponCodeSchema), asyncHandler(validateCoupon));
orderRoutes.patch("/:id/cancel", asyncHandler(cancelOrder));
orderRoutes.patch("/:id/items/:itemId/return", validate(returnOrderSchema), asyncHandler(requestOrderItemReturn));
orderRoutes.patch("/:id/return", validate(returnOrderSchema), asyncHandler(requestOrderReturn));
orderRoutes.get("/:id", asyncHandler(getOrder));
