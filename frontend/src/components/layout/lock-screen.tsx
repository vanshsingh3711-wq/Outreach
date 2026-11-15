"use client";

import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { KeyRound, ShieldAlert, Sparkles, Terminal } from "lucide-react";

export function LockScreen() {
  const { isLocked, lockReason, unlockWithToken } = useAuth();
  const [tokenInput, setTokenInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLocked) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError("Please paste your dashboard token.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const ok = await unlockWithToken(tokenInput.trim());
      if (!ok) {
        setError("Invalid token. Please check and try again.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to authenticate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-7 shadow-2xl shadow-sky-500/10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">Outreach Security Gate</h2>
            <p className="text-xs text-slate-400">Strict local token authentication</p>
          </div>
        </div>

        {lockReason && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>{lockReason}</span>
          </div>
        )}

        <div className="mt-4 space-y-2 text-xs leading-relaxed text-slate-400">
          <p>
            Paste the dashboard token from{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-slate-200">
              data/dashboard-token
            </code>
            , or run:
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 font-mono text-sky-400 text-[11px] border border-slate-800">
            <Terminal className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span>outreach dashboard --url</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="token" className="block text-xs font-medium text-slate-300">
              Session Token
            </label>
            <input
              id="token"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste token here..."
              className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              autoFocus
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 cursor-pointer shadow-lg shadow-sky-500/20"
          >
            <Sparkles className="h-4 w-4" />
            {isSubmitting ? "Verifying..." : "Unlock Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}

