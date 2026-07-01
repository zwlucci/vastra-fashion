import { Router } from "express";
import { getVendorProfile, listVendorProfileProducts, listVendorProfiles } from "../controllers/productController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const vendorPublicRoutes = Router();

vendorPublicRoutes.get("/", asyncHandler(listVendorProfiles));
vendorPublicRoutes.get("/:id", asyncHandler(getVendorProfile));
vendorPublicRoutes.get("/:id/products", asyncHandler(listVendorProfileProducts));
