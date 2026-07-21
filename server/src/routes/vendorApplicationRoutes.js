import { Router } from "express";
import {
  listVendorPlans,
  myVendorApplication,
  submitVendorApplicationPayment
} from "../controllers/vendorApplicationController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate, vendorApplicationPaymentSchema } from "../utils/validators.js";

export const vendorApplicationRoutes = Router();

vendorApplicationRoutes.get("/plans", asyncHandler(listVendorPlans));
vendorApplicationRoutes.get("/me", authenticateUser, asyncHandler(myVendorApplication));
vendorApplicationRoutes.post("/", authenticateUser, validate(vendorApplicationPaymentSchema), asyncHandler(submitVendorApplicationPayment));
