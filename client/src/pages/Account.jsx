import { CreditCard, Edit3, Eye, EyeOff, MapPin, Plus, ShieldCheck, Star, Trash2, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import { roleLabel } from "../utils/format.js";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function profileFromUser(user) {
  return {
    name: user?.name || "",
    phoneNumber: user?.phoneNumber || "",
    dateOfBirth: user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : "",
    brandName: user?.brandName || "",
    brandDescription: user?.brandDescription || "",
    profileImageData: ""
  };
}

function Detail({ label, children }) {
  return <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 break-words font-semibold">{children || "Not provided"}</p></div>;
}

function NewsletterPreference() {
  const { showNotice } = useNotification();
  const [enabled, setEnabled] = useState(null);
  const [saving, setSaving] = useState(false);
  const loading = enabled === null;

  useEffect(() => {
    let active = true;
    api.get("/newsletter/preference")
      .then(({ data }) => {
        if (active) setEnabled(Boolean(data.newsletterEnabled));
      })
      .catch(() => {
        if (active) {
          setEnabled(false);
          showNotice("Unable to load your newsletter preference.", "error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function togglePreference() {
    if (loading || saving) return;
    const previous = enabled;
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const { data } = await api.patch("/newsletter/preference", { enabled: next });
      setEnabled(Boolean(data.newsletterEnabled));
      showNotice(data.message || (data.newsletterEnabled ? "Newsletter emails enabled." : "Newsletter emails disabled."));
    } catch {
      setEnabled(previous);
      showNotice("Unable to update your newsletter subscription. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">Email preferences</h2>
          <p className="mt-1 text-sm font-semibold">Receive newsletter emails</p>
          <p className="text-sm text-neutral-500">Get promotional offers, new arrivals, and other VASTRA updates by email.</p>
        </div>
        <button
          aria-checked={Boolean(enabled)}
          aria-label="Receive newsletter emails"
          className={`relative h-8 w-14 rounded-full border-2 transition focus:outline-none focus:ring-2 focus:ring-clay focus:ring-offset-2 dark:focus:ring-offset-neutral-950 ${enabled ? "border-clay bg-clay" : "border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"} ${loading || saving ? "cursor-not-allowed opacity-60" : ""}`}
          disabled={loading || saving}
          onClick={togglePreference}
          role="switch"
          type="button"
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-7" : "left-1"}`} />
        </button>
      </div>
      <p className="text-xs font-semibold text-neutral-500">{loading ? "Loading newsletter preference..." : saving ? "Saving preference..." : enabled ? "Newsletter emails are on." : "Newsletter emails are off."}</p>
    </section>
  );
}

const emptyAddress = {
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

const emptySavedCard = {
  nickname: "",
  cardholderName: "",
  cardNumber: "",
  expiryMonth: "",
  expiryYear: "",
  billingAddress: "",
  billingCity: "",
  billingState: "",
  billingCountry: "Nepal",
  postalCode: "",
  isDefault: false
};

function formatCardNumber(value) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}

function detectCardBrand(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  return "Card";
}

function normalizeExpiryYear(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return NaN;
  const year = Number(digits);
  return digits.length <= 2 ? 2000 + year : year;
}

function ConfirmDialog({ confirm, onCancel, onConfirm }) {
  if (!confirm) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft dark:bg-neutral-900">
        <h3 className="text-lg font-black">{confirm.title}</h3>
        <p className="mt-2 text-sm text-neutral-500">{confirm.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} type="button">Cancel</button>
          <button className="btn-primary" onClick={onConfirm} type="button">{confirm.action || "Continue"}</button>
        </div>
      </div>
    </div>
  );
}

function FormModal({ title, subtitle, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-soft dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5 dark:border-neutral-800">
          <div>
            <h3 className="text-xl font-black">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
          </div>
          <button className="btn-secondary h-10 w-10 shrink-0 px-0" onClick={onClose} type="button" title="Close"><X size={17} /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function FieldError({ children }) {
  return children ? <span className="mt-1 block text-xs font-semibold text-red-600 dark:text-red-300">{children}</span> : null;
}

function addressSummary(address) {
  return [address.detailedAddress, address.area, address.city, address.province, address.postalCode, address.country].filter(Boolean).join(", ");
}

function CodReliabilityCard({ codPolicy }) {
  if (!codPolicy) return null;
  const restricted = !codPolicy.codAvailable;
  return (
    <section className={`rounded-lg border p-4 ${restricted ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950" : "border-neutral-200 dark:border-neutral-800"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">COD Order Reliability</p>
          <h3 className="mt-1 text-xl font-black">COD Refusals: {codPolicy.activeRefusalCount} of {codPolicy.refusalLimit}</h3>
          <p className="mt-1 text-sm font-semibold">COD Status: {codPolicy.statusLabel}</p>
        </div>
        <span className={`badge ${restricted ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"}`}>{restricted ? "Restricted" : "Available"}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{codPolicy.warning || "Cash on Delivery is available. Three confirmed delivery refusals will disable COD for your account while online payment methods remain available."}</p>
    </section>
  );
}

function SavedCheckoutDetails() {
  const { user, updateProfile } = useAuth();
  const { showNotice } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState({ contact: null, addresses: [], paymentPreferences: [], savedPaymentMethods: [], demoSavedCardsEnabled: false, codPolicy: null });
  const [contact, setContact] = useState({ fullName: user?.name || "", phoneNumber: user?.phoneNumber || "" });
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressErrors, setAddressErrors] = useState({});
  const [savedCardForm, setSavedCardForm] = useState(emptySavedCard);
  const [editingSavedCardId, setEditingSavedCardId] = useState("");
  const [savedCardModalOpen, setSavedCardModalOpen] = useState(false);
  const [savedCardErrors, setSavedCardErrors] = useState({});
  const [showSavedCardNumber, setShowSavedCardNumber] = useState(false);
  const [confirm, setConfirm] = useState(null);

  async function loadDetails() {
    setLoading(true);
    try {
      const { data } = await api.get("/checkout-details");
      setDetails(data);
      setContact({ fullName: data.contact?.fullName || user?.name || "", phoneNumber: data.contact?.phoneNumber || user?.phoneNumber || "" });
    } catch {
      showNotice("Unable to load saved checkout details.", "error");
    } finally {
      setLoading(false);
    }
  }

  function errorsFromResponse(error) {
    return error?.response?.data?.issues || {};
  }

  function firstError(errors, field) {
    const value = errors?.[field];
    return Array.isArray(value) ? value[0] : value;
  }

  function beginAddAddress() {
    setEditingAddressId("");
    setAddressForm(emptyAddress);
    setAddressErrors({});
    setAddressModalOpen(true);
  }

  function resetSavedCardForm() {
    setSavedCardForm(emptySavedCard);
    setEditingSavedCardId("");
    setSavedCardErrors({});
    setShowSavedCardNumber(false);
    setSavedCardModalOpen(false);
  }

  useEffect(() => {
    loadDetails();
  }, []);

  async function saveContact(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name: contact.fullName, phoneNumber: contact.phoneNumber });
      showNotice("Contact details updated.");
      await loadDetails();
    } catch (err) {
      showNotice(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  function editAddress(address) {
    setEditingAddressId(address.id);
    setAddressForm({
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
    });
    setAddressErrors({});
    setAddressModalOpen(true);
  }

  function validateAddressForm() {
    const errors = {};
    if (addressForm.fullName.trim().length < 2) errors.fullName = "Recipient name is required.";
    if (!/^\+?[0-9 ()-]{7,20}$/.test(addressForm.phoneNumber.trim())) errors.phoneNumber = "Enter a valid phone number.";
    if (addressForm.country.trim().length < 2) errors.country = "Country is required.";
    if (!addressForm.city.trim()) errors.city = "City is required.";
    if (addressForm.detailedAddress.trim().length < 5) errors.detailedAddress = "Street/address is required.";
    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function saveAddress(event) {
    event.preventDefault();
    if (!validateAddressForm()) {
      showNotice("Fix the highlighted address fields.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingAddressId) {
        await api.patch(`/checkout-details/addresses/${editingAddressId}`, addressForm);
      } else {
        await api.post("/checkout-details/addresses", addressForm);
      }
      setAddressForm(emptyAddress);
      setEditingAddressId("");
      setAddressModalOpen(false);
      setAddressErrors({});
      showNotice("Address saved.");
      await loadDetails();
    } catch (err) {
      const issues = errorsFromResponse(err);
      setAddressErrors(issues);
      showNotice(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAddress(id) {
    setConfirm({
      title: "Delete saved address?",
      body: "This removes the delivery address from your saved checkout details.",
      action: "Delete",
      onConfirm: async () => {
        setSaving(true);
        try {
          await api.delete(`/checkout-details/addresses/${id}`);
          showNotice("Address deleted.");
          await loadDetails();
        } catch (err) {
          showNotice(getErrorMessage(err), "error");
        } finally {
          setSaving(false);
          setConfirm(null);
        }
      }
    });
  }

  async function setDefaultAddress(id) {
    await api.patch(`/checkout-details/addresses/${id}/default`);
    showNotice("Default address updated.");
    await loadDetails();
  }

  async function deletePayment(id) {
    setConfirm({
      title: "Delete payment preference?",
      body: "This removes the payment preference from your saved checkout details.",
      action: "Delete",
      onConfirm: async () => {
        setSaving(true);
        try {
          await api.delete(`/checkout-details/payment-preferences/${id}`);
          showNotice("Payment preference deleted.");
          await loadDetails();
        } catch (err) {
          showNotice(getErrorMessage(err), "error");
        } finally {
          setSaving(false);
          setConfirm(null);
        }
      }
    });
  }

  async function setDefaultPayment(id) {
    await api.patch(`/checkout-details/payment-preferences/${id}/default`);
    showNotice("Default payment preference updated.");
    await loadDetails();
  }

  function beginAddSavedCard() {
    setEditingSavedCardId("");
    setSavedCardForm(emptySavedCard);
    setSavedCardErrors({});
    setShowSavedCardNumber(false);
    setSavedCardModalOpen(true);
  }

  function editSavedCard(card) {
    setEditingSavedCardId(card.id);
    setSavedCardForm({
      nickname: card.nickname || "",
      cardholderName: card.cardholderName || "",
      cardNumber: "",
      expiryMonth: String(card.expiryMonth || ""),
      expiryYear: String(card.expiryYear || "").slice(-2),
      billingAddress: card.billingAddress || "",
      billingCity: card.billingCity || "",
      billingState: card.billingState || "",
      billingCountry: card.billingCountry || "Nepal",
      postalCode: card.postalCode || "",
      isDefault: Boolean(card.isDefault)
    });
    setSavedCardErrors({});
    setShowSavedCardNumber(false);
    setSavedCardModalOpen(true);
  }

  function luhnValid(cardNumber) {
    let sum = 0;
    let doubleDigit = false;
    for (let index = cardNumber.length - 1; index >= 0; index -= 1) {
      let digit = Number(cardNumber[index]);
      if (!Number.isInteger(digit)) return false;
      if (doubleDigit) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      doubleDigit = !doubleDigit;
    }
    return sum > 0 && sum % 10 === 0;
  }

  function validateSavedCardForm() {
    const errors = {};
    const cardNumber = savedCardForm.cardNumber.replace(/[ -]/g, "");
    const now = new Date();
    const expiryMonth = Number(savedCardForm.expiryMonth);
    const expiryYear = normalizeExpiryYear(savedCardForm.expiryYear);
    if (!savedCardForm.nickname.trim()) errors.nickname = "Card nickname is required.";
    if (savedCardForm.cardholderName.trim().length < 2) errors.cardholderName = "Cardholder name is required.";
    if (!editingSavedCardId || cardNumber) {
      if (!/^\d+$/.test(cardNumber)) errors.cardNumber = "Enter digits only for the approved test card number.";
      else if (!/^\d{13,19}$/.test(cardNumber)) errors.cardNumber = "Enter a valid test card number length.";
      else if (!luhnValid(cardNumber)) errors.cardNumber = "This test card number is invalid.";
    }
    if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) errors.expiryMonth = "Enter a valid expiry month.";
    if (!Number.isInteger(expiryYear) || expiryYear < now.getFullYear() || expiryYear > 2100) errors.expiryYear = "Enter a valid expiry year, such as 30 for 2030.";
    if (!errors.expiryMonth && !errors.expiryYear && new Date(expiryYear, expiryMonth, 0, 23, 59, 59, 999) < now) {
      errors.expiryYear = "This saved card has expired.";
    }
    if (savedCardForm.billingAddress.trim().length < 3) errors.billingAddress = "Billing address is required.";
    if (!savedCardForm.billingCity.trim()) errors.billingCity = "Billing city is required.";
    if (savedCardForm.billingCountry.trim().length < 2) errors.billingCountry = "Billing country is required.";
    if (!savedCardForm.postalCode.trim()) errors.postalCode = "Postal/ZIP code is required.";
    setSavedCardErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function persistSavedCard() {
    setSaving(true);
    try {
      const payload = {
        ...savedCardForm,
        cardNumber: savedCardForm.cardNumber.replace(/[ -]/g, ""),
        expiryMonth: Number(savedCardForm.expiryMonth),
        expiryYear: normalizeExpiryYear(savedCardForm.expiryYear)
      };
      if (editingSavedCardId && !payload.cardNumber) delete payload.cardNumber;
      if (editingSavedCardId) {
        await api.patch(`/checkout-details/saved-payment-methods/${editingSavedCardId}`, payload);
      } else {
        await api.post("/checkout-details/saved-payment-methods", payload);
      }
      resetSavedCardForm();
      showNotice("Saved test card updated.");
      await loadDetails();
    } catch (err) {
      const issues = errorsFromResponse(err);
      const message = getErrorMessage(err);
      if (message.toLowerCase().includes("card")) {
        issues.cardNumber = issues.cardNumber || [message];
      }
      setSavedCardErrors(issues);
      showNotice(getErrorMessage(err), "error");
    } finally {
      setSaving(false);
      if (confirm) setConfirm(null);
    }
  }

  async function saveSavedCard(event) {
    event.preventDefault();
    if (!validateSavedCardForm()) {
      showNotice("Fix the highlighted card fields.", "error");
      return;
    }
    if (editingSavedCardId && savedCardForm.cardNumber.trim()) {
      setConfirm({
        title: "Replace saved card number?",
        body: "The existing encrypted test card number will be replaced. CVV is still never stored.",
        action: "Replace",
        onConfirm: persistSavedCard
      });
      return;
    }
    await persistSavedCard();
  }

  async function deleteSavedCard(id) {
    setConfirm({
      title: "Delete saved test card?",
      body: "This removes the card from your saved checkout options. Existing orders keep only their non-sensitive payment summary.",
      action: "Delete",
      onConfirm: async () => {
        setSaving(true);
        try {
          await api.delete(`/checkout-details/saved-payment-methods/${id}`);
          showNotice("Saved test card deleted.");
          await loadDetails();
        } catch (err) {
          showNotice(getErrorMessage(err), "error");
        } finally {
          setSaving(false);
          setConfirm(null);
        }
      }
    });
  }

  async function setDefaultSavedCard(id) {
    await api.patch(`/checkout-details/saved-payment-methods/${id}/default`);
    showNotice("Default saved card updated.");
    await loadDetails();
  }

  const defaultAddress = details.addresses.find((address) => address.isDefault);
  const defaultSavedCard = details.savedPaymentMethods?.find((card) => card.isDefault);
  const defaultPaymentPreference = details.paymentPreferences?.find((payment) => payment.isDefault);
  const legacyPaymentPreferences = (details.paymentPreferences || []).filter((payment) => payment.method !== "card" || !details.savedPaymentMethods?.length);

  return (
    <section className="space-y-5" id="saved-checkout-details">
      <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} onConfirm={() => confirm?.onConfirm?.()} />
      {addressModalOpen && <FormModal title={editingAddressId ? "Edit delivery address" : "Add delivery address"} subtitle="Saved defaults continue to autofill checkout." onClose={() => { setAddressModalOpen(false); setEditingAddressId(""); setAddressForm(emptyAddress); setAddressErrors({}); }}>
        <form className="space-y-4" onSubmit={saveAddress}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Label<select className="mt-1 w-full" value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })}><option>Home</option><option>Work</option><option>Other</option></select></label>
            <label className="text-sm font-semibold">Recipient name<input className="mt-1 w-full" value={addressForm.fullName} onChange={(event) => setAddressForm({ ...addressForm, fullName: event.target.value })} /><FieldError>{firstError(addressErrors, "fullName")}</FieldError></label>
            <label className="text-sm font-semibold">Phone<input className="mt-1 w-full" value={addressForm.phoneNumber} onChange={(event) => setAddressForm({ ...addressForm, phoneNumber: event.target.value })} /><FieldError>{firstError(addressErrors, "phoneNumber")}</FieldError></label>
            <label className="text-sm font-semibold">City<input className="mt-1 w-full" value={addressForm.city} onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })} /><FieldError>{firstError(addressErrors, "city")}</FieldError></label>
            <label className="text-sm font-semibold">Province/state<input className="mt-1 w-full" value={addressForm.province} onChange={(event) => setAddressForm({ ...addressForm, province: event.target.value })} /></label>
            <label className="text-sm font-semibold">Country<input className="mt-1 w-full" value={addressForm.country} onChange={(event) => setAddressForm({ ...addressForm, country: event.target.value })} /><FieldError>{firstError(addressErrors, "country")}</FieldError></label>
            <label className="text-sm font-semibold">Area/street<input className="mt-1 w-full" value={addressForm.area} onChange={(event) => setAddressForm({ ...addressForm, area: event.target.value })} /></label>
            <label className="text-sm font-semibold">Postal/ZIP<input className="mt-1 w-full" value={addressForm.postalCode} onChange={(event) => setAddressForm({ ...addressForm, postalCode: event.target.value })} /><FieldError>{firstError(addressErrors, "postalCode")}</FieldError></label>
          </div>
          <label className="block text-sm font-semibold">Street/address<textarea className="mt-1 w-full" rows="3" value={addressForm.detailedAddress} onChange={(event) => setAddressForm({ ...addressForm, detailedAddress: event.target.value })} /><FieldError>{firstError(addressErrors, "detailedAddress")}</FieldError></label>
          <label className="block text-sm font-semibold">Delivery instructions<textarea className="mt-1 w-full" rows="2" value={addressForm.deliveryInstructions} onChange={(event) => setAddressForm({ ...addressForm, deliveryInstructions: event.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input checked={addressForm.isDefault} onChange={(event) => setAddressForm({ ...addressForm, isDefault: event.target.checked })} type="checkbox" /> Set as default</label>
          <div className="flex flex-wrap justify-end gap-2"><button className="btn-secondary" onClick={() => setAddressModalOpen(false)} type="button">Cancel</button><button className="btn-primary" disabled={saving} type="submit">{editingAddressId ? "Save address" : "Add address"}</button></div>
        </form>
      </FormModal>}
      {savedCardModalOpen && <FormModal title={editingSavedCardId ? "Edit test card" : "Add test card"} subtitle="Development mode only. Do not enter a real debit or credit card." onClose={resetSavedCardForm}>
        <form className="space-y-4" onSubmit={saveSavedCard}>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Use approved test card details only. CVV is not saved and must be entered during checkout.</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Card nickname<input className="mt-1 w-full" value={savedCardForm.nickname} onChange={(event) => setSavedCardForm({ ...savedCardForm, nickname: event.target.value })} placeholder="Personal Visa" /><FieldError>{firstError(savedCardErrors, "nickname")}</FieldError></label>
            <label className="text-sm font-semibold">Cardholder name<input className="mt-1 w-full" value={savedCardForm.cardholderName} onChange={(event) => setSavedCardForm({ ...savedCardForm, cardholderName: event.target.value })} /><FieldError>{firstError(savedCardErrors, "cardholderName")}</FieldError></label>
            <label className="text-sm font-semibold sm:col-span-2">Approved test card number<div className="mt-1 flex gap-2"><input className="min-w-0 flex-1" inputMode="numeric" type={showSavedCardNumber ? "text" : "password"} value={savedCardForm.cardNumber} onChange={(event) => setSavedCardForm({ ...savedCardForm, cardNumber: formatCardNumber(event.target.value) })} placeholder={editingSavedCardId ? "Leave blank to keep current number" : "4242 4242 4242 4242"} /><button className="btn-secondary h-11 w-11 px-0" onClick={() => setShowSavedCardNumber((current) => !current)} type="button" title={showSavedCardNumber ? "Hide card number" : "Show card number"}>{showSavedCardNumber ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><span className="mt-1 block text-xs text-neutral-500">{detectCardBrand(savedCardForm.cardNumber)} detected. Only approved demo cards are accepted.</span><FieldError>{firstError(savedCardErrors, "cardNumber")}</FieldError></label>
            <label className="text-sm font-semibold">Expiry month<input className="mt-1 w-full" inputMode="numeric" maxLength="2" value={savedCardForm.expiryMonth} onChange={(event) => setSavedCardForm({ ...savedCardForm, expiryMonth: event.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="12" /><FieldError>{firstError(savedCardErrors, "expiryMonth")}</FieldError></label>
            <label className="text-sm font-semibold">Expiry year (YY)<input className="mt-1 w-full" inputMode="numeric" maxLength="2" value={savedCardForm.expiryYear} onChange={(event) => setSavedCardForm({ ...savedCardForm, expiryYear: event.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="30" /><span className="mt-1 block text-xs text-neutral-500">Use MM/YY format, for example 12/30.</span><FieldError>{firstError(savedCardErrors, "expiryYear")}</FieldError></label>
            <label className="text-sm font-semibold sm:col-span-2">Billing address<input className="mt-1 w-full" value={savedCardForm.billingAddress} onChange={(event) => setSavedCardForm({ ...savedCardForm, billingAddress: event.target.value })} /><FieldError>{firstError(savedCardErrors, "billingAddress")}</FieldError></label>
            <label className="text-sm font-semibold">Billing city<input className="mt-1 w-full" value={savedCardForm.billingCity} onChange={(event) => setSavedCardForm({ ...savedCardForm, billingCity: event.target.value })} /><FieldError>{firstError(savedCardErrors, "billingCity")}</FieldError></label>
            <label className="text-sm font-semibold">Province/state<input className="mt-1 w-full" value={savedCardForm.billingState} onChange={(event) => setSavedCardForm({ ...savedCardForm, billingState: event.target.value })} /></label>
            <label className="text-sm font-semibold">Country<input className="mt-1 w-full" value={savedCardForm.billingCountry} onChange={(event) => setSavedCardForm({ ...savedCardForm, billingCountry: event.target.value })} /><FieldError>{firstError(savedCardErrors, "billingCountry")}</FieldError></label>
            <label className="text-sm font-semibold">Postal/ZIP<input className="mt-1 w-full" value={savedCardForm.postalCode} onChange={(event) => setSavedCardForm({ ...savedCardForm, postalCode: event.target.value })} /><FieldError>{firstError(savedCardErrors, "postalCode")}</FieldError></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input checked={savedCardForm.isDefault} onChange={(event) => setSavedCardForm({ ...savedCardForm, isDefault: event.target.checked })} type="checkbox" /> Set as default</label>
          <div className="flex flex-wrap justify-end gap-2"><button className="btn-secondary" onClick={resetSavedCardForm} type="button">Cancel</button><button className="btn-primary" disabled={saving} type="submit">{editingSavedCardId ? "Save test card" : "Add test card"}</button></div>
        </form>
      </FormModal>}

      <div className="panel space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Saved Checkout Details</p>
          <h2 className="text-2xl font-black">Checkout information</h2>
          <p className="text-sm text-neutral-500">Manage saved delivery addresses and development-only payment methods.</p>
        </div>
        <form className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800" onSubmit={saveContact}>
          <h3 className="font-black">Contact details</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold">Full name<input className="mt-1 w-full" required value={contact.fullName} onChange={(event) => setContact({ ...contact, fullName: event.target.value })} /></label>
            <label className="text-sm font-semibold">Email<input className="mt-1 w-full" disabled value={user.email} /></label>
            <label className="text-sm font-semibold">Phone number<input className="mt-1 w-full" type="tel" value={contact.phoneNumber} onChange={(event) => setContact({ ...contact, phoneNumber: event.target.value })} /></label>
          </div>
          <button className="btn-secondary mt-4" disabled={saving} type="submit">Save contact</button>
        </form>
      </div>

      {loading ? <div className="panel"><p className="text-sm font-semibold text-neutral-500">Loading saved checkout details...</p></div> : <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-black">Delivery Addresses</h3>
              <p className="text-sm text-neutral-500">Saved defaults continue to autofill checkout.</p>
            </div>
            <button className="btn-primary shrink-0" onClick={beginAddAddress} type="button"><Plus size={16} /> Add delivery address</button>
          </div>
          {defaultAddress && <div className="rounded-lg border border-clay/30 bg-clay/5 p-3 text-sm"><span className="font-bold text-clay">Default:</span> {defaultAddress.fullName}, {addressSummary(defaultAddress)}</div>}
          <div className="grid gap-3">
            {details.addresses.length ? details.addresses.map((address) => (
              <article className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800" key={address.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-black"><MapPin size={16} /> {address.fullName} {address.isDefault && <span className="rounded-full bg-clay/10 px-2 py-0.5 text-xs text-clay">Default</span>}</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-600 dark:text-neutral-300">{address.phoneNumber}</p>
                    <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-200">{address.detailedAddress}</p>
                    <p className="mt-1 text-sm text-neutral-500">{[address.city, address.province, address.country, address.postalCode].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!address.isDefault && <button className="btn-secondary h-9 px-3" onClick={() => setDefaultAddress(address.id)} type="button" title="Set as default"><Star size={15} /></button>}
                    <button className="btn-secondary h-9 px-3" onClick={() => editAddress(address)} type="button">Edit</button>
                    <button className="btn-secondary h-9 px-3" onClick={() => deleteAddress(address.id)} type="button" title="Delete"><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            )) : <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">No saved delivery addresses yet.</p>}
          </div>
        </section>

        <section className="panel space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-black">Payment Methods</h3>
              <p className="text-sm text-neutral-500">Saved demo cards and compact checkout payment defaults.</p>
            </div>
            {details.demoSavedCardsEnabled && <button className="btn-primary shrink-0" onClick={beginAddSavedCard} type="button"><Plus size={16} /> Add test card</button>}
          </div>
          <CodReliabilityCard codPolicy={details.codPolicy} />
          {details.demoSavedCardsEnabled ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">Development mode only. Use test card details. Do not enter a real debit or credit card.</p> : <p className="rounded-lg border border-neutral-200 p-3 text-sm text-neutral-500 dark:border-neutral-800">Demo saved cards are currently disabled.</p>}
          {(defaultSavedCard || defaultPaymentPreference) && <div className="rounded-lg border border-clay/30 bg-clay/5 p-3 text-sm"><span className="font-bold text-clay">Current default:</span> {defaultSavedCard ? `${defaultSavedCard.cardBrand} ${defaultSavedCard.maskedCardNumber}` : defaultPaymentPreference.displayName}</div>}
          <div className="grid gap-3">
            {details.savedPaymentMethods?.length ? details.savedPaymentMethods.map((card) => (
              <article className="rounded-lg border border-neutral-200 bg-neutral-950 p-4 text-white dark:border-neutral-800" key={card.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-white/70"><ShieldCheck size={15} /> {card.cardBrand} {card.isDefault && <span className="rounded-full bg-white px-2 py-0.5 text-xs text-neutral-950">Default</span>}</p>
                    <p className="mt-2 text-lg font-black">{card.nickname}</p>
                    <p className="mt-1 font-mono text-base tracking-wide">{card.maskedCardNumber}</p>
                    <p className="mt-1 text-sm text-white/70">{card.cardholderName} - Expires {String(card.expiryMonth).padStart(2, "0")}/{String(card.expiryYear).slice(-2)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!card.isDefault && <button className="btn-secondary h-9 px-3" onClick={() => setDefaultSavedCard(card.id)} type="button" title="Set as default"><Star size={15} /></button>}
                    <button className="btn-secondary h-9 px-3" onClick={() => editSavedCard(card)} type="button">Edit</button>
                    <button className="btn-secondary h-9 px-3" onClick={() => deleteSavedCard(card.id)} type="button" title="Delete"><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            )) : <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">No saved test cards yet.</p>}
          </div>
          {legacyPaymentPreferences.length > 0 && <div className="space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <p className="text-sm font-black">Other checkout methods</p>
            {legacyPaymentPreferences.map((payment) => (
              <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between" key={payment.id}>
                <div><p className="font-bold"><CreditCard className="mr-1 inline text-clay" size={15} /> {payment.displayName}</p><p className="text-neutral-500">{payment.method === "cod" ? "Cash on Delivery" : payment.method}</p></div>
                <div className="flex flex-wrap gap-2">{!payment.isDefault && <button className="btn-secondary h-9 px-3" onClick={() => setDefaultPayment(payment.id)} type="button" title="Set as default"><Star size={15} /></button>}<button className="btn-secondary h-9 px-3" onClick={() => deletePayment(payment.id)} type="button" title="Delete"><Trash2 size={15} /></button></div>
              </div>
            ))}
          </div>}
        </section>
      </div>}
    </section>
  );
}

export function Account() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [editing, setEditing] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && !editing) setProfile(profileFromUser(user));
  }, [user, editing]);

  if (!user) {
    return <section className="mx-auto max-w-3xl px-4 py-12"><div className="panel space-y-4 text-center"><h1 className="text-3xl font-black">Your profile</h1><p className="text-neutral-500">Login or register to view your profile and order history.</p><div className="flex justify-center gap-3"><Link className="btn-primary" to="/login">Login</Link><Link className="btn-secondary" to="/register">Register</Link></div></div></section>;
  }

  function beginEditing() {
    setProfile(profileFromUser(user));
    setMessage("");
    setError("");
    setEditing(true);
  }

  function cancelEditing() {
    setProfile(profileFromUser(user));
    setEditing(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function saveProfile(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const payload = {
        name: profile.name,
        phoneNumber: profile.phoneNumber,
        dateOfBirth: profile.dateOfBirth
      };
      if (profile.profileImageData) payload.profileImageData = profile.profileImageData;
      if (user.role === "vendor") {
        payload.brandName = profile.brandName;
        payload.brandDescription = profile.brandDescription;
      }
      const updatedUser = await updateProfile(payload);
      setProfile(profileFromUser(updatedUser));
      setEditing(false);
      setMessage("Profile updated.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await updateProfile(passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      setMessage("Password changed.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleProfileImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) {
      setError("Choose a JPG, PNG, WEBP, or GIF smaller than 3MB.");
      event.target.value = "";
      return;
    }
    const imageData = await readFileAsDataUrl(file);
    setProfile((current) => ({ ...current, profileImageData: imageData }));
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-clay/15 to-transparent p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4"><UserAvatar user={user} preview={profile.profileImageData} size="xl" className="shadow-soft" /><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Profile</p><h1 className="text-4xl font-black">{user.name}</h1><p className="text-sm text-neutral-500 dark:text-neutral-400">{roleLabel(user.role)}</p></div></div>
        {!editing && <button className="btn-primary" onClick={beginEditing} type="button"><Edit3 size={17} /> Edit Profile</button>}
      </div>

      {(message || error) && <p className={`rounded-md p-3 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"}`}>{error || message}</p>}

      {!editing ? (
        <div className="panel space-y-5">
          <div><h2 className="text-2xl font-black">Profile details</h2><p className="text-sm text-neutral-500">Your saved personal and account information.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Display name">{user.name}</Detail><Detail label="Email">{user.email}</Detail><Detail label="Role">{roleLabel(user.role)}</Detail><Detail label="Phone number">{user.phoneNumber}</Detail><Detail label="Date of birth">{user.dateOfBirth ? new Date(`${String(user.dateOfBirth).slice(0, 10)}T00:00:00`).toLocaleDateString() : ""}</Detail>{user.role === "vendor" && <Detail label="Brand name">{user.brandName}</Detail>}</div>
          {user.role === "vendor" && user.brandDescription && <Detail label="Brand description">{user.brandDescription}</Detail>}
        </div>
      ) : (
        <form className="panel space-y-5" onSubmit={saveProfile}>
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black">Edit profile</h2><p className="text-sm text-neutral-500">Changes are saved only when you confirm below.</p></div><button className="btn-secondary h-10 w-10 px-0" onClick={cancelEditing} type="button" title="Cancel editing"><X size={17} /></button></div>
          <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:items-center"><UserAvatar user={user} preview={profile.profileImageData} size="lg" /><label className="flex-1 space-y-1"><span className="text-sm font-semibold">Profile picture</span><input ref={fileInputRef} className="w-full" accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={handleProfileImage} /></label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1"><span className="text-sm font-semibold">Display name</span><input className="w-full" required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label className="space-y-1"><span className="text-sm font-semibold">Phone number</span><input className="w-full" type="tel" placeholder="Optional" value={profile.phoneNumber} onChange={(event) => setProfile({ ...profile, phoneNumber: event.target.value })} /></label><label className="space-y-1"><span className="text-sm font-semibold">Date of birth</span><input className="w-full" type="date" max={new Date().toISOString().slice(0, 10)} value={profile.dateOfBirth} onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value })} /></label>{user.role === "vendor" && <label className="space-y-1"><span className="text-sm font-semibold">Brand name</span><input className="w-full" required value={profile.brandName} onChange={(event) => setProfile({ ...profile, brandName: event.target.value })} /></label>}</div>
          {user.role === "vendor" && <label className="block space-y-1"><span className="text-sm font-semibold">Brand description</span><textarea className="w-full resize-none" rows="4" value={profile.brandDescription} onChange={(event) => setProfile({ ...profile, brandDescription: event.target.value })} /></label>}
          <div className="flex flex-wrap gap-3"><button className="btn-primary" type="submit">Save Changes</button><button className="btn-secondary" onClick={cancelEditing} type="button">Cancel</button></div>
        </form>
      )}

      <SavedCheckoutDetails />

      <NewsletterPreference />

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="panel space-y-4" onSubmit={changePassword}><div><h2 className="text-2xl font-black">Password</h2><p className="text-sm text-neutral-500">Keep password changes separate from profile details.</p></div><label className="block space-y-1"><span className="text-sm font-semibold">Current password</span><input className="w-full" required type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label><label className="block space-y-1"><span className="text-sm font-semibold">New password</span><input className="w-full" required minLength="8" type="password" placeholder="At least 8 characters" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label><button className="btn-primary" type="submit">Change password</button></form>
        <div className="panel space-y-4"><div><h2 className="text-2xl font-black">Quick links</h2><p className="text-sm text-neutral-500">Manage shopping activity and your VASTRA workspace.</p></div><div className="flex flex-wrap gap-3"><Link className="btn-secondary" to="/orders">Order History</Link><Link className="btn-secondary" to="/cart">Cart</Link>{user.role === "vendor" && <Link className="btn-secondary" to="/vendor/dashboard">Vendor Dashboard</Link>}{user.role === "admin" && <Link className="btn-primary" to="/admin/dashboard">Admin Dashboard</Link>}</div></div>
      </div>
    </section>
  );
}
