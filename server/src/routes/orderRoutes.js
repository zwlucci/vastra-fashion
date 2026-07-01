import { Router } from "express";
import { createOrder, getOrder, listOrders } from "../controllers/orderController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const orderRoutes = Router();

orderRoutes.use(authenticateUser);
orderRoutes.post("/", asyncHandler(createOrder));
orderRoutes.get("/", asyncHandler(listOrders));
orderRoutes.get("/:id", asyncHandler(getOrder));
