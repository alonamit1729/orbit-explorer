import { useState } from "react";

interface Props {
  initial: string;
  maxPeriod: number;
  preperiodicDepth: number;
  busy: boolean;
  onSubmit: (polynomial: string, maxPeriod: number, depth: number) => void;
}

export function PolynomialInput({
  initial,
  maxPeriod,
  preperiodicDepth,
  busy,
  onSubmit,
}: Props) {
  const [text, setText] = useState(initial);
  const [n, setN] = useState(maxPeriod);
  const [d, setD] = useState(preperiodicDepth);

  function handle(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(text.trim(), n, d);
  }

  return (
    <form className="controls" onSubmit={handle}>
      <label>
        polynomial f(x)
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. x^2 - 29/16"
          spellCheck={false}
          autoFocus
        />
      </label>
      <label>
        max period
        <input
          type="number"
          min={1}
          max={12}
          value={n}
          onChange={(e) => setN(parseInt(e.target.value || "1", 10))}
        />
      </label>
      <label>
        pre-periodic depth
        <input
          type="number"
          min={0}
          max={10}
          value={d}
          onChange={(e) => setD(parseInt(e.target.value || "0", 10))}
        />
      </label>
      <button type="submit" disabled={busy || !text.trim()}>
        {busy ? "analyzing…" : "analyze"}
      </button>
    </form>
  );
}
