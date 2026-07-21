import { CheckCircle2, Clock, CreditCard, ShieldCheck, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { money, statusClass } from "../utils/format.js";

function planLabel(plan) {
  return plan === "annual" ? "Annual Plan" : "Monthly Plan";
}

function Detail({ label, value }) {
  return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value || "Not provided"}</p></div>;
}

export function VendorApplicationStatus() {
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/vendor-applications/me");
        if (active) setApplication(data.application || null);
      } catch (err) {
        if (active) setError(getErrorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <section className="mx-auto max-w-3xl px-4 py-12"><div className="panel text-center"><h1 className="text-3xl font-black">Vendor Application</h1><p className="mt-2 text-neutral-500">Login to view your vendor application status.</p><Link className="btn-primary mt-4" to="/login">Login</Link></div></section>;
  }

  if (loading) return <section className="mx-auto max-w-3xl px-4 py-12"><div className="panel text-center text-sm text-neutral-500">Loading vendor application status...</div></section>;
  if (error) return <section className="mx-auto max-w-3xl px-4 py-12"><div className="panel text-center text-sm text-red-600">{error}</div></section>;
  if (!application) return <section className="mx-auto max-w-3xl px-4 py-12"><div className="panel text-center"><Clock className="mx-auto text-clay" size={30} /><h1 className="mt-3 text-3xl font-black">No vendor application yet</h1><p className="mt-2 text-neutral-500">Choose a plan and complete payment to submit an application.</p><Link className="btn-primary mt-4" to="/pricing">Apply for Vendor</Link></div></section>;

  const paid = application.paymentStatus === "paid" && application.payment?.paymentStatus === "paid";
  const approved = application.status === "approved";
  const rejected = application.status === "rejected";

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <div className="panel space-y-6">
        {searchParams.get("paid") && paid && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-100"><CheckCircle2 className="mr-2 inline" size={18} /> Payment successful. Your application is pending admin review.</div>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-clay">Vendor application status</p>
            <h1 className="mt-1 text-3xl font-black">{application.brandName}</h1>
            <p className="mt-1 text-sm text-neutral-500">{user?.name} - {user?.email}</p>
          </div>
          <span className={`badge ${statusClass(application.status)}`}>{application.status}</span>
        </div>

        <div className={`rounded-lg p-4 text-sm font-semibold ${approved ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-100" : rejected ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-100" : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-100"}`}>
          {approved ? <ShieldCheck className="mr-2 inline" size={18} /> : rejected ? <XCircle className="mr-2 inline" size={18} /> : <Clock className="mr-2 inline" size={18} />}
          {approved ? "Approved. Vendor access is active." : rejected ? `Rejected. ${application.adminMessage || "Please review your details before applying again."}` : "Pending admin review. Vendor access is not active until an admin approves the paid application."}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Selected plan" value={planLabel(application.subscriptionPlan)} />
          <Detail label="Subscription duration" value={application.payment?.billingPeriod || application.subscriptionPlan} />
          <Detail label="Subscription price" value={money(application.subscriptionPrice)} />
          <Detail label="Amount paid" value={application.amountPaid !== null ? money(application.amountPaid) : ""} />
          <Detail label="Payment method" value={application.paymentMethod === "card" ? "Card" : application.paymentMethod} />
          <Detail label="Payment status" value={application.paymentStatus} />
          <Detail label="Transaction/reference ID" value={application.transactionReference} />
          <Detail label="Payment date" value={application.paymentDate ? new Date(application.paymentDate).toLocaleString() : ""} />
          <Detail label="Subscription start" value={application.subscriptionStartDate ? new Date(application.subscriptionStartDate).toLocaleDateString() : ""} />
          <Detail label="Subscription expiry" value={application.subscriptionExpiryDate ? new Date(application.subscriptionExpiryDate).toLocaleDateString() : ""} />
          <Detail label="Applicant name" value={application.fullName} />
          <Detail label="Applicant email" value={application.applicantEmail || application.businessEmail} />
        </div>

        <div className="flex flex-wrap gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          {approved ? <Link className="btn-primary" to="/vendor/dashboard"><ShieldCheck size={16} /> Vendor Dashboard</Link> : <Link className="btn-secondary" to="/pricing"><CreditCard size={16} /> Vendor Plans</Link>}
        </div>
      </div>
    </section>
  );
}
