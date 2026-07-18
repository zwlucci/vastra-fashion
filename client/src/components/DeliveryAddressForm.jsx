import React from "react";

function FieldError({ children }) {
  return children ? <span className="mt-1 block text-xs font-semibold text-red-600 dark:text-red-300">{children}</span> : null;
}

function firstError(errors, field) {
  const value = errors?.[field];
  return Array.isArray(value) ? value[0] : value;
}

export const emptyDeliveryAddress = {
  label: "Home",
  fullName: "",
  phoneNumber: "",
  country: "Nepal",
  province: "",
  city: "",
  area: "",
  detailedAddress: "",
  postalCode: "",
  deliveryInstructions: "",
  isDefault: false
};

export function deliveryAddressFromSaved(address = {}) {
  return {
    label: address.label || "Home",
    fullName: address.fullName || "",
    phoneNumber: address.phoneNumber || "",
    country: address.country || "Nepal",
    province: address.province || "",
    city: address.city || "",
    area: address.area || "",
    detailedAddress: address.detailedAddress || "",
    postalCode: address.postalCode || "",
    deliveryInstructions: address.deliveryInstructions || "",
    isDefault: Boolean(address.isDefault)
  };
}

export function addressSummary(address = {}) {
  return [address.detailedAddress, address.area, address.city, address.province, address.postalCode, address.country].filter(Boolean).join(", ");
}

export function validateDeliveryAddress(address) {
  const errors = {};
  if (address.fullName.trim().length < 2) errors.fullName = "Recipient name is required.";
  if (!/^\+?[0-9 ()-]{7,20}$/.test(address.phoneNumber.trim())) errors.phoneNumber = "Enter a valid phone number.";
  if (address.country.trim().length < 2) errors.country = "Country is required.";
  if (!address.city.trim()) errors.city = "City is required.";
  if (address.detailedAddress.trim().length < 5) errors.detailedAddress = "Street/address is required.";
  return errors;
}

export function DeliveryAddressForm({ value, onChange, errors = {}, showDefault = true }) {
  const form = { ...emptyDeliveryAddress, ...value };
  const update = (field, fieldValue) => onChange({ ...form, [field]: fieldValue });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Label<select className="mt-1 w-full" value={form.label} onChange={(event) => update("label", event.target.value)}><option>Home</option><option>Work</option><option>Other</option></select></label>
        <label className="text-sm font-semibold">Recipient name<input className="mt-1 w-full" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} /><FieldError>{firstError(errors, "fullName")}</FieldError></label>
        <label className="text-sm font-semibold">Phone<input className="mt-1 w-full" value={form.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} /><FieldError>{firstError(errors, "phoneNumber")}</FieldError></label>
        <label className="text-sm font-semibold">City<input className="mt-1 w-full" value={form.city} onChange={(event) => update("city", event.target.value)} /><FieldError>{firstError(errors, "city")}</FieldError></label>
        <label className="text-sm font-semibold">Province/state<input className="mt-1 w-full" value={form.province} onChange={(event) => update("province", event.target.value)} /></label>
        <label className="text-sm font-semibold">Country<input className="mt-1 w-full" value={form.country} onChange={(event) => update("country", event.target.value)} /><FieldError>{firstError(errors, "country")}</FieldError></label>
        <label className="text-sm font-semibold">Area/street<input className="mt-1 w-full" value={form.area} onChange={(event) => update("area", event.target.value)} /></label>
        <label className="text-sm font-semibold">Postal/ZIP<input className="mt-1 w-full" value={form.postalCode} onChange={(event) => update("postalCode", event.target.value)} /><FieldError>{firstError(errors, "postalCode")}</FieldError></label>
      </div>
      <label className="block text-sm font-semibold">Street/address<textarea className="mt-1 w-full" rows="3" value={form.detailedAddress} onChange={(event) => update("detailedAddress", event.target.value)} /><FieldError>{firstError(errors, "detailedAddress")}</FieldError></label>
      <label className="block text-sm font-semibold">Delivery instructions<textarea className="mt-1 w-full" rows="2" value={form.deliveryInstructions} onChange={(event) => update("deliveryInstructions", event.target.value)} /></label>
      {showDefault && <label className="flex items-center gap-2 text-sm"><input checked={form.isDefault} onChange={(event) => update("isDefault", event.target.checked)} type="checkbox" /> Set as default</label>}
    </div>
  );
}
