import { Mail, Send, TestTube2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "../api/client.js";

const initialForm = {
  subject: "",
  heading: "",
  message: "",
  ctaText: "",
  ctaUrl: ""
};

function isSafeUrl(value) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateForm(form) {
  if (form.subject.trim().length < 3) return "Add a broadcast subject.";
  if (form.heading.trim().length < 3) return "Add an email heading.";
  if (form.message.trim().length < 5) return "Add a broadcast message.";
  if (form.ctaUrl.trim() && !form.ctaText.trim()) return "Add CTA button text or remove the CTA URL.";
  if (!isSafeUrl(form.ctaUrl.trim())) return "CTA URL must start with http or https.";
  return "";
}

function BroadcastPreview({ form }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white text-ink dark:border-neutral-800">
      <div className="bg-ink px-5 py-4 text-white">
        <p className="text-xl font-black tracking-[0.18em]">VASTRA</p>
        <p className="mt-1 text-xs text-neutral-300">Curated style notes</p>
      </div>
      <div className="space-y-4 p-5">
        <span className="badge bg-clay/10 text-clay">Newsletter</span>
        <h3 className="text-2xl font-black">{form.heading || "Email heading preview"}</h3>
        <p className="whitespace-pre-line text-sm leading-7 text-neutral-600">{form.message || "Your broadcast message preview will appear here."}</p>
        {form.ctaText && form.ctaUrl && isSafeUrl(form.ctaUrl) && <a className="btn-primary" href={form.ctaUrl} target="_blank" rel="noreferrer">{form.ctaText}</a>}
        <p className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">Every broadcast includes a private unsubscribe link for each subscriber.</p>
      </div>
    </div>
  );
}

function HistoryTable({ broadcasts }) {
  if (!broadcasts.length) {
    return <p className="rounded-lg border border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">No newsletter broadcasts yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-neutral-100 text-xs uppercase text-neutral-500 dark:bg-neutral-800">
            <tr>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Recipients</th>
              <th className="px-4 py-3">Successful</th>
              <th className="px-4 py-3">Failed</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Admin</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((broadcast) => (
              <tr className="border-t border-neutral-200 dark:border-neutral-800" key={broadcast.id}>
                <td className="px-4 py-3 font-semibold">{broadcast.subject}</td>
                <td className="px-4 py-3 text-neutral-500">{new Date(broadcast.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{broadcast.recipientCount}</td>
                <td className="px-4 py-3">{broadcast.successfulCount}</td>
                <td className="px-4 py-3">{broadcast.failedCount}</td>
                <td className="px-4 py-3"><span className="badge bg-neutral-100 capitalize text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">{broadcast.status.replace("_", " ")}</span></td>
                <td className="px-4 py-3 text-neutral-500">{broadcast.sentByName || "Admin"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryPager({ meta, page, setPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
      <p className="text-neutral-500">Page {meta.page} of {meta.totalPages} · {meta.total} broadcasts</p>
      <div className="flex gap-2">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">Previous</button>
        <button className="btn-secondary" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)} type="button">Next</button>
      </div>
    </div>
  );
}

export function AdminNewsletterBroadcast() {
  const [form, setForm] = useState(initialForm);
  const [testEmail, setTestEmail] = useState("");
  const [stats, setStats] = useState({ activeSubscribers: 0 });
  const [broadcasts, setBroadcasts] = useState([]);
  const [historyMeta, setHistoryMeta] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const validationMessage = useMemo(() => validateForm(form), [form]);

  async function loadNewsletter(page = historyPage) {
    setLoading(true);
    try {
      const [statsResponse, historyResponse] = await Promise.all([
        api.get("/admin/newsletter/stats"),
        api.get(`/admin/newsletter/broadcasts?page=${page}&limit=10`)
      ]);
      setStats(statsResponse.data.stats || { activeSubscribers: 0 });
      setBroadcasts(historyResponse.data.broadcasts || []);
      setHistoryMeta(historyResponse.data.meta || null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNewsletter(historyPage);
  }, [historyPage]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setNotice("");
    setError("");
  }

  async function sendTest() {
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
      setError("Enter a valid test email.");
      return;
    }

    setTesting(true);
    try {
      const { data } = await api.post("/admin/newsletter/test", { ...form, testEmail: testEmail.trim().toLowerCase() });
      setNotice(data.message || "Test newsletter sent.");
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTesting(false);
    }
  }

  async function sendBroadcast() {
    setSending(true);
    try {
      const { data } = await api.post("/admin/newsletter/broadcast", form);
      setNotice(`${data.message} Sent ${data.summary.sentSuccessfully} of ${data.summary.totalRecipients}; failed ${data.summary.failed}.`);
      setError("");
      setConfirmOpen(false);
      setForm(initialForm);
      setHistoryPage(1);
      await loadNewsletter(1);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="panel text-sm text-neutral-500">Loading newsletter broadcast tools...</p>;

  return (
    <div className="space-y-6">
      {(notice || error) && <p className={`rounded-md p-3 text-sm font-semibold ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"}`}>{error || notice}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel">
          <p className="text-sm font-semibold text-neutral-500">Active subscribers</p>
          <p className="mt-2 text-3xl font-black">{stats.activeSubscribers}</p>
        </div>
        <div className="panel sm:col-span-2">
          <p className="text-sm font-semibold text-neutral-500">Delivery behavior</p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">Broadcasts are sent in small private batches. Failed deliveries are counted and do not stop the remaining recipients.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <form className="panel space-y-4" onSubmit={(event) => { event.preventDefault(); if (validationMessage) setError(validationMessage); else setConfirmOpen(true); }}>
          <div className="flex items-center gap-3">
            <Mail className="text-clay" size={22} />
            <div>
              <h3 className="text-2xl font-black">Compose Broadcast</h3>
              <p className="text-sm text-neutral-500">Subject, message, optional CTA, then preview and send.</p>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-semibold">Broadcast subject</span>
            <input className="w-full" value={form.subject} onChange={(event) => updateField("subject", event.target.value)} maxLength="160" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Email heading/title</span>
            <input className="w-full" value={form.heading} onChange={(event) => updateField("heading", event.target.value)} maxLength="160" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Broadcast message</span>
            <textarea className="min-h-44 w-full" value={form.message} onChange={(event) => updateField("message", event.target.value)} maxLength="8000" />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">CTA button text</span>
              <input className="w-full" value={form.ctaText} onChange={(event) => updateField("ctaText", event.target.value)} maxLength="80" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">CTA URL</span>
              <input className="w-full" value={form.ctaUrl} onChange={(event) => updateField("ctaUrl", event.target.value)} placeholder="https://..." maxLength="500" />
            </label>
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-950 sm:flex-row">
            <input className="min-w-0 flex-1" type="email" placeholder="test@example.com" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} />
            <button className="btn-secondary shrink-0" disabled={testing || sending} onClick={sendTest} type="button"><TestTube2 size={16} /> {testing ? "Sending..." : "Send test"}</button>
          </div>

          <button className="btn-primary w-full" disabled={sending || stats.activeSubscribers < 1} type="submit">
            <Send size={16} /> {sending ? "Sending broadcast..." : "Send broadcast"}
          </button>
          {stats.activeSubscribers < 1 && <p className="text-sm font-semibold text-clay">There are no active newsletter subscribers.</p>}
        </form>

        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Email preview</p>
          <BroadcastPreview form={form} />
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-2xl font-black">Recent Broadcasts</h3>
        <HistoryTable broadcasts={broadcasts} />
        <HistoryPager meta={historyMeta} page={historyPage} setPage={setHistoryPage} />
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="presentation" onMouseDown={() => !sending && setConfirmOpen(false)}>
          <div className="panel w-full max-w-md space-y-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="newsletter-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-clay">Confirm broadcast</p>
                <h3 className="text-2xl font-black" id="newsletter-confirm-title">Send to {stats.activeSubscribers} subscribers?</h3>
              </div>
              <button className="btn-secondary h-9 w-9 px-0" disabled={sending} onClick={() => setConfirmOpen(false)} type="button" aria-label="Close confirmation"><X size={16} /></button>
            </div>
            <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">Each active subscriber receives a separate email with their own unsubscribe link. This action cannot be recalled after delivery begins.</p>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" disabled={sending} onClick={() => setConfirmOpen(false)} type="button">Cancel</button>
              <button className="btn-primary" disabled={sending} onClick={sendBroadcast} type="button"><Send size={16} /> {sending ? "Sending..." : "Send now"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
