import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getPublicProduct,
  listPublicProducts,
  listSearchSuggestions,
  listVendorProducts,
  updateProduct
} from "../controllers/productController.js";
import { getDashboardUpdates, markDashboardUpdateSeen } from "../controllers/adminController.js";
import { getVendorIncomeSummary, listVendorOrders, listVendorReturnRequests, updateOrderReturnStatus, updateVendorOrderStatus } from "../controllers/orderController.js";
import { authenticateUser, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { orderStatusSchema, productSchema, validate, vendorReturnDecisionSchema } from "../utils/validators.js";

export const productRoutes = Router();
export const vendorRoutes = Router();

productRoutes.get("/", asyncHandler(listPublicProducts));
productRoutes.get("/suggestions", asyncHandler(listSearchSuggestions));
productRoutes.get("/:id", asyncHandler(getPublicProduct));
productRoutes.post("/", authenticateUser, requireRole("vendor"), validate(productSchema), asyncHandler(createProduct));
productRoutes.put("/:id", authenticateUser, requireRole("vendor"), validate(productSchema), asyncHandler(updateProduct));
productRoutes.delete("/:id", authenticateUser, requireRole("vendor"), asyncHandler(deleteProduct));

vendorRoutes.get("/products", authenticateUser, requireRole("vendor"), asyncHandler(listVendorProducts));
vendorRoutes.get("/orders", authenticateUser, requireRole("vendor"), asyncHandler(listVendorOrders));
vendorRoutes.get("/returns", authenticateUser, requireRole("vendor"), asyncHandler(listVendorReturnRequests));
vendorRoutes.get("/income", authenticateUser, requireRole("vendor"), asyncHandler(getVendorIncomeSummary));
vendorRoutes.get("/dashboard-updates", authenticateUser, requireRole("vendor"), asyncHandler(getDashboardUpdates));
vendorRoutes.patch("/dashboard-updates/:section/seen", authenticateUser, requireRole("vendor"), asyncHandler(markDashboardUpdateSeen));
vendorRoutes.patch(
  "/orders/:id/status",
  authenticateUser,
  requireRole("vendor"),
  validate(orderStatusSchema),
  asyncHandler(updateVendorOrderStatus)
);
vendorRoutes.patch(
  "/returns/:id/decision",
  authenticateUser,
  requireRole("vendor"),
  validate(vendorReturnDecisionSchema),
  asyncHandler(updateOrderReturnStatus)
);
