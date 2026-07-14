import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, LayoutGrid, Quote, Sparkles, Store } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { PageContainer } from "../components/PageContainer.jsx";
import { ProductGrid } from "../components/ProductGrid.jsx";
import { ProductImage } from "../components/ProductImage.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";

const heroSlides = [
  {
    eyebrow: "New season - 2026",
    title: "Style that moves with you.",
    subtitle: "Discover expressive silhouettes, easy layers, and fresh pieces from independent VASTRA vendors.",
    cta: "Shop new arrivals",
    to: "/shop?sort=newest",
    image: "/banners/runway-editorial-1.jpg",
    imagePosition: "center 22%",
    tone: "bg-[#e9dfd3] dark:bg-[#26211d]"
  },
  {
    eyebrow: "The edit - Modern tailoring",
    title: "Make an entrance. Keep your edge.",
    subtitle: "Polished shapes meet confident color in a marketplace made for personal style.",
    cta: "Explore the collection",
    to: "/shop",
    image: "/banners/runway-editorial-2.jpg",
    imagePosition: "center 28%",
    tone: "bg-[#dce2dd] dark:bg-[#1c2723]"
  }
];

const valuePoints = [
  [Store, "Independent vendors", "Shop pieces from emerging and established fashion sellers."],
  [BadgeCheck, "Curated styles", "Browse by gender, category, price, and brand without the noise."],
  [Sparkles, "Fresh arrivals", "New approved products surface as vendors add their latest work."]
];

function HomepageCategories() {
  const [state, setState] = useState({ visible: true, shortcuts: [], loading: true, failed: false });

  useEffect(() => {
    let ignore = false;
    api.get("/homepage-categories")
      .then(({ data }) => {
        if (!ignore) setState({ visible: data.visible !== false, shortcuts: data.shortcuts || [], loading: false, failed: false });
      })
      .catch(() => {
        if (!ignore) setState({ visible: true, shortcuts: [], loading: false, failed: true });
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (!state.visible || state.failed || (!state.loading && !state.shortcuts.length)) return null;

  return (
    <PageContainer as="section" className="pt-4">
      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-soft dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-clay">Shop by category</p>
            <h2 className="mt-1 text-2xl font-black">Find your next piece faster.</h2>
          </div>
          <LayoutGrid className="hidden text-clay sm:block" size={24} />
        </div>
        <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible md:grid-cols-4 lg:grid-cols-6">
          {state.loading
            ? Array.from({ length: 6 }, (_, index) => <div className="h-32 min-w-[112px] animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" key={index} />)
            : state.shortcuts.map((shortcut) => (
              <Link
                className="group flex min-w-[112px] flex-col items-center rounded-xl p-2 text-center outline-none hover:bg-clay/5 focus-visible:ring-2 focus-visible:ring-clay/40"
                to={`/categories/${shortcut.slug}`}
                key={shortcut.id}
              >
                <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-pearl p-1 shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-clay dark:border-neutral-800 dark:bg-neutral-950">
                  <ProductImage className="h-full w-full rounded-full object-cover" fallbackClassName="rounded-full" src={shortcut.iconUrl} alt={`${shortcut.displayName} category icon`} />
                </span>
                <span className="mt-2 max-h-10 overflow-hidden text-sm font-bold leading-5">{shortcut.displayName}</span>
              </Link>
            ))}
        </div>
      </div>
    </PageContainer>
  );
}

function PromoBanner() {
  return (
    <PageContainer as="section" className="pt-6">
      <div className="grid overflow-hidden rounded-2xl border border-neutral-200 bg-[#f3ece4] shadow-soft dark:border-neutral-800 dark:bg-[#1f1b18] md:grid-cols-[1fr_0.9fr]">
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-clay">Seasonal edit</p>
          <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">Summer Collection</h2>
          <p className="mt-4 max-w-xl leading-7 text-neutral-700 dark:text-neutral-300">Refresh your wardrobe with selected styles for the season.</p>
          <p className="mt-5 text-xl font-black text-clay">Up to 40% off</p>
          <div className="mt-7">
            <Link className="btn-primary" to="/shop?category=Summer+Wear">Shop the collection <ArrowRight size={18} /></Link>
          </div>
        </div>
        <div className="relative min-h-[260px] md:min-h-[360px]">
          <img className="absolute inset-0 h-full w-full object-cover" src="/banners/runway-editorial-1.jpg" alt="Editorial summer fashion collection" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent md:bg-gradient-to-r md:from-[#f3ece4] md:via-transparent md:to-transparent dark:md:from-[#1f1b18]" />
        </div>
      </div>
    </PageContainer>
  );
}

function WhyVastra() {
  return (
    <PageContainer as="section" className="pt-10">
      <div className="grid gap-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-soft dark:border-neutral-800 dark:bg-neutral-900 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:p-10">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Why VASTRA</p>
          <h2 className="mt-3 max-w-lg text-4xl font-black leading-tight sm:text-5xl">A refined marketplace for personal style.</h2>
          <p className="mt-5 max-w-xl leading-7 text-neutral-600 dark:text-neutral-300">Discover curated clothing and accessories from independent vendors, with fresh arrivals and practical filters that keep the shopping experience focused.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-3">
          {valuePoints.map(([Icon, title, body]) => (
            <article className="flex min-h-52 flex-col rounded-xl border border-neutral-200 bg-pearl p-5 transition hover:-translate-y-1 hover:shadow-soft dark:border-neutral-800 dark:bg-neutral-950" key={title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-clay/10 text-clay"><Icon size={20} /></span>
              <p className="mt-5 font-black">{title}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

export function Home() {
  const { isAuthenticated } = useAuth();
  const { showNotice } = useNotification();
  const [products, setProducts] = useState([]);
  const [hotPicks, setHotPicks] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [hotPicksLoading, setHotPicksLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewBody, setReviewBody] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    api.get("/products?sort=newest").then(({ data }) => setProducts(data.products || [])).catch(() => setProducts([])).finally(() => setProductsLoading(false));
    api.get("/products?sort=popular&purchased=true").then(({ data }) => setHotPicks(data.products || [])).catch(() => setHotPicks([])).finally(() => setHotPicksLoading(false));
    api.get("/reviews").then(({ data }) => setReviews(data.reviews || [])).catch(() => setReviews([]));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % heroSlides.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  function moveSlide(direction) {
    setActiveSlide((current) => (current + direction + heroSlides.length) % heroSlides.length);
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!isAuthenticated) {
      showNotice("Please login to leave a review.", "warning", { label: "Login", to: "/login" });
      return;
    }
    try {
      await api.post("/reviews", { body: reviewBody });
      setReviewBody("");
      const { data } = await api.get("/reviews");
      setReviews(data.reviews || []);
      showNotice("Review posted.");
    } catch (error) {
      showNotice(getErrorMessage(error), "error");
    }
  }

  const slide = heroSlides[activeSlide];

  return (
    <div className="pb-2">
      <PageContainer as="section" className="py-4 sm:py-6">
        <div className={`relative h-[690px] overflow-hidden rounded-2xl ${slide.tone} shadow-soft sm:h-[720px] lg:h-[640px]`}>
          <div className="grid h-full grid-rows-[1fr_280px] lg:grid-cols-[0.92fr_1.08fr] lg:grid-rows-1">
            <div className="relative z-10 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-clay">{slide.eyebrow}</p>
              <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">{slide.title}</h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-neutral-700 dark:text-neutral-300 sm:text-lg">{slide.subtitle}</p>
              <div className="mt-8"><Link className="btn-primary" to={slide.to}>{slide.cta} <ArrowRight size={18} /></Link></div>
            </div>
            <div className="relative h-full overflow-hidden">
              <img className="absolute inset-0 h-full w-full object-cover" src={slide.image} style={{ objectPosition: slide.imagePosition }} alt="VASTRA fashion collection" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent lg:bg-gradient-to-r lg:from-black/10 lg:to-transparent" />
            </div>
          </div>
          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/90 px-3 py-2 shadow-soft backdrop-blur dark:bg-neutral-950/80">
            <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => moveSlide(-1)} type="button" aria-label="Previous banner"><ChevronLeft size={16} /></button>
            {heroSlides.map((item, index) => <button className={`h-2.5 rounded-full transition-all ${index === activeSlide ? "w-8 bg-clay" : "w-2.5 bg-neutral-300 dark:bg-neutral-700"}`} onClick={() => setActiveSlide(index)} type="button" aria-label={`Show banner ${index + 1}`} key={item.title} />)}
            <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={() => moveSlide(1)} type="button" aria-label="Next banner"><ChevronRight size={16} /></button>
          </div>
        </div>
      </PageContainer>

      <HomepageCategories />
      <PromoBanner />
      <WhyVastra />

      <PageContainer as="section" className="pt-12">
        <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Sorted by most purchased</p><h2 className="text-3xl font-black">Hot Picks</h2></div><Link className="btn-secondary" to="/shop">Shop all</Link></div>
        {hotPicksLoading ? <ProductGrid products={[]} loading /> : hotPicks.length ? <ProductGrid products={hotPicks.slice(0, 4)} loading={false} /> : <div className="panel py-12 text-center text-neutral-500">No hot picks yet.</div>}
      </PageContainer>

      <PageContainer as="section" className="py-14">
        <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wide text-clay">New arrivals</p><h2 className="text-3xl font-black">Fresh from vendors</h2></div><Link className="btn-secondary" to="/shop?sort=newest">View all</Link></div>
        <ProductGrid products={products.slice(0, 4)} loading={productsLoading} />
      </PageContainer>

      <section className="border-t border-neutral-200 bg-white py-14 dark:border-neutral-800 dark:bg-neutral-950">
        <PageContainer className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Community notes</p><h2 className="text-3xl font-black">What shoppers say</h2></div><form className="flex min-w-[280px] flex-1 gap-2 md:max-w-xl" onSubmit={submitReview}><input className="flex-1" placeholder="Share a short review..." value={reviewBody} onChange={(event) => setReviewBody(event.target.value)} /><button className="btn-primary" disabled={!reviewBody.trim()} type="submit">Post</button></form></div>
          <div className="grid gap-4 md:grid-cols-3">{reviews.slice(0, 6).map((review) => <article className="panel" key={review.id}><Quote className="mb-3 text-clay" size={24} /><div className="flex items-center gap-3"><UserAvatar user={review.user} size="md" /><div><p className="font-bold">{review.user.name}</p><p className="text-xs text-neutral-500">{review.pinned ? "Pinned - " : ""}{new Date(review.createdAt).toLocaleDateString()}</p></div></div><p className="mt-4 leading-7 text-neutral-600 dark:text-neutral-300">{review.body}</p></article>)}{!reviews.length && <div className="panel py-10 text-center text-neutral-500 md:col-span-3">No reviews yet.</div>}</div>
        </PageContainer>
      </section>
    </div>
  );
}
