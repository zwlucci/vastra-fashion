import { MailCheck } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";

export function NewsletterUnsubscribe() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Confirming your unsubscribe request...");
  const token = searchParams.get("token") || "";

  useEffect(() => {
    let active = true;
    async function unsubscribe() {
      if (!token) {
        setStatus("error");
        setMessage("This unsubscribe link is missing its secure token.");
        return;
      }

      try {
        const { data } = await api.get(`/newsletter/unsubscribe/${encodeURIComponent(token)}`);
        if (!active) return;
        setStatus("success");
        setMessage(data.message || "You have been unsubscribed from VASTRA newsletters.");
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(getErrorMessage(error));
      }
    }

    unsubscribe();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <section className="mx-auto flex min-h-[520px] max-w-2xl items-center px-4 py-14">
      <div className="panel w-full space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-clay/10 text-clay">
          <MailCheck size={26} />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-clay">Newsletter</p>
          <h1 className="mt-2 text-3xl font-black">{status === "success" ? "Unsubscribed" : status === "error" ? "Link needs attention" : "Working on it"}</h1>
        </div>
        <p className="text-neutral-600 dark:text-neutral-300">{message}</p>
        <div className="flex justify-center gap-3">
          <Link className="btn-primary" to="/shop">Continue shopping</Link>
          <Link className="btn-secondary" to="/">Back home</Link>
        </div>
      </div>
    </section>
  );
}
