const STEPS = [
  {
    title: "A problem appears",
    body: "Type the answer. Correct answers advance on their own — no flash, no shake. A miss stays on screen until you fix it.",
  },
  {
    title: "Every solve is timed",
    body: "Hone records how long each fact takes — 7 × 8, 96 ÷ 8, a two-digit add. Misses and slow answers get remembered.",
  },
  {
    title: "Then it feeds them back",
    body: "Adaptive mode weights the problems you’re slow on. Focus mode drills only that cluster until it’s automatic.",
  },
  {
    title: "Set the numbers you want",
    body: "Choose operations and ranges so the mix matches the desk you’re training for — times tables, two-digit products, three-digit adds.",
  },
];

export function HowItLearns({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={compact ? "space-y-4" : "space-y-5"}>
      {STEPS.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span className="font-mono w-6 shrink-0 text-sm tabular-nums text-subtle">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <p className="text-sm font-medium text-fg">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
