import { Check, Clock, FileImage, ShieldCheck, Store, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import { money, statusClass } from "../utils/format.js";

const fallbackPlans = [
  {
    id: "monthly",
    name: "Monthly Plan",
    price: 299,
    currency: "NPR",
    billingPeriod: "Monthly",
    benefits: ["Verified storefront review", "Vendor dashboard access after approval", "Product submission tools", "Customer messaging and order management"]
  },
  {
    id: "annual",
    name: "Annual Plan",
    price: 24999,
    currency: "NPR",
    billingPeriod: "Annual",
    benefits: ["Verified storefront review", "Vendor dashboard access after approval", "Product submission tools", "Customer messaging and order management", "Long-term seller plan"]
  }
];

const emptyForm = {
  fullName: "",
  brandName: "",
  contactNumber: "",
  businessEmail: "",
  businessAddress: "",
  businessDescription: "",
  supportingDocumentData: ""
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function applicationLabel(application) {
  if (!application) return "";
  return application.subscriptionPlan === "annual" ? "Annual Plan" : "Monthly Plan";
}

function FieldError({ children }) {
  return children ? <span className="mt-1 block text-xs font-semibold text-red-600 dark:text-red-300">{children}</span> : null;
}

function ApplicationStatus({ user, application }) {
  if (!user) return null;
  if (user.role === "vendor") {
    return (
      <section className="rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 text-green-700 dark:text-green-200" size={22} />
          <div>
            <h2 className="text-xl font-black">Your account is a vendor</h2>
            <p className="mt-1 text-sm text-green-800 dark:text-green-100">Vendor application options are no longer needed for this account.</p>
          </div>
        </div>
      </section>
    );
  }
  if (user.role === "admin") {
    return (
      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-xl font-black">Admin account</h2>
        <p className="mt-1 text-sm text-neutral-500">Admins cannot submit vendor applications. Review applications from the admin dashboard.</p>
        <Link className="btn-secondary mt-4" to="/admin/dashboard/vendor-applications">Vendor Applications</Link>
      </section>
    );
  }
  if (!application) return null;
  return (
    <section className="panel space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Application status</p>
          <h2 className="text-2xl font-black">{application.brandName}</h2>
          <p className="mt-1 text-sm text-neutral-500">{applicationLabel(application)} - {money(application.subscriptionPrice)} - submitted {new Date(application.createdAt).toLocaleDateString()}</p>
        </div>
        <span className={`badge ${statusClass(application.status)}`}>{application.status}</span>
      </div>
      {application.status === "pending" && <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-100">Your application is waiting for admin review. Application buttons are disabled while this is pending.</p>}
      {application.status === "rejected" && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-100"><span className="font-bold">Admin message:</span> {application.adminMessage || "No reason provided."}</p>}
      {application.status === "approved" && <p className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800 dark:bg-green-950 dark:text-green-100">Approved. Your account should now have vendor access; subscription payment activation remains pending.</p>}
    </section>
  );
}

export function Pricing() {
  const { user, isAuthenticated, refreshMe } = useAuth();
  const { showNotice, refreshOrderNotifications } = useNotification();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState(fallbackPlans);
  const [application, setApplication] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(searchParams.get("plan") === "annual" ? "annual" : "monthly");
  const [form, setForm] = useState(emptyForm);
  const [issues, setIssues] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef(null);

  const selected = useMemo(() => plans.find((plan) => plan.id === selectedPlan) || plans[0], [plans, selectedPlan]);
  const lockedForRole = isAuthenticated && ["vendor", "admin"].includes(user?.role);
  const formLocked = lockedForRole || application?.status === "pending" || application?.status === "approved";
  const disabledReason = !isAuthenticated
    ? ""
    : user?.role === "vendor"
      ? "Vendor accounts cannot apply again."
      : user?.role === "admin"
        ? "Admin accounts cannot submit vendor applications."
        : application?.status === "pending"
          ? "You already have a pending application."
          : application?.status === "approved"
            ? "Your application has already been approved."
            : "";

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const plansResponse = await api.get("/vendor-applications/plans");
        if (active) setPlans(plansResponse.data.plans || fallbackPlans);
        if (isAuthenticated) {
          const applicationResponse = await api.get("/vendor-applications/me");
          if (active) setApplication(applicationResponse.data.application || null);
        } else if (active) {
          setApplication(null);
        }
      } catch {
        if (active) setPlans(fallbackPlans);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      fullName: current.fullName || user.name || "",
      contactNumber: current.contactNumber || user.phoneNumber || "",
      businessEmail: current.businessEmail || user.email || ""
    }));
  }, [user]);

  function choosePlan(planId, focusForm = false) {
    setSelectedPlan(planId);
    setSearchParams({ plan: planId });
    if (!focusForm) return;
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/pricing", search: `?plan=${planId}` } } });
      return;
    }
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setForm((current) => ({ ...current, supportingDocumentData: "" }));
      return;
    }
    if (!file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) {
      setIssues((current) => ({ ...current, supportingDocumentData: ["Choose a JPG, PNG, WEBP, or GIF smaller than 3MB."] }));
      event.target.value = "";
      return;
    }
    const imageData = await readFileAsDataUrl(file);
    setIssues((current) => ({ ...current, supportingDocumentData: undefined }));
    setForm((current) => ({ ...current, supportingDocumentData: imageData }));
  }

  function firstIssue(field) {
    const value = issues?.[field];
    return Array.isArray(value) ? value[0] : value;
  }

  async function submit(event) {
    event.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/pricing", search: `?plan=${selectedPlan}` } } });
      return;
    }
    setSubmitting(true);
    setIssues({});
    try {
      const { data } = await api.post("/vendor-applications", { ...form, subscriptionPlan: selectedPlan });
      setApplication(data.application);
      setForm(emptyForm);
      showNotice(data.message || "Vendor application submitted.", "success");
      await Promise.all([refreshOrderNotifications?.().catch(() => {}), refreshMe?.().catch(() => {})]);
    } catch (err) {
      setIssues(err.response?.data?.issues || {});
      showNotice(getErrorMessage(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-white py-10 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl space-y-8 px-4">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-clay">Pricing</p>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">Apply to Sell on VASTRA</h1>
            <p className="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-300">Choose a vendor subscription plan, submit your store details, and wait for admin approval. Payment activation is kept pending until review is complete.</p>
          </div>
          <ApplicationStatus user={user} application={application} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <article className={`panel flex flex-col gap-5 ${selectedPlan === plan.id ? "ring-2 ring-clay" : ""}`} key={plan.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{plan.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-neutral-500">{plan.billingPeriod} billing</p>
                </div>
                {selectedPlan === plan.id && <span className="badge bg-clay/10 text-clay">Selected</span>}
              </div>
              <p className="text-4xl font-black">{money(plan.price)}</p>
              <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                {plan.benefits.map((benefit) => <li className="flex gap-2" key={benefit}><Check className="mt-0.5 shrink-0 text-clay" size={16} />{benefit}</li>)}
              </ul>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <button className="btn-secondary" disabled={lockedForRole} onClick={() => choosePlan(plan.id)} type="button">Select {plan.billingPeriod}</button>
                <button className="btn-primary" disabled={Boolean(disabledReason) && isAuthenticated} onClick={() => choosePlan(plan.id, true)} type="button"><Store size={16} /> Apply for Vendor</button>
              </div>
              {disabledReason && <p className="text-xs font-semibold text-neutral-500">{disabledReason}</p>}
            </article>
          ))}
        </div>

        <form className="panel space-y-5" ref={formRef} onSubmit={submit}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-clay">Vendor application</p>
              <h2 className="text-2xl font-black">Selected plan: {selected?.name}</h2>
              <p className="mt-1 text-sm text-neutral-500">{selected?.billingPeriod} - {money(selected?.price)}. Backend stores this price; it is not accepted from the browser.</p>
            </div>
            <span className="badge bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">{loading ? "Loading" : "Ready"}</span>
          </div>
          {!isAuthenticated ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-5 text-center dark:border-neutral-700">
              <Clock className="mx-auto text-clay" size={28} />
              <h3 className="mt-3 text-lg font-black">Login required</h3>
              <p className="mt-1 text-sm text-neutral-500">Create or login to a regular user account before submitting a vendor application.</p>
              <button className="btn-primary mt-4" onClick={() => navigate("/login", { state: { from: { pathname: "/pricing", search: `?plan=${selectedPlan}` } } })} type="button">Login to Apply</button>
            </div>
          ) : formLocked ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-5 text-center dark:border-neutral-700">
              <ShieldCheck className="mx-auto text-clay" size={28} />
              <h3 className="mt-3 text-lg font-black">{user?.role === "vendor" ? "Vendor application locked" : user?.role === "admin" ? "Admin application locked" : "Application locked"}</h3>
              <p className="mx-auto mt-1 max-w-2xl text-sm text-neutral-500">{disabledReason || "This application state cannot be edited right now."}</p>
              {user?.role === "vendor" && <Link className="btn-primary mt-4" to="/vendor/dashboard">Go to Vendor Dashboard</Link>}
              {user?.role === "admin" && <Link className="btn-secondary mt-4" to="/admin/dashboard/vendor-applications">Review Vendor Applications</Link>}
            </div>
          ) : (
            <>
              {disabledReason && <p className="rounded-lg bg-neutral-50 p-3 text-sm font-semibold text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">{disabledReason}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm font-semibold">Full name<input className="w-full" required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /><FieldError>{firstIssue("fullName")}</FieldError></label>
                <label className="space-y-1 text-sm font-semibold">Brand or store name<input className="w-full" required value={form.brandName} onChange={(event) => setForm({ ...form, brandName: event.target.value })} /><FieldError>{firstIssue("brandName")}</FieldError></label>
                <label className="space-y-1 text-sm font-semibold">Contact number<input className="w-full" required type="tel" value={form.contactNumber} onChange={(event) => setForm({ ...form, contactNumber: event.target.value })} /><FieldError>{firstIssue("contactNumber")}</FieldError></label>
                <label className="space-y-1 text-sm font-semibold">Business email<input className="w-full" required type="email" value={form.businessEmail} onChange={(event) => setForm({ ...form, businessEmail: event.target.value })} /><FieldError>{firstIssue("businessEmail")}</FieldError></label>
                <label className="space-y-1 text-sm font-semibold md:col-span-2">Business address<input className="w-full" required value={form.businessAddress} onChange={(event) => setForm({ ...form, businessAddress: event.target.value })} /><FieldError>{firstIssue("businessAddress")}</FieldError></label>
                <label className="space-y-1 text-sm font-semibold md:col-span-2">Short business description<textarea className="w-full" required rows="5" value={form.businessDescription} onChange={(event) => setForm({ ...form, businessDescription: event.target.value })} /><FieldError>{firstIssue("businessDescription")}</FieldError></label>
                <label className="space-y-1 text-sm font-semibold md:col-span-2"><span className="flex items-center gap-2"><FileImage size={16} /> Supporting image, optional</span><input className="w-full" accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={handleFile} /><FieldError>{firstIssue("supportingDocumentData")}</FieldError></label>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <button className="btn-secondary" onClick={() => setForm(emptyForm)} type="button"><X size={16} /> Clear</button>
                <button className="btn-primary" disabled={submitting || Boolean(disabledReason)} type="submit"><Store size={16} /> {submitting ? "Submitting..." : "Apply for Vendor"}</button>
              </div>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
