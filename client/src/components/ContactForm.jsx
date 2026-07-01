import React, { useState } from "react";
import { api, getErrorMessage } from "../api/client.js";

const initial = { name: "", email: "", subject: "", message: "" };

export function ContactForm() {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("");
    try {
      await api.post("/contact", form);
      setForm(initial);
      setStatus("Message sent. We will get back to you soon.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  return (
    <form className="panel space-y-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Name</span>
          <input className="w-full" required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Email</span>
          <input className="w-full" required type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Subject</span>
        <input className="w-full" required placeholder="How can we help?" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Message</span>
        <textarea className="w-full resize-none" required rows="7" placeholder="Tell us a little more" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </label>
      {status && <p className="text-sm text-clay">{status}</p>}
      <button className="btn-primary" type="submit">Send message</button>
    </form>
  );
}
