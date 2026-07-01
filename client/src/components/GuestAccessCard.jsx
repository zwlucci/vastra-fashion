import React from "react";
import { Link } from "react-router-dom";

export function GuestAccessCard({ title, message }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <div className="panel text-center">
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">{message}</p>
        <Link className="btn-primary mt-4" to="/login">Login</Link>
      </div>
    </section>
  );
}
