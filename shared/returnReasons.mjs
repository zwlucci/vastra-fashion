export const RETURN_REASON_OPTIONS = [
  "Size does not fit",
  "Item arrived damaged",
  "Received the wrong item",
  "Item does not match the description",
  "Colour or appearance is different",
  "Quality was not as expected",
  "Item arrived too late",
  "Changed my mind",
  "Other"
];

export function isReturnReasonCategory(value) {
  return RETURN_REASON_OPTIONS.includes(value);
}
