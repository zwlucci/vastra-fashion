import { Edit3, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import { roleLabel } from "../utils/format.js";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function profileFromUser(user) {
  return {
    name: user?.name || "",
    phoneNumber: user?.phoneNumber || "",
    dateOfBirth: user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : "",
    brandName: user?.brandName || "",
    brandDescription: user?.brandDescription || "",
    profileImageData: ""
  };
}

function Detail({ label, children }) {
  return <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 break-words font-semibold">{children || "Not provided"}</p></div>;
}

function NewsletterPreference() {
  const { showNotice } = useNotification();
  const [enabled, setEnabled] = useState(null);
  const [saving, setSaving] = useState(false);
  const loading = enabled === null;

  useEffect(() => {
    let active = true;
    api.get("/newsletter/preference")
      .then(({ data }) => {
        if (active) setEnabled(Boolean(data.newsletterEnabled));
      })
      .catch(() => {
        if (active) {
          setEnabled(false);
          showNotice("Unable to load your newsletter preference.", "error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function togglePreference() {
    if (loading || saving) return;
    const previous = enabled;
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const { data } = await api.patch("/newsletter/preference", { enabled: next });
      setEnabled(Boolean(data.newsletterEnabled));
      showNotice(data.message || (data.newsletterEnabled ? "Newsletter emails enabled." : "Newsletter emails disabled."));
    } catch {
      setEnabled(previous);
      showNotice("Unable to update your newsletter subscription. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">Email preferences</h2>
          <p className="mt-1 text-sm font-semibold">Receive newsletter emails</p>
          <p className="text-sm text-neutral-500">Get promotional offers, new arrivals, and other VASTRA updates by email.</p>
        </div>
        <button
          aria-checked={Boolean(enabled)}
          aria-label="Receive newsletter emails"
          className={`relative h-8 w-14 rounded-full border-2 transition focus:outline-none focus:ring-2 focus:ring-clay focus:ring-offset-2 dark:focus:ring-offset-neutral-950 ${enabled ? "border-clay bg-clay" : "border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"} ${loading || saving ? "cursor-not-allowed opacity-60" : ""}`}
          disabled={loading || saving}
          onClick={togglePreference}
          role="switch"
          type="button"
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-7" : "left-1"}`} />
        </button>
      </div>
      <p className="text-xs font-semibold text-neutral-500">{loading ? "Loading newsletter preference..." : saving ? "Saving preference..." : enabled ? "Newsletter emails are on." : "Newsletter emails are off."}</p>
    </section>
  );
}

export function Account() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [editing, setEditing] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && !editing) setProfile(profileFromUser(user));
  }, [user, editing]);

  if (!user) {
    return <section className="mx-auto max-w-3xl px-4 py-12"><div className="panel space-y-4 text-center"><h1 className="text-3xl font-black">Your profile</h1><p className="text-neutral-500">Login or register to view your profile and order history.</p><div className="flex justify-center gap-3"><Link className="btn-primary" to="/login">Login</Link><Link className="btn-secondary" to="/register">Register</Link></div></div></section>;
  }

  function beginEditing() {
    setProfile(profileFromUser(user));
    setMessage("");
    setError("");
    setEditing(true);
  }

  function cancelEditing() {
    setProfile(profileFromUser(user));
    setEditing(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function saveProfile(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const payload = {
        name: profile.name,
        phoneNumber: profile.phoneNumber,
        dateOfBirth: profile.dateOfBirth
      };
      if (profile.profileImageData) payload.profileImageData = profile.profileImageData;
      if (user.role === "vendor") {
        payload.brandName = profile.brandName;
        payload.brandDescription = profile.brandDescription;
      }
      const updatedUser = await updateProfile(payload);
      setProfile(profileFromUser(updatedUser));
      setEditing(false);
      setMessage("Profile updated.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await updateProfile(passwords);
      setPasswords({ currentPassword: "", newPassword: "" });
      setMessage("Password changed.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleProfileImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) {
      setError("Choose a JPG, PNG, WEBP, or GIF smaller than 3MB.");
      event.target.value = "";
      return;
    }
    const imageData = await readFileAsDataUrl(file);
    setProfile((current) => ({ ...current, profileImageData: imageData }));
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-clay/15 to-transparent p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4"><UserAvatar user={user} preview={profile.profileImageData} size="xl" className="shadow-soft" /><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Profile</p><h1 className="text-4xl font-black">{user.name}</h1><p className="text-sm text-neutral-500 dark:text-neutral-400">{roleLabel(user.role)}</p></div></div>
        {!editing && <button className="btn-primary" onClick={beginEditing} type="button"><Edit3 size={17} /> Edit Profile</button>}
      </div>

      {(message || error) && <p className={`rounded-md p-3 text-sm ${error ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"}`}>{error || message}</p>}

      {!editing ? (
        <div className="panel space-y-5">
          <div><h2 className="text-2xl font-black">Profile details</h2><p className="text-sm text-neutral-500">Your saved personal and account information.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Display name">{user.name}</Detail><Detail label="Email">{user.email}</Detail><Detail label="Role">{roleLabel(user.role)}</Detail><Detail label="Phone number">{user.phoneNumber}</Detail><Detail label="Date of birth">{user.dateOfBirth ? new Date(`${String(user.dateOfBirth).slice(0, 10)}T00:00:00`).toLocaleDateString() : ""}</Detail>{user.role === "vendor" && <Detail label="Brand name">{user.brandName}</Detail>}</div>
          {user.role === "vendor" && user.brandDescription && <Detail label="Brand description">{user.brandDescription}</Detail>}
        </div>
      ) : (
        <form className="panel space-y-5" onSubmit={saveProfile}>
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black">Edit profile</h2><p className="text-sm text-neutral-500">Changes are saved only when you confirm below.</p></div><button className="btn-secondary h-10 w-10 px-0" onClick={cancelEditing} type="button" title="Cancel editing"><X size={17} /></button></div>
          <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:items-center"><UserAvatar user={user} preview={profile.profileImageData} size="lg" /><label className="flex-1 space-y-1"><span className="text-sm font-semibold">Profile picture</span><input ref={fileInputRef} className="w-full" accept="image/png,image/jpeg,image/webp,image/gif" type="file" onChange={handleProfileImage} /></label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1"><span className="text-sm font-semibold">Display name</span><input className="w-full" required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label className="space-y-1"><span className="text-sm font-semibold">Phone number</span><input className="w-full" type="tel" placeholder="Optional" value={profile.phoneNumber} onChange={(event) => setProfile({ ...profile, phoneNumber: event.target.value })} /></label><label className="space-y-1"><span className="text-sm font-semibold">Date of birth</span><input className="w-full" type="date" max={new Date().toISOString().slice(0, 10)} value={profile.dateOfBirth} onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value })} /></label>{user.role === "vendor" && <label className="space-y-1"><span className="text-sm font-semibold">Brand name</span><input className="w-full" required value={profile.brandName} onChange={(event) => setProfile({ ...profile, brandName: event.target.value })} /></label>}</div>
          {user.role === "vendor" && <label className="block space-y-1"><span className="text-sm font-semibold">Brand description</span><textarea className="w-full resize-none" rows="4" value={profile.brandDescription} onChange={(event) => setProfile({ ...profile, brandDescription: event.target.value })} /></label>}
          <div className="flex flex-wrap gap-3"><button className="btn-primary" type="submit">Save Changes</button><button className="btn-secondary" onClick={cancelEditing} type="button">Cancel</button></div>
        </form>
      )}

      <NewsletterPreference />

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="panel space-y-4" onSubmit={changePassword}><div><h2 className="text-2xl font-black">Password</h2><p className="text-sm text-neutral-500">Keep password changes separate from profile details.</p></div><label className="block space-y-1"><span className="text-sm font-semibold">Current password</span><input className="w-full" required type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label><label className="block space-y-1"><span className="text-sm font-semibold">New password</span><input className="w-full" required minLength="8" type="password" placeholder="At least 8 characters" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label><button className="btn-primary" type="submit">Change password</button></form>
        <div className="panel space-y-4"><div><h2 className="text-2xl font-black">Quick links</h2><p className="text-sm text-neutral-500">Manage shopping activity and your VASTRA workspace.</p></div><div className="flex flex-wrap gap-3"><Link className="btn-secondary" to="/orders">Order History</Link><Link className="btn-secondary" to="/cart">Cart</Link>{user.role === "vendor" && <Link className="btn-secondary" to="/vendor/dashboard">Vendor Dashboard</Link>}{user.role === "admin" && <Link className="btn-primary" to="/admin/dashboard">Admin Dashboard</Link>}</div></div>
      </div>
    </section>
  );
}
