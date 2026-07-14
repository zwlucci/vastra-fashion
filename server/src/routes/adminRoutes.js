import { Router } from "express";
import { getStats, listUsers, updateUserRole } from "../controllers/adminController.js";
import { listContactMessages } from "../controllers/contactController.js";
import { openContactConversation } from "../controllers/messageController.js";
import { getNewsletterAdmin, getNewsletterStats, listNewsletterBroadcasts, sendNewsletterBroadcast, sendNewsletterTest } from "../controllers/newsletterController.js";
import { listAllOrders, updateOrderReturnStatus, updateOrderStatus } from "../controllers/orderController.js";
import { listAdminProducts, setProductStatus, updateProduct } from "../controllers/productController.js";
import { listAdminReviews, setReviewPinned } from "../controllers/reviewController.js";
import { deleteEntityReviewAsAdmin, listEntityReviewsForAdmin } from "../controllers/entityReviewController.js";
import { listWardrobeProducts, updateWardrobeProduct } from "../controllers/wardrobeController.js";
import { createCoupon, disableCoupon, listCoupons, updateCoupon } from "../controllers/couponController.js";
import {
  createAdminHomepageCategoryShortcut,
  deleteAdminHomepageCategoryShortcut,
  listAdminHomepageCategoryShortcuts,
  updateAdminHomepageCategoryShortcut,
  updateAdminHomepageCategoryVisibility
} from "../controllers/homepageCategoryController.js";
import { authenticateUser, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { couponSchema, couponToggleSchema, homepageCategoryShortcutSchema, homepageCategoryVisibilitySchema, newsletterBroadcastSchema, newsletterTestSchema, orderReturnStatusSchema, orderStatusSchema, productDecisionSchema, productSchema, reviewPinSchema, roleSchema, validate, wardrobeAdminSchema } from "../utils/validators.js";

export const adminRoutes = Router();

adminRoutes.use(authenticateUser, requireAdmin);

adminRoutes.get("/stats", asyncHandler(getStats));
adminRoutes.get("/newsletter", asyncHandler(getNewsletterAdmin));
adminRoutes.get("/newsletter/stats", asyncHandler(getNewsletterStats));
adminRoutes.get("/newsletter/broadcasts", asyncHandler(listNewsletterBroadcasts));
adminRoutes.post("/newsletter/test", validate(newsletterTestSchema), asyncHandler(sendNewsletterTest));
adminRoutes.post("/newsletter/broadcast", validate(newsletterBroadcastSchema), asyncHandler(sendNewsletterBroadcast));
adminRoutes.get("/coupons", asyncHandler(listCoupons));
adminRoutes.post("/coupons", validate(couponSchema), asyncHandler(createCoupon));
adminRoutes.patch("/coupons/:id", validate(couponToggleSchema), asyncHandler(updateCoupon));
adminRoutes.delete("/coupons/:id", asyncHandler(disableCoupon));
adminRoutes.get("/homepage-categories", asyncHandler(listAdminHomepageCategoryShortcuts));
adminRoutes.patch("/homepage-categories/visibility", validate(homepageCategoryVisibilitySchema), asyncHandler(updateAdminHomepageCategoryVisibility));
adminRoutes.post("/homepage-categories", validate(homepageCategoryShortcutSchema), asyncHandler(createAdminHomepageCategoryShortcut));
adminRoutes.patch("/homepage-categories/:id", validate(homepageCategoryShortcutSchema), asyncHandler(updateAdminHomepageCategoryShortcut));
adminRoutes.delete("/homepage-categories/:id", asyncHandler(deleteAdminHomepageCategoryShortcut));
adminRoutes.get("/orders", asyncHandler(listAllOrders));
adminRoutes.patch("/orders/:id/status", validate(orderStatusSchema), asyncHandler(updateOrderStatus));
adminRoutes.patch("/orders/:id/return-status", validate(orderReturnStatusSchema), asyncHandler(updateOrderReturnStatus));
adminRoutes.get("/products", asyncHandler(listAdminProducts));
adminRoutes.put("/products/:id", validate(productSchema), asyncHandler(updateProduct));
adminRoutes.patch("/products/:id/approve", validate(productDecisionSchema), (req, _res, next) => {
  req.params.status = "approved";
  next();
}, asyncHandler(setProductStatus));
adminRoutes.patch("/products/:id/reject", validate(productDecisionSchema), (req, _res, next) => {
  req.params.status = "rejected";
  next();
}, asyncHandler(setProductStatus));
adminRoutes.get("/contact-messages", asyncHandler(listContactMessages));
adminRoutes.post("/contact-messages/:id/conversation", asyncHandler(openContactConversation));
adminRoutes.get("/users", asyncHandler(listUsers));
adminRoutes.patch("/users/:id/role", validate(roleSchema), asyncHandler(updateUserRole));
adminRoutes.get("/reviews", asyncHandler(listAdminReviews));
adminRoutes.patch("/reviews/:id/pin", validate(reviewPinSchema), asyncHandler(setReviewPinned));
adminRoutes.get("/entity-reviews", asyncHandler(listEntityReviewsForAdmin));
adminRoutes.delete("/entity-reviews/:type/:id", asyncHandler(deleteEntityReviewAsAdmin));
adminRoutes.get("/wardrobe/products", asyncHandler(listWardrobeProducts));
adminRoutes.patch("/wardrobe/products/:id", validate(wardrobeAdminSchema), asyncHandler(updateWardrobeProduct));
