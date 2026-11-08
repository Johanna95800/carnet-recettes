"use client";

import { useEffect, useState } from "react";

const KEY = "carnet.portions-habituelles";

function read(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Nombre de personnes pour lequel on cuisine habituellement (mémorisé sur cet appareil). */
export function usePreferredServings() {
  const [value, setValue] = useState<number | null>(null);
  useEffect(() => setValue(read()), []);
  const save = (v: number | null) => {
    setValue(v);
    try {
      if (v) localStorage.setItem(KEY, String(v));
      else localStorage.removeItem(KEY);
    } catch {
      /* stockage indisponible : réglage valable pour cette visite seulement */
    }
  };
  return [value, save] as const;
}
