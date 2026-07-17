import { ChevronLeft, ChevronRight, Edit3, ImagePlus, Star, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage, resolveImageUrl } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { ProductImage } from "./ProductImage.jsx";
import { UserAvatar } from "./UserAvatar.jsx";

const reviewImageLimit = 5;
const reviewImageMaxBytes = 5 * 1024 * 1024;
const reviewImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const reviewImageAccept = "image/jpeg,image/png,image/webp";

function Stars({ rating }) {
  return <span className="inline-flex text-amber-500" aria-label={`${rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star fill={star <= rating ? "currentColor" : "none"} size={16} key={star} />)}</span>;
}

export function EntityReviews({ type, entityId, title, canReview = true }) {
  const { isAuthenticated, user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ averageRating: 0, count: 0 });
  const [form, setForm] = useState({ rating: 5, body: "" });
  const [selectedImages, setSelectedImages] = useState([]);
  const [retainedImageUrls, setRetainedImageUrls] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [purchaseEligible, setPurchaseEligible] = useState(type === "product" ? null : true);
  const selectedImagesRef = useRef([]);
  const base = type === "product" ? "/product-reviews" : "/vendor-reviews";
  const targetPath = type === "product" ? `product/${entityId}` : `vendor/${entityId}`;
  const ownReview = useMemo(() => reviews.find((review) => review.user.id === user?.id), [reviews, user?.id]);
  const productImageCount = retainedImageUrls.length + selectedImages.length;

  function applyData(data) {
    setReviews(data.reviews || []);
    setSummary(data.summary || { averageRating: 0, count: 0 });
  }

  function clearSelectedImages(images = selectedImages) {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => () => clearSelectedImages(selectedImagesRef.current), []);

  useEffect(() => {
    setLoading(true);
    api.get(`${base}/${targetPath}`)
      .then(({ data }) => applyData(data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [base, targetPath]);

  useEffect(() => {
    if (type !== "product") {
      setPurchaseEligible(true);
      return;
    }
    if (!isAuthenticated) {
      setPurchaseEligible(null);
      return;
    }
    setPurchaseEligible(null);
    api.get(`${base}/${targetPath}/eligibility`)
      .then(({ data }) => setPurchaseEligible(Boolean(data.canReview)))
      .catch((err) => {
        setPurchaseEligible(false);
        setError(getErrorMessage(err));
      });
  }, [base, isAuthenticated, targetPath, type, user?.id]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const shouldSendMultipart = type === "product" && selectedImages.length > 0;
      const reviewPayload = {
        ...form,
        ...(type === "product" && editing ? { retainedImageUrls } : {})
      };
      let requestBody = reviewPayload;
      let requestConfig;
      if (shouldSendMultipart) {
        const multipart = new FormData();
        multipart.append("rating", String(form.rating));
        multipart.append("body", form.body);
        if (editing) multipart.append("retainedImageUrls", JSON.stringify(retainedImageUrls));
        selectedImages.forEach((image) => multipart.append("images", image.file));
        requestBody = multipart;
        requestConfig = { headers: { "Content-Type": "multipart/form-data" } };
      }

      const { data } = editing && ownReview
        ? await api.put(`${base}/${ownReview.id}`, requestBody, requestConfig)
        : await api.post(`${base}/${targetPath}`, requestBody, requestConfig);
      applyData(data);
      setForm({ rating: 5, body: "" });
      clearSelectedImages();
      setSelectedImages([]);
      setRetainedImageUrls([]);
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
      clearSelectedImages();
      setSelectedImages([]);
      setRetainedImageUrls([]);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setForm({ rating: ownReview.rating, body: ownReview.body });
    clearSelectedImages();
    setSelectedImages([]);
    setRetainedImageUrls(type === "product" ? (ownReview.imageUrls || []) : []);
    setEditing(true);
  }

  function cancelEditing() {
    clearSelectedImages();
    setSelectedImages([]);
    setRetainedImageUrls([]);
    setForm({ rating: 5, body: "" });
    setEditing(false);
  }

  function selectReviewImages(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (productImageCount + files.length > reviewImageLimit) {
      setError("You can upload a maximum of 5 images.");
      return;
    }

    for (const file of files) {
      if (!reviewImageTypes.has(file.type)) {
        setError("Only JPEG, PNG, and WEBP images are supported.");
        return;
      }
      if (file.size > reviewImageMaxBytes) {
        setError("Each image must be smaller than 5 MB.");
        return;
      }
    }
    const nextImages = files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    setError("");
    setSelectedImages([...selectedImages, ...nextImages]);
  }

  function removeSelectedImage(index) {
    const image = selectedImages[index];
    if (image) URL.revokeObjectURL(image.previewUrl);
    setSelectedImages(selectedImages.filter((_, imageIndex) => imageIndex !== index));
  }

  function openLightbox(images, index, label) {
    setLightbox({ images, index, label });
  }

  function moveLightbox(direction) {
    setLightbox((current) => {
      if (!current) return current;
      const nextIndex = (current.index + direction + current.images.length) % current.images.length;
      return { ...current, index: nextIndex };
    });
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
      ) : type === "product" && purchaseEligible === null ? (
        <p className="panel text-center text-neutral-500">Checking purchase eligibility...</p>
      ) : type === "product" && !purchaseEligible ? (
        <p className="panel text-center text-neutral-500">You can only review products you have purchased.</p>
      ) : (!ownReview || editing) && (
        <form className="panel space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <label className="space-y-1"><span className="text-sm font-semibold">Rating</span><select className="w-full" value={form.rating} onChange={(event) => setForm({ ...form, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{value} stars</option>)}</select></label>
            <label className="space-y-1"><span className="text-sm font-semibold">Review</span><textarea className="w-full resize-none" minLength="5" maxLength="1500" required rows="4" placeholder="Share your experience..." value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
          </div>
          {type === "product" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
                <div>
                  <p className="font-semibold">Review photos</p>
                  <p className="text-sm text-neutral-500">Optional. Up to 5 images, JPEG, PNG, or WEBP, 5 MB each.</p>
                </div>
                <label className={`btn-secondary cursor-pointer ${productImageCount >= reviewImageLimit ? "pointer-events-none opacity-60" : ""}`}>
                  <ImagePlus size={16} /> Add photos
                  <input className="sr-only" type="file" accept={reviewImageAccept} multiple disabled={productImageCount >= reviewImageLimit} onChange={selectReviewImages} />
                </label>
              </div>
              {(retainedImageUrls.length > 0 || selectedImages.length > 0) && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {retainedImageUrls.map((url) => (
                    <div className="relative aspect-square overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800" key={url}>
                      <ProductImage className="h-full w-full object-cover" src={url} alt="Attached review photo" />
                      <button className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-soft hover:bg-red-50 dark:bg-neutral-900/90 dark:hover:bg-red-950" onClick={() => setRetainedImageUrls(retainedImageUrls.filter((imageUrl) => imageUrl !== url))} type="button" title="Remove photo"><X size={14} /></button>
                    </div>
                  ))}
                  {selectedImages.map((image, index) => (
                    <div className="relative aspect-square overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800" key={image.previewUrl}>
                      <img className="h-full w-full object-cover" src={image.previewUrl} alt="Selected review photo preview" />
                      <button className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-soft hover:bg-red-50 dark:bg-neutral-900/90 dark:hover:bg-red-950" onClick={() => removeSelectedImage(index)} type="button" title="Remove photo"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3"><button className="btn-primary" disabled={saving} type="submit">{saving ? "Saving..." : editing ? "Save review" : "Post review"}</button>{editing && <button className="btn-secondary" onClick={cancelEditing} type="button">Cancel</button>}</div>
        </form>
      )}

      {loading ? <p className="py-8 text-center text-neutral-500">Loading reviews...</p> : reviews.length ? (
        <div className="space-y-4">
          {reviews.map((review) => {
            const edited = new Date(review.updatedAt).getTime() > new Date(review.createdAt).getTime() + 1000;
            const imageUrls = review.imageUrls || [];
            return (
              <article className="panel" key={review.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3"><UserAvatar user={review.user} size="md" /><div><p className="font-bold">{review.user.name}</p><Stars rating={review.rating} /></div></div>
                  {review.user.id === user?.id && <div className="flex gap-2"><button className="btn-secondary h-9 px-3" onClick={startEditing} type="button"><Edit3 size={14} /> Edit</button><button className="btn-secondary h-9 px-3 text-red-600" disabled={saving} onClick={removeOwnReview} type="button"><Trash2 size={14} /> Delete</button></div>}
                </div>
                <p className="mt-4 whitespace-pre-wrap leading-7 text-neutral-600 dark:text-neutral-300">{review.body}</p>
                {type === "product" && imageUrls.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {imageUrls.map((url, index) => (
                      <button className="h-20 w-20 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950" onClick={() => openLightbox(imageUrls, index, `${review.user.name}'s review photo`)} type="button" key={url} title="Open photo">
                        <ProductImage className="h-full w-full object-cover" src={url} alt={`${review.user.name}'s review photo ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-neutral-500">{new Date(review.createdAt).toLocaleDateString()}{edited ? ` - Updated ${new Date(review.updatedAt).toLocaleDateString()}` : ""}</p>
              </article>
            );
          })}
        </div>
      ) : <div className="panel py-10 text-center text-neutral-500">No reviews yet.</div>}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="relative flex max-h-full w-full max-w-4xl items-center justify-center">
            <button className="absolute right-0 top-0 z-10 flex h-10 w-10 -translate-y-2 translate-x-2 items-center justify-center rounded-full bg-white text-ink shadow-soft dark:bg-neutral-900 dark:text-white" onClick={() => setLightbox(null)} type="button" title="Close"><X size={18} /></button>
            {lightbox.images.length > 1 && <button className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft dark:bg-neutral-900/90 dark:text-white" onClick={() => moveLightbox(-1)} type="button" title="Previous photo"><ChevronLeft size={22} /></button>}
            <img className="max-h-[82vh] max-w-full rounded-md object-contain" src={resolveImageUrl(lightbox.images[lightbox.index])} alt={lightbox.label} />
            {lightbox.images.length > 1 && <button className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-soft dark:bg-neutral-900/90 dark:text-white" onClick={() => moveLightbox(1)} type="button" title="Next photo"><ChevronRight size={22} /></button>}
            {lightbox.images.length > 1 && <p className="absolute bottom-3 rounded-full bg-black/60 px-3 py-1 text-sm font-semibold text-white">{lightbox.index + 1} / {lightbox.images.length}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
