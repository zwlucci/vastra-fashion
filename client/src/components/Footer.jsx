import { Send } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";

export function Footer() {
  const { user } = useAuth();
  const { showNotice } = useNotification();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user?.email]);

  async function subscribe(event) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      showNotice("Enter a valid email address for VASTRA updates.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/newsletter/subscribe", { email: normalized });
      setEmail("");
      showNotice(data.message || "You're subscribed to VASTRA updates.");
    } catch (error) {
      showNotice(error.response?.status === 429 ? "Too many subscription attempts. Please try again later." : "Unable to update your newsletter subscription. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <footer className="bg-ink text-neutral-200">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-2xl font-black tracking-[0.18em] text-white">VASTRA</p>
            <p className="mt-4 max-w-sm text-sm leading-6 text-neutral-400">Premium everyday clothing from curated independent vendors, shaped for expressive personal style.</p>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-white">Quick Links</h2>
            <nav className="mt-4 grid gap-3 text-sm text-neutral-400" aria-label="Footer quick links">
              <Link className="hover:text-white" to="/">Home</Link>
              <Link className="hover:text-white" to="/shop">Shop</Link>
              <Link className="hover:text-white" to="/contact">Contact</Link>
            </nav>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-white">Categories</h2>
            <nav className="mt-4 grid gap-3 text-sm text-neutral-400" aria-label="Footer collection links">
              <Link className="hover:text-white" to="/shop?gender=Men">Men's Collection</Link>
              <Link className="hover:text-white" to="/shop?gender=Women">Women's Collection</Link>
              <Link className="hover:text-white" to="/shop?gender=Unisex">Unisex Collection</Link>
            </nav>
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-white">Newsletter</h2>
            <p className="mt-4 text-sm leading-6 text-neutral-400">Fresh edits, vendor highlights, and VASTRA style notes in your inbox.</p>
            <form className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row" onSubmit={subscribe}>
              <input
                className="min-w-0 flex-1 border-neutral-700 bg-neutral-950 text-white placeholder:text-neutral-500"
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-label="Newsletter email address"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
              />
              <button className="btn-primary shrink-0 bg-clay hover:bg-white hover:text-ink dark:bg-clay dark:text-white dark:hover:bg-white dark:hover:text-ink" disabled={submitting} type="submit">
                <Send size={16} /> {submitting ? "Joining..." : "Subscribe"}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-neutral-500">
          <p>&copy; {currentYear} VASTRA. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
