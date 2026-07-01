import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getPublicProduct,
  listPublicProducts,
  listVendorProducts,
  updateProduct
} from "../controllers/productController.js";
import { getVendorIncomeSummary, listVendorOrders, updateVendorOrderStatus } from "../controllers/orderController.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { orderStatusSchema, productSchema, validate } from "../utils/validators.js";

export const productRoutes = Router();
export const vendorRoutes = Router();

productRoutes.get("/", asyncHandler(listPublicProducts));
productRoutes.get("/:id", asyncHandler(getPublicProduct));
productRoutes.post("/", authenticateUser, requireRole("vendor"), validate(productSchema), asyncHandler(createProduct));
productRoutes.put("/:id", authenticateUser, requireRole("vendor"), validate(productSchema), asyncHandler(updateProduct));
productRoutes.delete("/:id", authenticateUser, requireRole("vendor"), asyncHandler(deleteProduct));

vendorRoutes.get("/products", authenticateUser, requireRole("vendor"), asyncHandler(listVendorProducts));
vendorRoutes.get("/orders", authenticateUser, requireRole("vendor"), asyncHandler(listVendorOrders));
vendorRoutes.get("/income", authenticateUser, requireRole("vendor"), asyncHandler(getVendorIncomeSummary));
vendorRoutes.patch(
  "/orders/:id/status",
  authenticateUser,
  requireRole("vendor"),
  validate(orderStatusSchema),
  asyncHandler(updateVendorOrderStatus)
);
