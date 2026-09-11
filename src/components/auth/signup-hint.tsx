import { useEffect, useState } from "react";
import { kvGet, kvSet } from "@/lib/game/persist";

const KEY = "hone.signupHintDismissed";

export function SignupHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (kvGet(KEY) === "1") return;
    const t = window.setTimeout(() => setOpen(true), 480);
    return () => window.clearTimeout(t);
  }, []);

  function dismiss() {
    kvSet(KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="signup-hint" role="status">
      <p className="signup-hint-copy">Sign up to save your progress</p>
      <button
        type="button"
        className="signup-hint-dismiss"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
