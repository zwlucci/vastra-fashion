import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", phoneNumber: "", dateOfBirth: "" });
  const [error, setError] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await register(form);
      navigate("/verify-email", { state: { email: result.email || form.email } });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-12 sm:py-16">
      <form className="panel space-y-5 p-6 sm:p-8" onSubmit={submit}>
        <div><p className="text-sm font-bold uppercase tracking-wide text-clay">Join VASTRA</p><h1 className="mt-1 text-3xl font-black">Create your account</h1><p className="mt-2 text-sm text-neutral-500">Start saving favorites and discovering independent fashion.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1"><span className="text-sm font-semibold">Full name</span><input className="h-11 w-full" required autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="space-y-1"><span className="text-sm font-semibold">Email</span><input className="h-11 w-full" required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="space-y-1"><span className="text-sm font-semibold">Phone number <span className="font-normal text-neutral-400">(optional)</span></span><input className="h-11 w-full" type="tel" autoComplete="tel" placeholder="+977 98..." value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} /></label>
          <label className="space-y-1"><span className="text-sm font-semibold">Date of birth <span className="font-normal text-neutral-400">(optional)</span></span><input className="h-11 w-full" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></label>
        </div>
        <label className="block space-y-1"><span className="text-sm font-semibold">Password</span><input className="h-11 w-full" required minLength="8" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
        <button className="btn-primary w-full" type="submit">Create account</button>
        <p className="text-center text-sm text-neutral-500">Already have an account? <Link className="font-semibold text-clay hover:underline" to="/login">Login here</Link></p>
      </form>
    </section>
  );
}
