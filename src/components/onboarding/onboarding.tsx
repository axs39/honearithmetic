import { useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import {
  completeIntro,
  isIntroDone,
  normalizeDisplayName,
  readIntroStep,
  readPendingDisplayName,
  readTraineeName,
  subscribeIntro,
  writeIntroStep,
  writePendingDisplayName,
  writeTraineeName,
  type IntroStep,
} from "@/lib/game/trainee";
import { cn } from "@/lib/utils";

const STEPS: IntroStep[] = ["hello", "how", "features"];

const HOW = [
  {
    title: "A problem fills the screen",
    body: "Type the answer on the keyboard, or the pad on a phone. Correct answers advance on their own — no flash, no confirm.",
  },
  {
    title: "A miss stays until you fix it",
    body: "Wrong digits stay on screen. Backspace, correct it, keep moving. The clock does not wait.",
  },
  {
    title: "Pick the mix before you start",
    body: "Choose a clock, the four operations, and the exact number ranges — times tables, two-digit products, three-digit adds.",
  },
  {
    title: "The trainer remembers what’s slow",
    body: "Every fact is timed. Adaptive mode weights the ones that lag. Focus mode drills only that cluster until it’s automatic.",
  },
];

const FEATURES = [
  {
    title: "Timed drills",
    body: "Thirty seconds to ten minutes. Score is problems solved. Pace is shown live.",
  },
  {
    title: "Classic, Adaptive, Focus",
    body: "A uniform mix, a mix weighted toward your slow facts, or a round that is almost only the weak cluster.",
  },
  {
    title: "Your numbers",
    body: "Set min and max for each operand. Presets for the desk mix, times tables, two-digit, and wide ranges.",
  },
  {
    title: "Heatmap and progress",
    body: "A map of every multiplication fact, a log of rounds, and the problems that still cost you time.",
  },
  {
    title: "Compare to the desk",
    body: "The 120-second default mix is the interview yardstick. Place your pace next to a working quant trader.",
  },
  {
    title: "Sign in to lock it in",
    body: "This device keeps a copy. An account keeps the same facts if you switch phones or the browser forgets.",
  },
];

export function OnboardingGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const introDone = useSyncExternalStore(
    subscribeIntro,
    isIntroDone,
    () => false,
  );

  if (!introDone && pathname !== "/login") {
    return <Onboarding />;
  }
  return <>{children}</>;
}

function Onboarding() {
  const [step, setStep] = useState<IntroStep>(() => readIntroStep());
  const [name, setName] = useState(() => readTraineeName());
  const [displayName, setDisplayName] = useState(() => readPendingDisplayName());
  const [missedName, setMissedName] = useState(false);
  const [missedDisplay, setMissedDisplay] = useState(false);
  const [showOpen, setShowOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLInputElement>(null);
  const idx = STEPS.indexOf(step);
  const greet = normalizeDisplayName(name);

  useEffect(() => {
    if (!showOpen) return;
    const t = window.setTimeout(() => setShowOpen(false), 880);
    return () => window.clearTimeout(t);
  }, [showOpen]);

  function goTo(next: IntroStep) {
    setStep(next);
    writeIntroStep(next);
  }

  function captureName(): string {
    const typed = normalizeDisplayName(inputRef.current?.value ?? name);
    return typed;
  }

  function captureDisplay(): string {
    return normalizeDisplayName(displayRef.current?.value ?? displayName);
  }

  function goHow() {
    const n = captureName();
    const d = captureDisplay();
    if (!n) {
      setMissedName(true);
      inputRef.current?.focus();
      return;
    }
    if (!d) {
      setMissedDisplay(true);
      displayRef.current?.focus();
      return;
    }
    setMissedName(false);
    setMissedDisplay(false);
    setName(n);
    setDisplayName(d);
    writeTraineeName(n);
    writePendingDisplayName(d);
    goTo("how");
  }

  function skip() {
    const n = captureName() || normalizeDisplayName(name);
    const d = captureDisplay() || normalizeDisplayName(displayName);
    completeIntro(n, d || undefined);
  }

  function finish() {
    const n = normalizeDisplayName(name) || captureName();
    const d = normalizeDisplayName(displayName) || captureDisplay();
    if (!n) {
      goTo("hello");
      setMissedName(true);
      return;
    }
    if (!d) {
      goTo("hello");
      setMissedDisplay(true);
      return;
    }
    completeIntro(n, d);
  }

  return (
    <main className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-bg text-fg">
      {showOpen ? (
        <div className="hello-open" aria-hidden>
          <span className="hello-open-panel hello-open-panel-a" />
          <span className="hello-open-panel hello-open-panel-b" />
          <span className="hello-open-line" />
        </div>
      ) : null}

      <header className="hello-chrome flex h-14 shrink-0 items-center justify-between px-6">
        {step === "hello" ? (
          <span className="w-16" />
        ) : (
          <button
            type="button"
            onClick={() => goTo(step === "features" ? "how" : "hello")}
            className="flex h-11 items-center gap-0.5 text-sm text-muted hover:text-fg"
          >
            <ChevronLeft className="size-4" />
            Back
          </button>
        )}
        <span className="font-display text-lg italic tracking-tight">Hone</span>
        <span className="w-16" />
      </header>

      {step === "hello" ? (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-hidden px-6">
          <HelloBody
            name={name}
            displayName={displayName}
            missed={missedName}
            missedDisplay={missedDisplay}
            inputRef={inputRef}
            displayRef={displayRef}
            onChange={(v) => {
              setName(v);
              if (v) setMissedName(false);
            }}
            onDisplayChange={(v) => {
              setDisplayName(v);
              if (v) setMissedDisplay(false);
            }}
            onSubmit={goHow}
          />
          <Footer onSkip={skip}>
            <Button
              size="xl"
              className="w-full"
              type="button"
              onClick={goHow}
            >
              Continue
            </Button>
            <Dots index={idx} />
          </Footer>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-hidden px-6">
          {step === "how" ? <HowBody greet={greet} /> : null}
          {step === "features" ? <FeaturesBody greet={greet} /> : null}
          <Footer onSkip={skip}>
            {step === "how" ? (
              <Button
                size="xl"
                className="w-full"
                type="button"
                onClick={() => goTo("features")}
              >
                Recap the features
              </Button>
            ) : (
              <Button size="xl" className="w-full" type="button" onClick={finish}>
                Start training
              </Button>
            )}
            <Dots index={idx} />
          </Footer>
        </div>
      )}
    </main>
  );
}

function Footer({
  children,
  className,
  onSkip,
}: {
  children: ReactNode;
  className?: string;
  onSkip: () => void;
}) {
  return (
    <div className={cn("relative z-10 shrink-0 pt-4 pb-24", className)}>
      {children}
      <button
        type="button"
        onClick={onSkip}
        className="mx-auto mt-1 flex h-10 w-full items-center justify-center text-[10px] tracking-[0.18em] text-subtle uppercase hover:text-muted"
      >
        Skip
      </button>
    </div>
  );
}

function HelloBody({
  name,
  displayName,
  missed,
  missedDisplay,
  inputRef,
  displayRef,
  onChange,
  onDisplayChange,
  onSubmit,
}: {
  name: string;
  displayName: string;
  missed: boolean;
  missedDisplay: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  displayRef: RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
  onDisplayChange: (v: string) => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 560);
    return () => window.clearTimeout(t);
  }, [inputRef]);

  useEffect(() => {
    if (missed) inputRef.current?.focus();
    else if (missedDisplay) displayRef.current?.focus();
  }, [missed, missedDisplay, inputRef, displayRef]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="hello-enter flex flex-1 flex-col justify-center">
      <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
        Quant arithmetic
      </p>
      <h1 className="hello-title mt-5 font-display text-5xl leading-none font-medium tracking-tight sm:text-6xl">
        Hello
      </h1>
      <div className={cn("name-field-wrap mt-8", missed && "name-field-miss")}>
        <label htmlFor="trainee-name" className="sr-only">
          Your name
        </label>
        <input
          id="trainee-name"
          ref={inputRef}
          value={name}
          onChange={(e) => onChange(e.target.value)}
          onInput={(e) => onChange(e.currentTarget.value)}
          onKeyDown={onKey}
          placeholder="your name"
          maxLength={32}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="next"
          className="name-field"
        />
      </div>
      <div
        className={cn(
          "name-field-wrap mt-4",
          missedDisplay && "name-field-miss",
        )}
      >
        <label htmlFor="display-name" className="sr-only">
          Display name
        </label>
        <input
          id="display-name"
          ref={displayRef}
          value={displayName}
          onChange={(e) => onDisplayChange(e.target.value)}
          onInput={(e) => onDisplayChange(e.currentTarget.value)}
          onKeyDown={onKey}
          placeholder="display name"
          maxLength={32}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="done"
          className="name-field"
        />
      </div>
      <p className="mt-4 text-sm text-muted">
        {missed
          ? "Type your name to continue."
          : missedDisplay
            ? "Add a display name for the leaderboard."
            : "Your name is what Hone calls you. Display name is public on the leaderboard."}
      </p>
    </div>
  );
}

function HowBody({ greet }: { greet: string }) {
  return (
    <div className="stagger-in flex-1 overflow-y-auto pt-2">
      {greet ? (
        <p className="font-display text-xl italic tracking-tight text-muted">
          Hello, {greet}.
        </p>
      ) : null}
      <h1 className="mt-2 font-display text-3xl tracking-tight">How to train</h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
        Mental arithmetic at desk pace. Four things to know before the first
        clock.
      </p>
      <ol className="space-y-4 pb-4">
        {HOW.map((item, i) => (
          <li key={item.title} className="flex gap-4">
            <span className="font-mono w-6 shrink-0 text-sm tabular-nums text-subtle">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="text-sm font-medium text-fg">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FeaturesBody({ greet }: { greet: string }) {
  return (
    <div className="stagger-in flex-1 overflow-y-auto pt-2">
      {greet ? (
        <p className="font-display text-xl italic tracking-tight text-muted">
          Ready, {greet}.
        </p>
      ) : null}
      <h1 className="mt-2 font-display text-3xl tracking-tight">What’s inside</h1>
      <p className="mt-2 mb-6 text-sm leading-relaxed text-muted">
        Built for quant interview arithmetic — speed, ranges, and a memory of
        the facts that lag.
      </p>
      <ul className="space-y-4 pb-4">
        {FEATURES.map((item, i) => (
          <li key={item.title} className="flex gap-4">
            <span className="font-mono w-6 shrink-0 text-sm tabular-nums text-subtle">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="text-sm font-medium text-fg">{item.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dots({ index }: { index: number }) {
  return (
    <div className="flex items-center justify-center gap-2 pt-5" aria-hidden>
      {STEPS.map((s, i) => (
        <span
          key={s}
          className={cn(
            "block h-1.5 rounded-full transition-[width,background-color] duration-200",
            i === index ? "w-5 bg-fg" : "w-1.5 bg-subtle",
          )}
        />
      ))}
    </div>
  );
}
