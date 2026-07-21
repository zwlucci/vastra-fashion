import { LockKeyhole } from "lucide-react";

export function validCardExpiry(value) {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) return false;
  const [month, year] = value.split("/").map(Number);
  return new Date(2000 + year, month, 0, 23, 59, 59, 999) >= new Date();
}

export function formatCardNumber(value) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}

export function detectCardBrand(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  return "Card";
}

export function validateCheckoutPayment({ checkoutDetails, paymentMethod, savedPaymentMethodId, savedCardCvv, card }) {
  if (paymentMethod === "cod" && checkoutDetails?.codPolicy && !checkoutDetails.codPolicy.codAvailable) {
    return checkoutDetails.codPolicy.warning || "Cash on Delivery is unavailable for your account.";
  }
  if (paymentMethod === "card" && savedPaymentMethodId && !/^\d{3,4}$/.test(savedCardCvv)) {
    return "Enter the CVV for the selected saved card.";
  }
  if (
    paymentMethod === "card" &&
    !savedPaymentMethodId &&
    (card.cardholderName.trim().length < 2 ||
      !/^\d{13,19}$/.test(card.cardNumber.replace(/[ -]/g, "")) ||
      !validCardExpiry(card.expiryDate) ||
      !/^\d{3,4}$/.test(card.cvv))
  ) {
    return "Enter valid card details, including an MM/YY expiry date.";
  }
  return "";
}

export function buildCheckoutPaymentPayload({
  paymentMethod,
  paymentPreferenceId,
  savedPaymentMethodId,
  savedCardCvv,
  card,
  saveCardDetails,
  savedCardMeta
}) {
  return {
    paymentMethod,
    paymentPreferenceId,
    savedPaymentMethodId,
    savedCardCvv: savedPaymentMethodId ? savedCardCvv : "",
    saveCardDetails: paymentMethod === "card" && !savedPaymentMethodId && saveCardDetails,
    savePaymentPreference: paymentMethod === "card" && !savedPaymentMethodId && saveCardDetails,
    saveCardAsDefault: Boolean(savedCardMeta?.isDefault),
    savedCard: saveCardDetails ? savedCardMeta : undefined,
    ...(paymentMethod === "card" && !savedPaymentMethodId ? { card: { ...card, cardNumber: card.cardNumber.replace(/[ -]/g, "") } } : {})
  };
}

function codPolicyPanel(codPolicy) {
  if (!codPolicy?.warning) return null;
  const restricted = !codPolicy.codAvailable;
  return <div className={`mt-5 rounded-lg border p-4 text-sm leading-6 ${restricted ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : codPolicy.activeRefusalCount >= 2 ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100" : "border-clay/30 bg-clay/10 text-clay"}`}>
    <strong>{restricted ? "Cash on Delivery unavailable." : "Cash on Delivery notice."}</strong> {codPolicy.warning}
  </div>;
}

export function CheckoutPaymentSection({
  checkoutDetails,
  paymentMethod,
  setPaymentMethod,
  paymentPreferenceId,
  setPaymentPreferenceId,
  savedPaymentMethodId,
  setSavedPaymentMethodId,
  savedCardCvv,
  setSavedCardCvv,
  card,
  setCard,
  saveCardDetails,
  setSaveCardDetails,
  savedCardMeta,
  setSavedCardMeta,
  deliveryAddress = "",
  allowedMethods = ["cod", "card"],
  methodNotes = {},
  showCodPolicy = true,
  showSaveCard = true
}) {
  const allowed = new Set(allowedMethods);
  const methodOptions = [
    { value: "cod", label: "Cash on Delivery", disabled: checkoutDetails?.codPolicy && !checkoutDetails.codPolicy.codAvailable, disabledCopy: "Unavailable for your account" },
    { value: "card", label: "Card" }
  ].filter((option) => allowed.has(option.value));
  const paymentPreferences = (checkoutDetails?.paymentPreferences || []).filter((payment) => allowed.has(payment.method));

  return (
    <>
      {showCodPolicy && allowed.has("cod") && codPolicyPanel(checkoutDetails?.codPolicy)}
      {paymentPreferences.length > 0 && <div className="mb-5 space-y-2"><p className="text-sm font-semibold">Saved payment preferences</p><div className="grid gap-2 sm:grid-cols-2">{paymentPreferences.map((payment) => {
        const paymentDisabled = payment.method === "cod" && checkoutDetails?.codPolicy && !checkoutDetails.codPolicy.codAvailable;
        return <label className={`rounded-xl border p-3 text-sm ${paymentDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${paymentPreferenceId === payment.id ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`} key={payment.id}><span className="flex items-center gap-2 font-bold"><input checked={paymentPreferenceId === payment.id} disabled={paymentDisabled} name="payment-preference" onChange={() => { setPaymentPreferenceId(payment.id); setSavedPaymentMethodId(""); setPaymentMethod(payment.method); }} type="radio" />{payment.displayName}{payment.isDefault && <span className="rounded-full bg-clay/10 px-2 py-0.5 text-xs text-clay">Default</span>}</span><span className="mt-1 block text-neutral-500">{paymentDisabled ? "Unavailable for your account." : payment.method === "card" ? "Legacy masked preference. Enter the full test card number below." : "Ready for checkout."}</span></label>;
      })}<label className={`cursor-pointer rounded-xl border p-3 text-sm ${!paymentPreferenceId && !savedPaymentMethodId ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`}><span className="flex items-center gap-2 font-bold"><input checked={!paymentPreferenceId && !savedPaymentMethodId} name="payment-preference" onChange={() => { setPaymentPreferenceId(""); setSavedPaymentMethodId(""); }} type="radio" />Use another method</span></label></div></div>}
      <fieldset className={`grid gap-3 ${methodOptions.length > 1 ? "sm:grid-cols-2" : ""}`}><legend className="sr-only">Payment method</legend>{methodOptions.map((option) => <label className={`rounded-xl border p-4 ${option.disabled ? "cursor-not-allowed opacity-60" : paymentMethod === option.value ? "border-clay bg-clay/5" : "cursor-pointer border-neutral-200 dark:border-neutral-800"}`} key={option.value}><span className="flex items-center gap-2 font-bold"><input checked={paymentMethod === option.value} disabled={option.disabled} name="payment" onChange={() => { setPaymentPreferenceId(""); setSavedPaymentMethodId(""); setPaymentMethod(option.value); }} type="radio" />{option.label}</span>{option.disabled && <span className="mt-2 block text-xs text-clay">{option.disabledCopy}</span>}{methodNotes[option.value] && <span className="mt-2 block text-xs text-neutral-500">{methodNotes[option.value]}</span>}</label>)}</fieldset>
      {paymentMethod === "cod" && <div className="mt-5 rounded-xl bg-clay/10 p-4 text-sm leading-6 text-clay"><strong>Pay when your order arrives.</strong> Please keep the exact amount ready where possible.</div>}
      {paymentMethod === "card" && <div className="mt-5 space-y-3 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950"><p className="flex items-center gap-2 text-xs font-semibold text-neutral-500"><LockKeyhole size={14} /> Dummy test payment. CVV is requested each time and never stored.</p>{checkoutDetails?.demoSavedCardsEnabled && checkoutDetails.savedPaymentMethods.length > 0 && <div className="space-y-2"><p className="text-sm font-semibold">Saved test cards</p><div className="grid gap-2 sm:grid-cols-2">{checkoutDetails.savedPaymentMethods.map((savedCard) => <label className={`cursor-pointer rounded-xl border p-3 text-sm ${savedPaymentMethodId === savedCard.id ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`} key={savedCard.id}><span className="flex items-center gap-2 font-bold"><input checked={savedPaymentMethodId === savedCard.id} name="saved-card" onChange={() => { setSavedPaymentMethodId(savedCard.id); setPaymentPreferenceId(""); setSaveCardDetails(false); }} type="radio" />{savedCard.nickname}{savedCard.isDefault && <span className="rounded-full bg-clay/10 px-2 py-0.5 text-xs text-clay">Default</span>}</span><span className="mt-1 block text-neutral-500">{savedCard.cardBrand} {savedCard.maskedCardNumber} - {String(savedCard.expiryMonth).padStart(2, "0")}/{String(savedCard.expiryYear).slice(-2)}</span></label>)}<label className={`cursor-pointer rounded-xl border p-3 text-sm ${!savedPaymentMethodId ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`}><span className="flex items-center gap-2 font-bold"><input checked={!savedPaymentMethodId} name="saved-card" onChange={() => setSavedPaymentMethodId("")} type="radio" />Use a new test card</span></label></div></div>}{savedPaymentMethodId ? <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-sm font-bold">Transaction CVV</p><p className="mt-1 text-xs text-neutral-500">For security, CVV is requested for every checkout and is not saved.</p><label className="mt-3 block text-sm font-semibold">CVV<input className="mt-1 w-full" autoComplete="cc-csc" inputMode="numeric" maxLength="4" type="password" value={savedCardCvv} onChange={(event) => setSavedCardCvv(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label></div> : <><label className="block text-sm font-semibold">Cardholder name<input className="mt-1 w-full" autoComplete="cc-name" value={card.cardholderName} onChange={(event) => setCard({ ...card, cardholderName: event.target.value })} /></label><label className="block text-sm font-semibold">Card number<input className="mt-1 w-full" autoComplete="cc-number" inputMode="numeric" maxLength="23" value={card.cardNumber} onChange={(event) => setCard({ ...card, cardNumber: formatCardNumber(event.target.value) })} placeholder="4242 4242 4242 4242" /><span className="mt-1 block text-xs text-neutral-500">{detectCardBrand(card.cardNumber)} detected. Use an approved demo card only.</span></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Expiry<input className="mt-1 w-full" autoComplete="cc-exp" maxLength="5" value={card.expiryDate} onChange={(event) => setCard({ ...card, expiryDate: event.target.value.replace(/[^\d/]/g, "").slice(0, 5) })} placeholder="MM/YY" /></label><label className="text-sm font-semibold">CVV<input className="mt-1 w-full" autoComplete="cc-csc" inputMode="numeric" maxLength="4" type="password" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></label></div>{checkoutDetails?.demoSavedCardsEnabled && showSaveCard && <label className="flex cursor-pointer items-center gap-2 text-sm"><input checked={saveCardDetails} onChange={(event) => setSaveCardDetails(event.target.checked)} type="checkbox" /> Save this test card for future dummy checkouts</label>}{saveCardDetails && showSaveCard && <div className="grid gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 sm:grid-cols-2"><label className="text-sm font-semibold">Nickname<input className="mt-1 w-full" value={savedCardMeta.nickname} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, nickname: event.target.value })} placeholder="Personal Visa" /></label><label className="text-sm font-semibold">Postal/ZIP<input className="mt-1 w-full" value={savedCardMeta.postalCode} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, postalCode: event.target.value })} /></label><label className="text-sm font-semibold sm:col-span-2">Billing address<input className="mt-1 w-full" value={savedCardMeta.billingAddress} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, billingAddress: event.target.value })} placeholder={deliveryAddress} /></label><label className="text-sm font-semibold">Billing city<input className="mt-1 w-full" value={savedCardMeta.billingCity} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, billingCity: event.target.value })} /></label><label className="text-sm font-semibold">Province/state<input className="mt-1 w-full" value={savedCardMeta.billingState} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, billingState: event.target.value })} /></label><label className="text-sm font-semibold">Country<input className="mt-1 w-full" value={savedCardMeta.billingCountry} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, billingCountry: event.target.value })} /></label><label className="flex items-center gap-2 text-sm font-semibold"><input checked={savedCardMeta.isDefault} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, isDefault: event.target.checked })} type="checkbox" /> Set as default</label></div>}</>}</div>}
    </>
  );
}
