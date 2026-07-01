import { Router } from "express";
import { addWardrobeItem, createWardrobeCombo, deleteWardrobeCombo, listWardrobe, listWardrobeCombos, removeWardrobeItem, updateWardrobeCombo } from "../controllers/wardrobeController.js";
import { authenticateUser } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate, wardrobeComboSchema, wardrobeSchema } from "../utils/validators.js";

export const wardrobeRoutes = Router();

wardrobeRoutes.use(authenticateUser);
wardrobeRoutes.get("/", asyncHandler(listWardrobe));
wardrobeRoutes.get("/combos", asyncHandler(listWardrobeCombos));
wardrobeRoutes.post("/combos", validate(wardrobeComboSchema), asyncHandler(createWardrobeCombo));
wardrobeRoutes.put("/combos/:comboId", validate(wardrobeComboSchema), asyncHandler(updateWardrobeCombo));
wardrobeRoutes.delete("/combos/:comboId", asyncHandler(deleteWardrobeCombo));
wardrobeRoutes.post("/", validate(wardrobeSchema), asyncHandler(addWardrobeItem));
wardrobeRoutes.delete("/:productId", asyncHandler(removeWardrobeItem));
