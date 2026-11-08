"use client";

import { useEffect, useState } from "react";

export function ServingsStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.round(Number(raw.replace(",", ".")));
    if (n >= 1 && n <= 200) onChange(n);
    else setText(String(value));
  };
  return (
    <div className="flex items-center rounded-xl border border-trait bg-papier">
      <button type="button" className="px-3.5 py-2 text-xl leading-none" aria-label="Moins"
        onClick={() => onChange(Math.max(1, value - 1))}>−</button>
      <input className="w-11 bg-transparent text-center text-lg font-semibold outline-none" inputMode="numeric"
        aria-label={label} value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      <button type="button" className="px-3.5 py-2 text-xl leading-none" aria-label="Plus"
        onClick={() => onChange(Math.min(200, value + 1))}>+</button>
    </div>
  );
}
