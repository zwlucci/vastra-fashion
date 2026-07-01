import { Router } from "express";
import { createContactMessage } from "../controllers/contactController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { contactSchema, validate } from "../utils/validators.js";

export const contactRoutes = Router();

contactRoutes.post("/", validate(contactSchema), asyncHandler(createContactMessage));
