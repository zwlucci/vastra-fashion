import { Router } from "express";
import { listOrderNotifications, markAllOrderNotificationsRead, markOrderNotificationRead } from "../controllers/orderNotificationController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const orderNotificationRoutes = Router();

orderNotificationRoutes.use(authenticateUser);
orderNotificationRoutes.get("/", asyncHandler(listOrderNotifications));
orderNotificationRoutes.patch("/read-all", asyncHandler(markAllOrderNotificationsRead));
orderNotificationRoutes.patch("/:id/read", asyncHandler(markOrderNotificationRead));
