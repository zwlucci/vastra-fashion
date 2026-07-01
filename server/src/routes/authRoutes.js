import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { login, me, register, resendLoginOtp, resendVerificationOtp, updateMe, verifyEmail, verifyLoginOtp } from "../controllers/authController.js";
import { authenticateUser } from "../middleware/auth.js";
import {
  loginSchema,
  loginOtpSchema,
  profileSchema,
  registerSchema,
  resendVerificationSchema,
  resendLoginOtpSchema,
  validate,
  verifyEmailSchema
} from "../utils/validators.js";

export const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), asyncHandler(register));
authRoutes.post("/login", validate(loginSchema), asyncHandler(login));
authRoutes.post("/login/verify-otp", validate(loginOtpSchema), asyncHandler(verifyLoginOtp));
authRoutes.post("/login/resend-otp", validate(resendLoginOtpSchema), asyncHandler(resendLoginOtp));
authRoutes.post("/verify-email", validate(verifyEmailSchema), asyncHandler(verifyEmail));
authRoutes.post("/resend-verification-otp", validate(resendVerificationSchema), asyncHandler(resendVerificationOtp));
authRoutes.get("/me", authenticateUser, asyncHandler(me));
authRoutes.patch("/me", authenticateUser, validate(profileSchema), asyncHandler(updateMe));
