function serializeDateOnly(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return "";
}

export function serializeUser(user) {
  if (!user) return null;
  const {
    password_hash: _passwordHash,
    brand_name,
    brand_description,
    phone_number,
    date_of_birth,
    profile_image_url,
    email_verified,
    email_verification_otp_hash: _otpHash,
    email_verification_expires: _otpExpires,
    email_verification_attempts: _otpAttempts,
    shipping_address,
    saved_cardholder_name,
    saved_card_last4,
    saved_card_expiry: _savedCardExpiry,
    failed_login_attempts: _failedLoginAttempts,
    locked_until: _lockedUntil,
    last_login_at: _lastLoginAt,
    last_login_ip: _lastLoginIp,
    account_suspended: _accountSuspended,
    ...rest
  } = user;
  return {
    ...rest,
    brandName: brand_name,
    brandDescription: brand_description,
    phoneNumber: phone_number || "",
    shippingAddress: shipping_address || "",
    savedCard: saved_card_last4 ? {
      cardholderName: saved_cardholder_name || "",
      last4: saved_card_last4
    } : null,
    dateOfBirth: serializeDateOnly(date_of_birth),
    profileImageUrl: profile_image_url,
    emailVerified: email_verified
  };
}

export function serializeProduct(product) {
  if (!product) return null;
  const {
    image_url,
    product_images,
    size_prices,
    color_stock_status,
    vendor_id,
    vendor_name,
    vendor_profile_image_url,
    vendor_brand_name,
    vendor_brand_description,
    rejection_reason,
    low_stock_alert_sent,
    out_of_stock_alert_sent,
    product_type,
    bundle_original_price,
    bundle_discount_percentage,
    bundle_components,
    wardrobe_enabled,
    wardrobe_image_url,
    created_at,
    updated_at,
    ...rest
  } = product;
  return {
    ...rest,
    vendorId: vendor_id,
    vendorName: vendor_name,
    vendorProfileImageUrl: vendor_profile_image_url,
    vendorBrandName: vendor_brand_name,
    vendorBrandDescription: vendor_brand_description,
    imageUrl: image_url,
    productMedia: (product_images || []).map((item) => ({ ...item, type: item.type || "image" })),
    productImages: (product_images || []).filter((item) => !item.type || item.type === "image"),
    sizePrices: size_prices || {},
    colorStockStatus: color_stock_status || {},
    rejectionReason: rejection_reason,
    lowStockAlertSent: low_stock_alert_sent,
    outOfStockAlertSent: out_of_stock_alert_sent,
    productType: product_type || "normal",
    isBundle: product_type === "bundle",
    bundleOriginalPrice: bundle_original_price === null || bundle_original_price === undefined ? null : Number(bundle_original_price),
    bundleDiscountPercentage: Number(bundle_discount_percentage || 0),
    bundleComponents: (bundle_components || []).map((component) => ({
      ...component,
      price: Number(component.price || 0),
      stock: Number(component.stock || 0),
      productType: component.productType || component.product_type || "normal"
    })),
    wardrobeEnabled: Boolean(wardrobe_enabled),
    wardrobeImageUrl: wardrobe_image_url || "",
    createdAt: created_at,
    updatedAt: updated_at
  };
}
