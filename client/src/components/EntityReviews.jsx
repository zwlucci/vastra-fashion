import { Edit3, Star, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { UserAvatar } from "./UserAvatar.jsx";

function Stars({ rating }) {
  return <span className="inline-flex text-amber-500" aria-label={`${rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star fill={star <= rating ? "currentColor" : "none"} size={16} key={star} />)}</span>;
}

export function EntityReviews({ type, entityId, title, canReview = true }) {
  const { isAuthenticated, user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ averageRating: 0, count: 0 });
  const [form, setForm] = useState({ rating: 5, body: "" });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const base = type === "product" ? "/product-reviews" : "/vendor-reviews";
  const targetPath = type === "product" ? `product/${entityId}` : `vendor/${entityId}`;
  const ownReview = useMemo(() => reviews.find((review) => review.user.id === user?.id), [reviews, user?.id]);

  function applyData(data) {
    setReviews(data.reviews || []);
    setSummary(data.summary || { averageRating: 0, count: 0 });
  }

  useEffect(() => {
    setLoading(true);
    api.get(`${base}/${targetPath}`)
      .then(({ data }) => applyData(data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [base, targetPath]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = editing && ownReview
        ? await api.put(`${base}/${ownReview.id}`, form)
        : await api.post(`${base}/${targetPath}`, form);
      applyData(data);
      setForm({ rating: 5, body: "" });
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeOwnReview() {
    if (!ownReview || saving) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.delete(`${base}/${ownReview.id}`);
      applyData(data);
      setForm({ rating: 5, body: "" });
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setForm({ rating: ownReview.rating, body: ownReview.body });
    setEditing(true);
  }

  return (
    <section className="space-y-5 border-t border-neutral-200 pt-8 dark:border-neutral-800">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Reviews</p><h2 className="text-3xl font-black">{title}</h2></div>
        <div className="panel py-3 text-right"><div className="flex items-center gap-2"><Stars rating={Math.round(summary.averageRating)} /><strong>{summary.averageRating.toFixed(1)}</strong></div><p className="text-xs text-neutral-500">{summary.count} {summary.count === 1 ? "review" : "reviews"}</p></div>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}

      {!isAuthenticated ? (
        <div className="panel text-center"><p className="text-neutral-500">Login to leave a rating and review.</p><Link className="btn-primary mt-3" to="/login">Login</Link></div>
      ) : !canReview ? (
        <p className="panel text-center text-neutral-500">You cannot review your own {type}.</p>
      ) : (!ownReview || editing) && (
        <form className="panel space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <label className="space-y-1"><span className="text-sm font-semibold">Rating</span><select className="w-full" value={form.rating} onChange={(event) => setForm({ ...form, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{value} stars</option>)}</select></label>
            <label className="space-y-1"><span className="text-sm font-semibold">Review</span><textarea className="w-full resize-none" minLength="5" maxLength="1500" required rows="4" placeholder="Share your experience..." value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
          </div>
          <div className="flex gap-3"><button className="btn-primary" disabled={saving} type="submit">{saving ? "Saving..." : editing ? "Save review" : "Post review"}</button>{editing && <button className="btn-secondary" onClick={() => { setEditing(false); setForm({ rating: 5, body: "" }); }} type="button">Cancel</button>}</div>
        </form>
      )}

      {loading ? <p className="py-8 text-center text-neutral-500">Loading reviews...</p> : reviews.length ? (
        <div className="space-y-4">
          {reviews.map((review) => {
            const edited = new Date(review.updatedAt).getTime() > new Date(review.createdAt).getTime() + 1000;
            return <article className="panel" key={review.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><UserAvatar user={review.user} size="md" /><div><p className="font-bold">{review.user.name}</p><Stars rating={review.rating} /></div></div>{review.user.id === user?.id && <div className="flex gap-2"><button className="btn-secondary h-9 px-3" onClick={startEditing} type="button"><Edit3 size={14} /> Edit</button><button className="btn-secondary h-9 px-3 text-red-600" disabled={saving} onClick={removeOwnReview} type="button"><Trash2 size={14} /> Delete</button></div>}</div><p className="mt-4 whitespace-pre-wrap leading-7 text-neutral-600 dark:text-neutral-300">{review.body}</p><p className="mt-3 text-xs text-neutral-500">{new Date(review.createdAt).toLocaleDateString()}{edited ? ` · Updated ${new Date(review.updatedAt).toLocaleDateString()}` : ""}</p></article>;
          })}
        </div>
      ) : <div className="panel py-10 text-center text-neutral-500">No reviews yet.</div>}
    </section>
  );
}
