import { Router } from "express";
import { getHomepageCategoryShortcut, listHomepageCategoryShortcuts } from "../controllers/homepageCategoryController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const homepageCategoryRoutes = Router();

homepageCategoryRoutes.get("/", asyncHandler(listHomepageCategoryShortcuts));
homepageCategoryRoutes.get("/:slug", asyncHandler(getHomepageCategoryShortcut));
