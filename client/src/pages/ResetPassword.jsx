import { Eye, EyeOff } from "lucide-react";
import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const token = searchParams.get("token") || "";

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords must match.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, ...form });
      setMessage(data.message || "Password reset successful. You can now log in.");
      setTimeout(() => navigate("/login", { replace: true }), 1600);
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
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Password reset</p>
          <h1 className="mt-1 text-3xl font-black">Choose a new password</h1>
          <p className="mt-2 text-sm text-neutral-500">Use at least 8 characters. The reset link can only be used once.</p>
        </div>
        {!token && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">Password reset link is missing or invalid.</p>}
        <label className="block space-y-1">
          <span className="text-sm font-semibold">New password</span>
          <div className="flex rounded-md border border-neutral-200 bg-white focus-within:ring-2 focus-within:ring-clay dark:border-neutral-800 dark:bg-neutral-950">
            <input className="h-11 min-w-0 flex-1 border-0 bg-transparent focus:ring-0" required minLength="8" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <button className="px-3 text-neutral-500" type="button" title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Confirm new password</span>
          <input className="h-11 w-full" required minLength="8" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
        </label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
        {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">{message}</p>}
        <button className="btn-primary w-full" disabled={submitting || !token} type="submit">{submitting ? "Saving..." : "Reset password"}</button>
        <p className="text-center text-sm text-neutral-500"><Link className="font-semibold text-clay hover:underline" to="/login">Back to login</Link></p>
      </form>
    </section>
  );
}
