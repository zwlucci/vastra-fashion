import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, resendLoginOtp, verifyLoginOtp } = useAuth();
  const [form, setForm] = useState({ email: location.state?.email || "", password: "" });
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const needsVerification = error.toLowerCase().includes("verify your email");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const result = await login(form);
      if (result.requiresOtp) {
        setChallengeId(result.challengeId);
        setMessage(result.message);
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOtp(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const result = await verifyLoginOtp({ challengeId, otp });
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError("");
    try {
      const result = await resendLoginOtp(challengeId);
      setMessage(result.message);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function restart() {
    setChallengeId("");
    setOtp("");
    setError("");
    setMessage("");
  }

  return (
    <section className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <form className="panel space-y-5 p-6 sm:p-8" onSubmit={challengeId ? submitOtp : submit}>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Welcome back</p>
          <h1 className="mt-1 text-3xl font-black">{challengeId ? "Verify login" : "Login"}</h1>
          <p className="mt-2 text-sm text-neutral-500">{challengeId ? `Enter the six-digit code sent to ${form.email}.` : "Continue to your VASTRA profile and saved styles."}</p>
        </div>
        {!challengeId ? <>
          <label className="block space-y-1"><span className="text-sm font-semibold">Email</span><input className="h-11 w-full" required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold">Password</span><input className="h-11 w-full" required type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <div className="text-right"><Link className="text-sm font-semibold text-clay hover:underline" to="/forgot-password">Forgot password?</Link></div>
        </> : (
          <label className="block space-y-1"><span className="text-sm font-semibold">Login code</span><input className="h-12 w-full text-center text-xl tracking-[0.4em]" required inputMode="numeric" autoComplete="one-time-code" maxLength="6" pattern="[0-9]{6}" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus /></label>
        )}
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">{message}</p>}
        {needsVerification && <Link className="text-sm font-semibold text-clay" to="/verify-email" state={{ email: form.email }}>Enter verification OTP</Link>}
        <button className="btn-primary w-full" disabled={submitting} type="submit">{submitting ? "Please wait..." : challengeId ? "Verify and login" : "Login"}</button>
        {challengeId && <div className="flex items-center justify-between gap-3 text-sm"><button className="font-semibold text-clay hover:underline" onClick={resend} type="button">Resend code</button><button className="font-semibold text-neutral-500 hover:text-clay" onClick={restart} type="button">Use another account</button></div>}
        {!challengeId && <p className="text-center text-sm text-neutral-500">New here? <Link className="font-semibold text-clay hover:underline" to="/register">Create an account</Link></p>}
      </form>
    </section>
  );
}
