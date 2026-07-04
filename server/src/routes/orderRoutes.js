import { Router } from "express";
import { cancelOrder, createOrder, getOrder, listOrders, requestOrderReturn } from "../controllers/orderController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkoutSchema, returnOrderSchema, validate } from "../utils/validators.js";

export const orderRoutes = Router();

orderRoutes.use(authenticateUser);
orderRoutes.post("/", validate(checkoutSchema), asyncHandler(createOrder));
orderRoutes.get("/", asyncHandler(listOrders));
orderRoutes.patch("/:id/cancel", asyncHandler(cancelOrder));
orderRoutes.patch("/:id/return", validate(returnOrderSchema), asyncHandler(requestOrderReturn));
orderRoutes.get("/:id", asyncHandler(getOrder));
