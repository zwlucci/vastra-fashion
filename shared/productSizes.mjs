export const PRODUCT_SIZES = Object.freeze([
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "Free Size"
]);

export function isProductSize(value) {
  return PRODUCT_SIZES.includes(value);
}
