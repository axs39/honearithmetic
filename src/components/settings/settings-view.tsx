import { Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getSocialStatus,
  setDisplayName,
  setPrivacy,
  updateTraineeName,
  type SocialStatus,
} from "@/lib/game/leaderboard";
import { writePendingDisplayName, writeTraineeName } from "@/lib/game/trainee";
import { clientTimeZone, pushLeaderboardScoresOnce } from "@/lib/game/sync-social";
import { cn } from "@/lib/utils";

type Tab = "general" | "privacy";

const canChangePassword =
  typeof (authClient as { changePassword?: unknown }).changePassword ===
  "function";

export function SettingsView() {
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [tab, setTab] = useState<Tab>("general");
  const [social, setSocial] = useState<SocialStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refresh() {
    try {
      const s = await getSocialStatus({ data: { timeZone: clientTimeZone() } });
      setSocial(s);
      setLoadError(null);
    } catch {
      setLoadError("Could not load settings.");
    }
  }

  useEffect(() => {
    if (isPending || !signedIn) return;
    pushLeaderboardScoresOnce();
    void refresh();
  }, [signedIn, isPending]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl pt-2">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Trainee name is what Hone calls you. Display name is public on the
          leaderboard only.
        </p>

        {isPending ? (
          <p className="mt-8 text-sm text-muted">Loading…</p>
        ) : !signedIn ? (
          <section className="mt-8 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted">
              Sign in to manage your name, display name, and privacy.
            </p>
            <Button asChild className="mt-4" size="lg">
              <Link to="/login">Sign in</Link>
            </Button>
          </section>
        ) : (
          <>
            <div className="mt-6 flex gap-1 rounded-lg bg-surface p-1 shadow-[var(--shadow-border)]">
              <TabButton
                active={tab === "general"}
                onClick={() => setTab("general")}
              >
                General
              </TabButton>
              <TabButton
                active={tab === "privacy"}
                onClick={() => setTab("privacy")}
              >
                Privacy
              </TabButton>
            </div>

            {loadError ? (
              <p className="mt-4 text-sm text-terra">{loadError}</p>
            ) : null}

            {tab === "general" ? (
              <GeneralPanel social={social} onSaved={refresh} />
            ) : (
              <PrivacyPanel social={social} onSaved={refresh} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md px-3 py-2 text-sm transition-colors",
        active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function GeneralPanel({
  social,
  onSaved,
}: {
  social: SocialStatus | null;
  onSaved: () => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayNameVal] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => {
    if (!social) return;
    setUsername(social.username === "player" ? "" : social.username);
    setDisplayNameVal(social.displayName ?? "");
  }, [social]);

  async function saveNames(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const nameRes = await updateTraineeName({ data: { username } });
      if (!nameRes.ok) {
        setErr(
          nameRes.reason === "taken"
            ? "That trainee name is taken."
            : "Enter a trainee name.",
        );
        return;
      }
      writeTraineeName(nameRes.username);

      if (displayName.trim()) {
        const dnRes = await setDisplayName({
          data: { displayName: displayName.trim() },
        });
        if (!dnRes.ok) {
          if (dnRes.reason === "taken") setErr("That display name is taken.");
          else if (dnRes.reason === "cooldown")
            setErr(
              "Display names can change once every 3 months. " +
                (dnRes.nextAt
                  ? `Next change after ${new Date(dnRes.nextAt).toLocaleDateString()}.`
                  : ""),
            );
          else if (dnRes.reason === "short")
            setErr("Display name needs at least 2 characters.");
          else setErr("Could not save display name.");
          return;
        }
        writePendingDisplayName(dnRes.displayName);
      }
      setMsg("Saved.");
      await onSaved();
    } catch {
      setErr("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (!canChangePassword) return;
    try {
      const changePassword = (
        authClient as {
          changePassword: (args: {
            currentPassword: string;
            newPassword: string;
            revokeOtherSessions?: boolean;
          }) => Promise<{ error?: { message?: string } | null }>;
        }
      ).changePassword;
      const { error } = await changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (error) {
        setPwErr(error.message ?? "Could not change password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPwMsg("Password updated.");
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : "Could not change password.");
    }
  }

  const cooldownNote =
    social && !social.canChangeDisplayName && social.nextDisplayNameChangeAt
      ? `Display name locked until ${new Date(social.nextDisplayNameChangeAt).toLocaleDateString()}.`
      : null;

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          Names
        </h2>
        <form className="mt-4 space-y-4" onSubmit={(e) => void saveNames(e)}>
          <div>
            <Label htmlFor="settings-username">Trainee name</Label>
            <Input
              id="settings-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 h-11 font-sans normal-nums"
              maxLength={32}
              placeholder="What Hone calls you"
            />
          </div>
          <div>
            <Label htmlFor="settings-display">Display name</Label>
            <Input
              id="settings-display"
              value={displayName}
              onChange={(e) => setDisplayNameVal(e.target.value)}
              className="mt-1 h-11 font-sans normal-nums"
              maxLength={32}
              disabled={Boolean(social && !social.canChangeDisplayName)}
              placeholder="Public on the leaderboard"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Display names can be changed once every 3 months. Pick carefully —
              this is how you appear on the board.
            </p>
            {cooldownNote ? (
              <p className="mt-1 text-xs text-terra">{cooldownNote}</p>
            ) : null}
          </div>
          {err ? <p className="text-sm text-terra">{err}</p> : null}
          {msg ? <p className="text-sm text-muted">{msg}</p> : null}
          <Button type="submit" disabled={busy || !social}>
            {busy ? "Saving…" : "Save names"}
          </Button>
        </form>
      </section>

      <section className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          Password
        </h2>
        {social?.signedInWith?.length && !social.hasPassword ? (
          <p className="mt-3 text-sm text-muted">
            Signed in with {social.signedInWith.join(", ")}. Password is managed
            via your sign-in provider.
          </p>
        ) : !social?.hasPassword || !canChangePassword ? (
          <p className="mt-3 text-sm text-muted">
            Password managed via sign-in provider — change unavailable here.
          </p>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={(e) => void savePassword(e)}>
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 h-11 font-sans normal-nums"
                required
              />
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 h-11 font-sans normal-nums"
                minLength={8}
                required
              />
            </div>
            {pwErr ? <p className="text-sm text-terra">{pwErr}</p> : null}
            {pwMsg ? <p className="text-sm text-muted">{pwMsg}</p> : null}
            <Button type="submit" variant="secondary">
              Update password
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

function PrivacyPanel({
  social,
  onSaved,
}: {
  social: SocialStatus | null;
  onSaved: () => Promise<void>;
}) {
  const [hide, setHide] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (social) setHide(social.hideFromLeaderboard);
  }, [social]);

  async function toggle(next: boolean) {
    setHide(next);
    setBusy(true);
    setMsg(null);
    try {
      await setPrivacy({ data: { hideFromLeaderboard: next } });
      setMsg(next ? "Hidden from leaderboard." : "Visible on leaderboard.");
      await onSaved();
    } catch {
      setHide(!next);
      setMsg("Could not update privacy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
        Leaderboard privacy
      </h2>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-fg">Hide me from the leaderboard</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Off by default. When on, your row is omitted; you can still view the
            board.
          </p>
        </div>
        <Switch
          checked={hide}
          onCheckedChange={(v) => void toggle(v)}
          disabled={!social || busy}
          aria-label="Hide from leaderboard"
        />
      </div>
      {msg ? <p className="mt-3 text-sm text-muted">{msg}</p> : null}
    </section>
  );
}
