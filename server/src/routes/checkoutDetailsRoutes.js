import { Router } from "express";
import {
  addAddress,
  addPaymentPreference,
  deleteAddress,
  deletePaymentPreference,
  listCheckoutDetails,
  setDefaultAddress,
  setDefaultPaymentPreference,
  updateAddress,
  updatePaymentPreference
} from "../controllers/checkoutDetailsController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkoutAddressSchema, paymentPreferenceSchema, validate } from "../utils/validators.js";

export const checkoutDetailsRoutes = Router();

checkoutDetailsRoutes.use(authenticateUser);
checkoutDetailsRoutes.get("/", asyncHandler(listCheckoutDetails));
checkoutDetailsRoutes.post("/addresses", validate(checkoutAddressSchema), asyncHandler(addAddress));
checkoutDetailsRoutes.patch("/addresses/:id", validate(checkoutAddressSchema), asyncHandler(updateAddress));
checkoutDetailsRoutes.delete("/addresses/:id", asyncHandler(deleteAddress));
checkoutDetailsRoutes.patch("/addresses/:id/default", asyncHandler(setDefaultAddress));
checkoutDetailsRoutes.post("/payment-preferences", validate(paymentPreferenceSchema), asyncHandler(addPaymentPreference));
checkoutDetailsRoutes.patch("/payment-preferences/:id", validate(paymentPreferenceSchema), asyncHandler(updatePaymentPreference));
checkoutDetailsRoutes.delete("/payment-preferences/:id", asyncHandler(deletePaymentPreference));
checkoutDetailsRoutes.patch("/payment-preferences/:id/default", asyncHandler(setDefaultPaymentPreference));
