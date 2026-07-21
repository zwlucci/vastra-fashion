import { Check, ExternalLink, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, getErrorMessage, resolveImageUrl } from "../api/client.js";
import { money, statusClass } from "../utils/format.js";

const tabs = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["all", "All applications"]
];

function planLabel(value) {
  return value === "annual" ? "Annual" : "Monthly";
}

function paymentMethodLabel(value) {
  return value === "card" ? "Card" : value === "cod" ? "Cash on Delivery" : value || "Not provided";
}

function dateLabel(value, withTime = false) {
  if (!value) return "";
  return withTime ? new Date(value).toLocaleString() : new Date(value).toLocaleDateString();
}

function Pager({ meta, page, setPage }) {
  if (!meta) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <p className="text-sm text-neutral-500">Page {meta.page} of {meta.totalPages} - {meta.total} applications</p>
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">Previous</button>
        <button className="btn-secondary" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} type="button">Next</button>
      </div>
    </div>
  );
}

function Detail({ label, children }) {
  return <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 break-words text-sm font-semibold">{children || "Not provided"}</p></div>;
}

function ApplicationModal({ application, decision, setDecision, saving, onClose, onDecide }) {
  if (!application) return null;
  const pending = application.status === "pending";
  const paid = application.paymentStatus === "paid" && application.payment?.paymentStatus === "paid";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-sm">
      <div className="panel w-full max-w-4xl space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-clay">Vendor application</p>
            <h2 className="mt-1 text-2xl font-black">{application.brandName}</h2>
            <p className="mt-1 text-sm text-neutral-500">{application.applicantName} - {application.applicantEmail}</p>
          </div>
          <button className="btn-secondary h-9 w-9 px-0" disabled={saving} onClick={onClose} title="Close" type="button"><X size={16} /></button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Applicant name">{application.fullName}</Detail>
          <Detail label="Applicant email">{application.applicantEmail}</Detail>
          <Detail label="Business email">{application.businessEmail}</Detail>
          <Detail label="Contact number">{application.contactNumber}</Detail>
          <Detail label="Selected plan">{planLabel(application.subscriptionPlan)}</Detail>
          <Detail label="Subscription price">{money(application.subscriptionPrice)}</Detail>
          <Detail label="Amount paid">{application.amountPaid !== null ? money(application.amountPaid) : ""}</Detail>
          <Detail label="Payment method">{paymentMethodLabel(application.paymentMethod)}</Detail>
          <Detail label="Payment status"><span className={`badge ${statusClass(application.paymentStatus)}`}>{application.paymentStatus}</span></Detail>
          <Detail label="Transaction/reference ID">{application.transactionReference}</Detail>
          <Detail label="Payment date">{dateLabel(application.paymentDate, true)}</Detail>
          <Detail label="Subscription start">{dateLabel(application.subscriptionStartDate)}</Detail>
          <Detail label="Subscription expiry">{dateLabel(application.subscriptionExpiryDate)}</Detail>
          <Detail label="Application date">{new Date(application.createdAt).toLocaleString()}</Detail>
          <Detail label="Status"><span className={`badge ${statusClass(application.status)}`}>{application.status}</span></Detail>
          <Detail label="Subscription status">{application.subscriptionStatus}</Detail>
        </div>

        <Detail label="Business address">{application.businessAddress}</Detail>
        <Detail label="Business description">{application.businessDescription}</Detail>
        {application.adminMessage && <Detail label="Admin message">{application.adminMessage}</Detail>}
        {application.supportingDocument && <a className="btn-secondary w-fit" href={resolveImageUrl(application.supportingDocument)} target="_blank" rel="noreferrer"><ExternalLink size={16} /> View supporting image</a>}

        {pending && (
          <div className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            {!paid && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950 dark:text-red-200">Approval is locked until the linked vendor subscription payment is confirmed as paid.</p>}
            <label className="block text-sm font-semibold">Admin message or rejection reason<textarea className="mt-1 w-full" rows="4" value={decision.adminMessage} onChange={(event) => setDecision({ ...decision, adminMessage: event.target.value })} placeholder="Required when rejecting. Optional note when approving." /></label>
            <div className="flex flex-wrap justify-end gap-3">
              <button className="btn-secondary text-red-600" disabled={saving} onClick={() => onDecide("reject")} type="button"><X size={16} /> Reject</button>
              <button className="btn-primary" disabled={saving || !paid} onClick={() => onDecide("approve")} type="button"><Check size={16} /> Approve</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewConfirmModal({ action, application, saving, onCancel, onConfirm }) {
  if (!action || !application) return null;
  const approving = action === "approve";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-bold uppercase tracking-wide text-clay">Confirm review</p>
        <h3 className="mt-1 text-xl font-black">{approving ? "Approve vendor application?" : "Reject vendor application?"}</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          {approving
            ? `${application.brandName} will be approved and the paid applicant account will be promoted to vendor.`
            : `${application.brandName} will be rejected and the applicant can submit a new application later.`}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" disabled={saving} onClick={onCancel} type="button">Cancel</button>
          <button className={approving ? "btn-primary" : "btn-secondary text-red-600"} disabled={saving} onClick={onConfirm} type="button">
            {approving ? <Check size={16} /> : <X size={16} />}
            {saving ? "Saving..." : approving ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminVendorApplications() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("pending");
  const [applications, setApplications] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState({ adminMessage: "" });
  const [confirmAction, setConfirmAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), limit: "10" });
      if (status !== "all") query.set("status", status);
      const { data } = await api.get(`/admin/vendor-applications?${query.toString()}`);
      setApplications(data.applications || []);
      setMeta(data.meta || null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page, status]);

  useEffect(() => {
    const applicationId = searchParams.get("applicationId");
    if (applicationId) openApplication(applicationId);
  }, [searchParams]);

  async function openApplication(id) {
    setError("");
    setDecision({ adminMessage: "" });
    try {
      const { data } = await api.get(`/admin/vendor-applications/${id}`);
      setSelected(data.application);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function requestDecision(action) {
    if (!selected) return;
    if (action === "reject" && decision.adminMessage.trim().length < 5) {
      setError("A rejection reason is required.");
      return;
    }
    if (action === "approve" && !(selected.paymentStatus === "paid" && selected.payment?.paymentStatus === "paid")) {
      setError("This application cannot be approved until its linked payment is paid.");
      return;
    }
    setError("");
    setConfirmAction(action);
  }

  async function confirmDecision() {
    if (!selected || !confirmAction) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.patch(`/admin/vendor-applications/${selected.id}/${confirmAction}`, decision);
      setSelected(data.application);
      setNotice(data.message || `Application ${confirmAction}d.`);
      setConfirmAction("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel space-y-4">
      {(notice || error) && <p className={`rounded-md p-3 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"}`}>{error || notice}</p>}
      <ApplicationModal application={selected} decision={decision} setDecision={setDecision} saving={saving} onClose={() => setSelected(null)} onDecide={requestDecision} />
      <ReviewConfirmModal action={confirmAction} application={selected} saving={saving} onCancel={() => setConfirmAction("")} onConfirm={confirmDecision} />
      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => <button className={status === key ? "btn-primary" : "btn-secondary"} key={key} onClick={() => { setStatus(key); setPage(1); }} type="button">{label}</button>)}
      </div>
      {loading ? <p className="py-8 text-center text-sm text-neutral-500">Loading vendor applications...</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                <tr>
                  <th className="py-3 pr-3">Applicant</th>
                  <th className="py-3 pr-3">Email</th>
                  <th className="py-3 pr-3">Brand</th>
                  <th className="py-3 pr-3">Contact</th>
                  <th className="py-3 pr-3">Plan</th>
                  <th className="py-3 pr-3">Paid</th>
                  <th className="py-3 pr-3">Payment</th>
                  <th className="py-3 pr-3">Date</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr className="border-b border-neutral-100 last:border-0 dark:border-neutral-900" key={application.id}>
                    <td className="py-3 pr-3 font-semibold">{application.fullName}</td>
                    <td className="py-3 pr-3">{application.applicantEmail}</td>
                    <td className="py-3 pr-3 font-semibold">{application.brandName}</td>
                    <td className="py-3 pr-3">{application.contactNumber}</td>
                    <td className="py-3 pr-3">{planLabel(application.subscriptionPlan)}</td>
                    <td className="py-3 pr-3">{application.amountPaid !== null ? money(application.amountPaid) : money(application.subscriptionPrice)}</td>
                    <td className="py-3 pr-3"><span className={`badge ${statusClass(application.paymentStatus)}`}>{application.paymentStatus}</span><p className="mt-1 text-xs text-neutral-500">{paymentMethodLabel(application.paymentMethod)}</p></td>
                    <td className="py-3 pr-3">{new Date(application.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 pr-3"><span className={`badge ${statusClass(application.status)}`}>{application.status}</span></td>
                    <td className="py-3 pr-3"><button className="btn-secondary h-9 px-3" onClick={() => openApplication(application.id)} type="button">View Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!applications.length && <p className="rounded-lg border border-dashed border-neutral-300 p-5 text-center text-sm text-neutral-500 dark:border-neutral-700">No vendor applications in this view.</p>}
          <Pager meta={meta} page={page} setPage={setPage} />
        </>
      )}
    </div>
  );
}
