import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  normalizeUsername,
  usernameToEmail,
  validatePassword,
  validateUsername,
} from "@/lib/game/account";
import { completeIntro, readTraineeName, writeTraineeName } from "@/lib/game/trainee";
import { endGuestSession } from "@/lib/game/identity";
import { usernameAvailable, saveProfile } from "@/lib/game/profile";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

type Mode = "signup" | "signin";

function Login() {
  const { user } = useCurrentUserState();

  if (user) return <Navigate to="/" />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg px-6 text-fg">
      <header className="flex h-14 shrink-0 items-center justify-between">
        <Link
          to="/"
          className="flex h-11 items-center text-sm text-muted hover:text-fg"
        >
          Back
        </Link>
        <span className="font-display text-lg italic tracking-tight">Hone</span>
        <span className="w-16" />
      </header>
      <div className="flex flex-1 flex-col pb-10">
        <Account />
      </div>
    </main>
  );
}

function Account() {
  const navigate = useNavigate();
  const { isPending } = useCurrentUserState();
  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const n = readTraineeName().replace(/\s+/g, "").toLowerCase();
    if (n) setUsername(n);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const uErr = validateUsername(username);
    if (uErr) {
      setError(uErr);
      return;
    }
    const pErr = validatePassword(password);
    if (pErr) {
      setError(pErr);
      return;
    }
    if (!authEnabled) {
      setError("Sign-in is disabled.");
      return;
    }
    setBusy(true);
    setError(null);
    const name = normalizeUsername(username);
    const email = usernameToEmail(name);
    try {
      try {
        await authClient.signOut();
      } catch {
        /* no prior session */
      }
      if (mode === "signup") {
        const free = await usernameAvailable({ data: { username: name } });
        if (!free) {
          throw new Error("That username is taken.");
        }
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name,
        });
        if (err) throw new Error(err.message || "Could not create account.");
        try {
          await authClient.getSession();
        } catch {
          /* session store recovers */
        }
        const saved = await saveProfile({
          data: {
            saveJson: "{}",
            username: name,
            onboarded: true,
            requireUsername: true,
          },
        });
        if (saved && saved.ok === false) {
          throw new Error("That username is taken.");
        }
        writeTraineeName(name);
        completeIntro(name);
      } else {
        const { error: err } = await authClient.signIn.email({
          email,
          password,
        });
        if (err) throw new Error(err.message || "Could not sign in.");
      }
      try {
        await authClient.getSession();
      } catch {
        /* session store recovers */
      }
      endGuestSession();
      void navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col pt-6">
      <h1 className="font-display text-3xl tracking-tight">
        {mode === "signup" ? "Lock in your progress" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {mode === "signup"
          ? "One tap with Google or X. Or a username. After that, every round and heatmap follows you."
          : "Sign in and pick up the facts you already trained."}
      </p>

      {authEnabled && !isPending ? (
        <div className="mt-8 flex flex-col gap-2">
          {GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => {
                void signIn(p.providerId, { callbackURL: "/" });
              }}
            >
              Continue with {p.label}
            </Button>
          ))}
        </div>
      ) : null}

      <p className="mt-8 mb-3 text-center text-xs tracking-wide text-subtle uppercase">
        Or a username
      </p>

      <form
        className="space-y-4"
        method="post"
        action="#"
        onSubmit={(e) => void submit(e)}
      >
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 h-12 font-sans normal-nums"
            placeholder="at least 3 characters"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 h-12 font-sans normal-nums"
            placeholder="at least 8 characters"
            required
          />
        </div>
        {error ? <p className="text-sm text-terra">{error}</p> : null}
        <Button
          size="xl"
          className="w-full"
          type="submit"
          disabled={busy || isPending}
        >
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      <button
        type="button"
        className="mt-4 flex h-11 w-full items-center justify-center text-sm text-muted hover:text-fg"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError(null);
        }}
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "Need an account? Create one"}
      </button>

      <Link
        to="/"
        className="mt-8 flex h-11 items-center justify-center text-sm text-muted hover:text-fg"
      >
        Continue without an account
      </Link>
    </div>
  );
}
