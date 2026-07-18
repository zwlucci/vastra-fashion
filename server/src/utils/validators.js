import { z } from "zod";
import { isProductCategory } from "../../../shared/productCategories.mjs";
import { isProductSize } from "../../../shared/productSizes.mjs";
import { isReturnReasonCategory } from "../../../shared/returnReasons.mjs";
import { COD_REFUSAL_REASONS } from "./codPolicy.js";

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

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32, "Password reset link is invalid"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm your new password")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords must match",
  path: ["confirmPassword"]
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

export const homepageCategoryVisibilitySchema = z.object({
  visible: z.boolean()
});

export const homepageCategoryShortcutSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(80),
  mappedCategory: z.string().refine(isProductCategory, "Choose a category from the approved list"),
  iconData: z.string().optional().default(""),
  isActive: z.boolean().optional().default(true),
  displayOrder: z.coerce.number().int().min(0).max(100000).optional().default(0)
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

function parseStringArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const entityReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(5).max(1500),
  retainedImageUrls: z.preprocess(
    (value) => value === undefined ? undefined : parseStringArray(value),
    z.array(z.string()).max(5).optional()
  )
});

export const bundleSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(5),
  componentProductIds: z.array(z.string().uuid()).min(2, "Choose at least two products.").max(4, "Bundles can include at most four products."),
  discountPercentage: z.coerce.number().min(0).max(100).default(0),
  sizes: z.array(z.string().refine(isProductSize, "Choose a supported product size")).min(1, "Please select at least one shared size."),
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
  if (new Set(data.componentProductIds).size !== data.componentProductIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A bundle can only include each product once", path: ["componentProductIds"] });
  }
  if (new Set(data.sizes).size !== data.sizes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Bundle sizes must be unique", path: ["sizes"] });
  }
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

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address")
});

export const newsletterUnsubscribeSchema = z.object({
  token: z.string().trim().min(20, "Unsubscribe link is invalid")
});

export const newsletterPreferenceSchema = z.object({
  enabled: z.boolean()
});

function safeOptionalUrl(value, context) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Use a safe http or https URL", path: ["ctaUrl"] });
    }
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid URL", path: ["ctaUrl"] });
  }
}

const newsletterBroadcastBaseSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  heading: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(8000),
  ctaText: z.string().trim().max(80).optional().default(""),
  ctaUrl: z.string().trim().max(500).optional().default("")
});

export const newsletterBroadcastSchema = newsletterBroadcastBaseSchema.superRefine((data, context) => {
  safeOptionalUrl(data.ctaUrl, context);
  if (data.ctaUrl && !data.ctaText) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Add button text for the CTA URL", path: ["ctaText"] });
  }
});

export const newsletterTestSchema = newsletterBroadcastBaseSchema.extend({
  testEmail: z.string().trim().toLowerCase().email("Enter a valid test email")
}).superRefine((data, context) => {
  safeOptionalUrl(data.ctaUrl, context);
  if (data.ctaUrl && !data.ctaText) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Add button text for the CTA URL", path: ["ctaText"] });
  }
});

export const checkoutSchema = z.object({
  paymentMethod: z.enum(["card", "cod"]),
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  deliveryAddress: z.string().trim().min(5).max(300),
  savedAddressId: z.string().uuid().optional().or(z.literal("")),
  paymentPreferenceId: z.string().uuid().optional().or(z.literal("")),
  savedPaymentMethodId: z.string().uuid().optional().or(z.literal("")),
  savedCardCvv: z.string().trim().regex(/^\d{3,4}$/, "Enter a valid CVV").optional().or(z.literal("")),
  couponCode: z.string().trim().max(40).optional().default(""),
  saveShippingInfo: z.boolean().optional().default(false),
  saveAddress: z.boolean().optional().default(false),
  address: z.object({
    label: z.enum(["Home", "Work", "Other"]).optional().default("Home"),
    country: z.string().trim().min(2).max(80).optional().default("Nepal"),
    province: z.string().trim().max(100).optional().default(""),
    city: z.string().trim().max(100).optional().default(""),
    area: z.string().trim().max(140).optional().default(""),
    detailedAddress: z.string().trim().max(300).optional().default(""),
    postalCode: z.string().trim().max(20).optional().default(""),
    deliveryInstructions: z.string().trim().max(300).optional().default("")
  }).optional(),
  saveCardDetails: z.boolean().optional().default(false),
  savePaymentPreference: z.boolean().optional().default(false),
  saveCardAsDefault: z.boolean().optional().default(false),
  savedCard: z.object({
    nickname: z.string().trim().min(1).max(80).optional().default("Checkout card"),
    billingAddress: z.string().trim().max(200).optional().default(""),
    billingCity: z.string().trim().max(100).optional().default(""),
    billingState: z.string().trim().max(100).optional().default(""),
    billingCountry: z.string().trim().max(80).optional().default("Nepal"),
    postalCode: z.string().trim().max(20).optional().default("")
  }).optional(),
  card: z.object({
    cardholderName: z.string().trim().min(2).max(100),
    cardNumber: z.string().transform((value) => value.replace(/[ -]/g, "")).pipe(z.string().regex(/^\d{13,19}$/, "Enter a valid card number")),
    expiryDate: z.string().trim().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY"),
    cvv: z.string().trim().regex(/^\d{3,4}$/, "Enter a valid CVV")
  }).optional()
}).superRefine((data, context) => {
  if (data.paymentMethod !== "card") return;
  if (data.savedPaymentMethodId) {
    if (!data.savedCardCvv) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "CVV is required for saved cards", path: ["savedCardCvv"] });
    }
    return;
  }
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

const savedCardBaseSchema = {
  nickname: z.string().trim().min(1, "Card nickname is required").max(80),
  cardholderName: z.string().trim().min(2, "Cardholder name is required").max(100),
  expiryMonth: z.coerce.number().int().min(1).max(12),
  expiryYear: z.preprocess((value) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return value;
    const year = Number(digits);
    return digits.length <= 2 ? 2000 + year : year;
  }, z.coerce.number().int().min(new Date().getFullYear()).max(2100)),
  billingAddress: z.string().trim().min(3, "Billing address is required").max(200),
  billingCity: z.string().trim().min(1, "Billing city is required").max(100),
  billingState: z.string().trim().max(100).optional().default(""),
  billingCountry: z.string().trim().min(2, "Billing country is required").max(80),
  postalCode: z.string().trim().min(1, "Postal/ZIP code is required").max(20),
  isDefault: z.boolean().optional().default(false)
};

function refineSavedCardExpiry(data, context) {
  const expiry = new Date(Number(data.expiryYear), Number(data.expiryMonth), 0, 23, 59, 59, 999);
  if (expiry < new Date()) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "This saved card has expired.", path: ["expiryYear"] });
  }
}

export const savedPaymentMethodCreateSchema = z.object({
  ...savedCardBaseSchema,
  cardNumber: z.string().trim().min(1, "Test card number is required")
}).superRefine(refineSavedCardExpiry);

export const savedPaymentMethodUpdateSchema = z.object({
  ...savedCardBaseSchema,
  cardNumber: z.string().trim().optional().default("")
}).superRefine(refineSavedCardExpiry);

export const checkoutAddressSchema = z.object({
  label: z.enum(["Home", "Work", "Other"]).optional().default("Home"),
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  country: z.string().trim().min(2).max(80).default("Nepal"),
  province: z.string().trim().max(100).optional().default(""),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().max(140).optional().default(""),
  detailedAddress: z.string().trim().min(5).max(300),
  postalCode: z.string().trim().max(20).optional().default(""),
  deliveryInstructions: z.string().trim().max(300).optional().default(""),
  isDefault: z.boolean().optional().default(false)
});

export const paymentPreferenceSchema = z.object({
  method: z.enum(["cod", "card", "esewa"]),
  label: z.string().trim().max(80).optional().default(""),
  cardholderName: z.string().trim().max(100).optional().default(""),
  cardNumber: z.string().trim().optional().default(""),
  cardBrand: z.string().trim().max(40).optional().default(""),
  cardLast4: z.string().trim().regex(/^\d{4}$/, "Use the last four digits only").optional().or(z.literal("")),
  providerReference: z.string().trim().max(160).optional().default(""),
  isDefault: z.boolean().optional().default(false)
}).superRefine((data, context) => {
  if (data.method !== "card") return;
  const normalizedCardNumber = data.cardNumber.replace(/[ -]/g, "");
  if (!data.cardLast4 && !/^\d{13,19}$/.test(normalizedCardNumber)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a card number or last four digits", path: ["cardNumber"] });
  }
  if (!data.cardholderName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Cardholder name is required", path: ["cardholderName"] });
  }
});

const returnDetailsSchema = z.string().trim().max(500, "Additional details must be 500 characters or fewer").optional().default("");

export const returnOrderSchema = z.object({
  returnReasonCategory: z.string().trim().optional().default(""),
  reasonCategory: z.string().trim().optional().default(""),
  returnReasonDetails: returnDetailsSchema,
  additionalDetails: returnDetailsSchema
}).strict().superRefine((data, context) => {
  const category = data.returnReasonCategory || data.reasonCategory;
  const details = data.returnReasonDetails || data.additionalDetails;
  if (!isReturnReasonCategory(category)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose a valid return reason",
      path: ["returnReasonCategory"]
    });
  }
  if (category === "Other" && !details.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add details when choosing Other",
      path: ["returnReasonDetails"]
    });
  }
}).transform((data) => ({
  returnReasonCategory: data.returnReasonCategory || data.reasonCategory,
  returnReasonDetails: data.returnReasonDetails || data.additionalDetails
}));

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
  status: z.enum(["processing", "shipped", "delivered"]),
  explanation: z.string().trim().max(500).optional().default("")
});

export const codRefusalReportSchema = z.object({
  reason: z.enum(COD_REFUSAL_REASONS),
  additionalDetails: z.string().trim().max(500, "Additional details must be 500 characters or fewer").optional().default("")
}).strict().superRefine((data, context) => {
  if (data.reason === "Other" && !data.additionalDetails.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add details when choosing Other",
      path: ["additionalDetails"]
    });
  }
});

export const codRefusalRevocationSchema = z.object({
  revocationReason: z.string().trim().min(5, "An admin reason is required").max(800)
}).strict();

export const orderReturnStatusSchema = z.object({
  status: z.enum(["approved", "rejected", "completed"]),
  reason: z.string().trim().min(5, "A reason is required").max(800).optional()
});

export const vendorReturnDecisionSchema = z.object({
  status: z.enum(["approved", "rejected"])
}).strict();

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
