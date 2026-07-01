import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resendVerificationOtp, verifyEmail } = useAuth();
  const [form, setForm] = useState({ email: location.state?.email || "", otp: "" });
  const [message, setMessage] = useState(location.state?.email ? "We sent a verification OTP to your email." : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await verifyEmail(form);
      setMessage(result.message || "Email verified. You can now log in.");
      setTimeout(() => navigate("/login", { replace: true, state: { email: form.email } }), 700);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError("");
    setMessage("");
    if (!form.email) {
      setError("Enter your email before requesting a new OTP.");
      return;
    }
    setLoading(true);
    try {
      const result = await resendVerificationOtp({ email: form.email });
      setMessage(result.message || "A new OTP has been sent to your email.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <form className="panel space-y-4" onSubmit={submit}>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Email verification</p>
          <h1 className="mt-1 text-3xl font-black">Enter your OTP</h1>
        </div>
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input required inputMode="numeric" maxLength="6" minLength="6" pattern="[0-9]{6}" placeholder="6-digit OTP" value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
        {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">{message}</p>}
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
        <button className="btn-primary w-full" disabled={loading} type="submit">{loading ? "Verifying..." : "Verify email"}</button>
        <button className="btn-secondary w-full" disabled={loading} onClick={resend} type="button">Resend OTP</button>
        <p className="text-sm text-neutral-500">Already verified? <Link className="font-semibold text-clay" to="/login">Login</Link></p>
      </form>
    </section>
  );
}
