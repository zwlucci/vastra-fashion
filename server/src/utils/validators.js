import { z } from "zod";
import { isProductCategory } from "../../../shared/productCategories.mjs";
import { isProductSize } from "../../../shared/productSizes.mjs";

const optionalPhoneSchema = z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").optional().or(z.literal(""));
const optionalBirthDateSchema = z.string().date().refine((value) => value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10), "Enter a valid date of birth").optional().or(z.literal(""));

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phoneNumber: optionalPhoneSchema,
  dateOfBirth: optionalBirthDateSchema
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceToken: z.string().min(32).max(256)
});

export const loginOtpSchema = z.object({
  challengeId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  deviceToken: z.string().min(32).max(256)
});

export const resendLoginOtpSchema = z.object({
  challengeId: z.string().uuid()
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits")
});

export const resendVerificationSchema = z.object({
  email: z.string().email()
});

export const productSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
  price: z.coerce.number().nonnegative(),
  category: z.string().refine(isProductCategory, "Choose a category from the approved list"),
  gender: z.enum(["Men", "Women", "Unisex"]).default("Unisex"),
  sizes: z.array(z.string().refine(isProductSize, "Choose a supported product size")).min(1, "Please select at least one size."),
  sizePrices: z.record(z.coerce.number().nonnegative()).default({}),
  colors: z.array(z.string()).default([]),
  colorStockStatus: z.record(z.boolean()).default({}),
  stock: z.coerce.number().int().nonnegative(),
  images: z.array(z.object({
    color: z.string().optional().default(""),
    url: z.string().optional().default(""),
    imageData: z.string().optional().default("")
  })).default([]),
  media: z.array(z.object({
    color: z.string().optional().default(""),
    url: z.string().optional().default(""),
    mediaData: z.string().optional().default(""),
    type: z.enum(["image", "video"]).default("image")
  })).default([]),
  imageData: z.string().optional()
}).superRefine((data, context) => {
  Object.keys(data.sizePrices).forEach((size) => {
    if (!data.sizes.includes(size) || !isProductSize(size)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Size prices must match selected supported sizes", path: ["sizePrices", size] });
    }
  });
  if (!data.media.length && !data.images.length && !data.imageData) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "At least one product image or video is required", path: ["media"] });
  }
  const colorKeys = new Set(data.colors.map((color) => color.trim()).filter(Boolean));
  const normalizedColorKeys = data.colors.map((color) => color.trim().toLocaleLowerCase()).filter(Boolean);
  if (new Set(normalizedColorKeys).size !== normalizedColorKeys.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Color names must be unique", path: ["colors"] });
  }
  data.media.forEach((item, index) => {
    if (item.color.trim() && !colorKeys.has(item.color.trim())) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Media color must match a product color", path: ["media", index, "color"] });
    }
  });
  data.images.forEach((item, index) => {
    if (item.color.trim() && !colorKeys.has(item.color.trim())) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Image color must match a product color", path: ["images", index, "color"] });
    }
  });
});

export const cartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  selectedSize: z.string().optional().default(""),
  selectedColor: z.string().optional().default("")
});

export const wishlistSchema = z.object({
  productId: z.string().uuid()
});

export const wardrobeSchema = z.object({
  productId: z.string().uuid()
});

export const wardrobeAdminSchema = z.object({
  wardrobeEnabled: z.boolean().optional(),
  wardrobeImageData: z.string().optional().default(""),
  removeWardrobeImage: z.boolean().optional().default(false)
});

const wardrobeComboItemSchema = z.object({
  productId: z.string().uuid(),
  x: z.coerce.number().finite().min(0).max(5000),
  y: z.coerce.number().finite().min(0).max(5000),
  size: z.coerce.number().finite().min(40).max(1000),
  z: z.coerce.number().int().min(1).max(100000)
});

export const wardrobeComboSchema = z.object({
  name: z.string().trim().min(2).max(80),
  items: z.array(wardrobeComboItemSchema).min(1, "Place at least one item on the board.").max(30)
}).superRefine((data, context) => {
  const ids = data.items.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A product can only appear once in a combo", path: ["items"] });
  }
});

export const entityReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(5).max(1500)
});

export const messageReplySchema = z.object({
  body: z.string().trim().min(1)
});

export const conversationArchiveSchema = z.object({
  archived: z.boolean()
});

export const startVendorChatSchema = z.object({
  productId: z.string().uuid().optional(),
  body: z.string().trim().max(1000).optional().default("")
});

export const reviewSchema = z.object({
  body: z.string().trim().min(5).max(800),
  rating: z.coerce.number().int().min(1).max(5).optional()
});

export const reviewPinSchema = z.object({
  pinned: z.boolean()
});

export const productDecisionSchema = z.object({
  reason: z.string().trim().min(5).optional()
});

export const quantitySchema = z.object({
  quantity: z.coerce.number().int().positive()
});

export const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(2),
  message: z.string().min(5)
});

export const checkoutSchema = z.object({
  paymentMethod: z.enum(["card", "cod"]),
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  deliveryAddress: z.string().trim().min(5).max(300),
  couponCode: z.string().trim().max(40).optional().default(""),
  saveShippingInfo: z.boolean().optional().default(false),
  saveCardDetails: z.boolean().optional().default(false),
  card: z.object({
    cardholderName: z.string().trim().min(2).max(100),
    cardNumber: z.string().transform((value) => value.replace(/[ -]/g, "")).pipe(z.string().regex(/^\d{13,19}$/, "Enter a valid card number")),
    expiryDate: z.string().trim().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY"),
    cvv: z.string().trim().regex(/^\d{3,4}$/, "Enter a valid CVV")
  }).optional()
}).superRefine((data, context) => {
  if (data.paymentMethod !== "card") return;
  if (!data.card) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Card details are required", path: ["card"] });
    return;
  }
  const [month, year] = data.card.expiryDate.split("/").map(Number);
  const expiry = new Date(2000 + year, month, 0, 23, 59, 59, 999);
  if (expiry < new Date()) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Card has expired", path: ["card", "expiryDate"] });
  }
});

export const returnOrderSchema = z.object({
  reason: z.string().trim().max(500).optional().default("")
});

export const couponCodeSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes, or underscores only")
});

export const couponSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes, or underscores only"),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().positive().max(1000000),
  enabled: z.boolean().optional().default(true)
}).superRefine((data, context) => {
  if (data.discountType === "percentage" && data.discountValue > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Percentage discount cannot exceed 100", path: ["discountValue"] });
  }
});

export const couponToggleSchema = z.object({ enabled: z.boolean() });

export const orderStatusSchema = z.object({
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
  explanation: z.string().trim().max(500).optional().default("")
});

export const orderReturnStatusSchema = z.object({
  status: z.enum(["approved", "rejected", "completed"])
});

export const roleSchema = z.object({
  role: z.enum(["user", "vendor", "admin"])
});

export const profileSchema = z.object({
  name: z.string().min(2).optional(),
  phoneNumber: optionalPhoneSchema,
  dateOfBirth: optionalBirthDateSchema,
  brandName: z.string().min(2).optional(),
  brandDescription: z.string().optional(),
  profileImageData: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional()
}).refine((data) => !data.newPassword || data.currentPassword, {
  message: "Current password is required to change password",
  path: ["currentPassword"]
});

export function validate(schema, source = "body") {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        issues: parsed.error.flatten().fieldErrors
      });
    }
    req[source] = parsed.data;
    return next();
  };
}
