/** Repère les durées dans le texte d'une étape (« 25 min », « 1 h 30 », « 10 à 15 minutes »). */
export type TextPart = { text: string; minutes?: number; scaled?: boolean };

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const RE = new RegExp(
  String.raw`(?<![\d,.])(${NUM})(?:\s*(?:à|-|–|ou)\s*(${NUM}))?\s*(h(?:eures?)?|min(?:utes?)?|mn|sec(?:ondes?)?)(?:\s*(\d{1,2})(?!\s*(?:°|%|g\b|cl\b|ml\b)))?(?![\p{L}])`,
  "giu",
);

const n = (s: string) => Number(s.replace(",", "."));

export function splitDurations(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const unit = m[3].toLowerCase();
    // pour une fourchette (« 10 à 15 min »), on prend la plus courte : on vérifie, puis on prolonge
    const base = n(m[1]);
    let minutes = unit.startsWith("h") ? base * 60 + (m[4] ? n(m[4]) : 0) : unit.startsWith("s") ? base / 60 : base;
    if (!unit.startsWith("h") && m[4]) continue; // « 5 min 3 » : ambigu, on ignore
    minutes = Math.round(minutes * 60) / 60;
    if (minutes <= 0 || minutes > 72 * 60) continue;
    out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], minutes });
    last = m.index! + m[0].length;
  }
  out.push({ text: text.slice(last) });
  return out.filter((p) => p.text);
}

export function formatClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
