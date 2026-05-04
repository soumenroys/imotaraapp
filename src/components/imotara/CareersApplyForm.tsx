"use client";

import { useRef, useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

function TextInput({
  id,
  label,
  type = "text",
  placeholder,
  required,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-zinc-300">
        {label}
        {required && <span className="ml-1 text-rose-400">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition hover:border-white/20 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

function FileDropZone({
  id,
  label,
  accept,
  required,
  file,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  accept: string;
  required?: boolean;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (files && files[0]) onChange(files[0]);
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-zinc-300">
        {label}
        {required && <span className="ml-1 text-rose-400">*</span>}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`w-full rounded-xl border px-4 py-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
          dragging
            ? "border-indigo-400/60 bg-indigo-500/10"
            : file
            ? "border-indigo-500/30 bg-indigo-500/8"
            : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/6"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {file ? (
          <div className="flex items-center gap-3">
            <span className="text-xl" aria-hidden>
              {file.type.startsWith("image/") ? "🖼️" : "📄"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-zinc-200">{file.name}</p>
              <p className="text-[11px] text-zinc-500">
                {(file.size / 1024).toFixed(0)} KB — click to replace
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1 text-center">
            <span className="text-2xl opacity-50" aria-hidden>📎</span>
            <p className="text-xs text-zinc-400">Click to choose or drag &amp; drop</p>
            <p className="text-[11px] text-zinc-600">{accept.replace(/\./g, "").toUpperCase()} · max 10 MB</p>
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        id={id}
        name={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
    </div>
  );
}

export default function CareersApplyForm() {
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [cv,    setCv]    = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [status,   setStatus]   = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const busy = status === "submitting";
  const canSubmit = name.trim() && email.trim() && cv;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("submitting");
    setErrorMsg("");

    const body = new FormData();
    body.append("name",  name.trim());
    body.append("email", email.trim());
    body.append("cv",    cv);
    if (photo) body.append("photo", photo);

    try {
      const res  = await fetch("/api/careers/apply", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error ?? "Something went wrong. Please try again.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-6 py-8 text-center backdrop-blur-md">
        <p className="text-3xl" aria-hidden>🌸</p>
        <h3 className="mt-3 text-base font-semibold text-zinc-50">
          Application received — thank you, {name.split(" ")[0]}!
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-zinc-400">
          We've sent a confirmation to <span className="text-zinc-300">{email}</span>.
          We'll be in touch if your profile is a great fit. We read every application personally.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <TextInput
        id="name"
        label="Your Name"
        placeholder="e.g. Priya Sharma"
        required
        value={name}
        onChange={setName}
        disabled={busy}
      />

      <TextInput
        id="email"
        label="Email Address"
        type="email"
        placeholder="you@example.com"
        required
        value={email}
        onChange={setEmail}
        disabled={busy}
      />

      <FileDropZone
        id="cv"
        label="Your CV / Résumé"
        accept=".pdf,.doc,.docx"
        required
        file={cv}
        onChange={setCv}
        disabled={busy}
      />

      <FileDropZone
        id="photo"
        label="Passport Photo"
        accept=".jpg,.jpeg,.png,.webp"
        file={photo}
        onChange={setPhoto}
        disabled={busy}
      />

      {status === "error" && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-4 py-2.5 text-xs text-rose-300">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || busy}
        className="w-full rounded-full bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
      >
        {busy ? "Sending…" : "Send Application"}
      </button>

      <p className="text-center text-[11px] text-zinc-600">
        Your files are sent directly to our team and stored nowhere else.
      </p>
    </form>
  );
}
