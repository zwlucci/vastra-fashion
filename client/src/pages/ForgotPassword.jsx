import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";

const GENERIC_MESSAGE = "If an account exists for this email, password reset instructions have been sent.";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.message || GENERIC_MESSAGE);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <form className="panel space-y-5 p-6 sm:p-8" onSubmit={submit}>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Account help</p>
          <h1 className="mt-1 text-3xl font-black">Forgot password?</h1>
          <p className="mt-2 text-sm text-neutral-500">Enter your account email and we will send password reset instructions.</p>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Email</span>
          <input className="h-11 w-full" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">{message}</p>}
        <button className="btn-primary w-full" disabled={submitting} type="submit">{submitting ? "Sending..." : "Send reset instructions"}</button>
        <p className="text-center text-sm text-neutral-500"><Link className="font-semibold text-clay hover:underline" to="/login">Back to login</Link></p>
      </form>
    </section>
  );
}
