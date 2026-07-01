import React from "react";
import { ContactForm } from "../components/ContactForm.jsx";

export function Contact() {
  return (
    <section className="bg-white py-12 dark:bg-neutral-950">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-clay">Contact</p>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">Talk to VASTRA</h1>
          </div>
          <p className="max-w-xl text-neutral-600 dark:text-neutral-300">
            Questions about orders, vendor approval, sizing, or collaborations are welcome. Send a note and the team will follow up.
          </p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="panel">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Email</p>
              <p className="mt-1 font-semibold">hello@vastra.example</p>
            </div>
            <div className="panel">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Hours</p>
              <p className="mt-1 font-semibold">Monday to Friday, 9:00-18:00</p>
            </div>
            <div className="panel">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Studio</p>
              <p className="mt-1 font-semibold">18 Atelier Row, Kathmandu</p>
            </div>
          </div>
        </div>
        <div className="lg:pt-2">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
