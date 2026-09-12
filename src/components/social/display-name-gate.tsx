import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSocialStatus, setDisplayName } from "@/lib/game/leaderboard";
import { clientTimeZone } from "@/lib/game/sync-social";
import {
  isIntroDone,
  markDisplayNameGateShown,
  writePendingDisplayName,
} from "@/lib/game/trainee";

/**
 * Blocking once for signed-in users who finished intro but never set a
 * public display name (e.g. OAuth before the field existed).
 */
export function DisplayNameGate() {
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isPending || !signedIn || !isIntroDone()) {
      setOpen(false);
      return;
    }
    let cancelled = false;
    void getSocialStatus({ data: { timeZone: clientTimeZone() } })
      .then((s) => {
        if (cancelled) return;
        if (s.needsDisplayName) {
          setOpen(true);
          markDisplayNameGateShown();
        } else {
          setOpen(false);
        }
      })
      .catch(() => {
        /* ignore — gate is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, isPending]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await setDisplayName({ data: { displayName: value } });
      if (!res.ok) {
        setError(
          res.reason === "taken"
            ? "That display name is taken."
            : res.reason === "short"
              ? "Use at least 2 characters."
              : "Enter a display name.",
        );
        return;
      }
      writePendingDisplayName(res.displayName);
      setOpen(false);
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 px-5 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="display-name-gate-title"
        className="w-full max-w-md rounded-xl bg-surface p-5 shadow-[var(--shadow-border-hover)] sm:p-6"
      >
        <h2
          id="display-name-gate-title"
          className="font-display text-2xl tracking-tight"
        >
          Pick a display name
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This is how you appear on the public leaderboard. You can change it
          once every 3 months — choose carefully.
        </p>
        <form className="mt-5 space-y-3" onSubmit={(e) => void submit(e)}>
          <div>
            <Label htmlFor="gate-display-name">Display name</Label>
            <Input
              id="gate-display-name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 h-11 font-sans normal-nums"
              maxLength={32}
              autoFocus
              required
            />
          </div>
          {error ? <p className="text-sm text-terra">{error}</p> : null}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
