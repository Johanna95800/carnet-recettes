"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/durations";

type Timer = { id: string; label: string; total: number; endsAt: number | null; remaining: number; rang: boolean };
type Ctx = { start: (label: string, minutes: number) => void };

const TimerContext = createContext<Ctx>({ start: () => {} });
export const useTimers = () => useContext(TimerContext);

const KEY = "carnet.minuteurs";

/** Bip répété jusqu'à ce qu'on arrête l'alarme (Web Audio : pas de fichier son à charger). */
function useAlarm() {
  const ctx = useRef<AudioContext | null>(null);
  const loop = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlock = () => {
    try {
      ctx.current ??= new AudioContext();
      if (ctx.current.state === "suspended") ctx.current.resume();
    } catch { /* audio indisponible */ }
  };
  const beep = () => {
    const ac = ctx.current;
    if (!ac) return;
    [0, 0.25, 0.5].forEach((t) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.2);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.2);
    });
  };
  const ring = () => {
    if (loop.current) return;
    beep();
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    loop.current = setInterval(() => { beep(); navigator.vibrate?.([300, 150, 300]); }, 2000);
  };
  const stop = () => {
    if (loop.current) clearInterval(loop.current);
    loop.current = null;
  };
  return { unlock, ring, stop };
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const alarm = useAlarm();

  // reprise après rechargement de la page
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Timer[];
      if (Array.isArray(saved)) setTimers(saved);
    } catch { /* rien à reprendre */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(timers)); } catch { /* stockage indisponible */ }
  }, [timers]);

  useEffect(() => {
    if (!timers.some((t) => t.endsAt)) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timers]);

  // déclenchement des alarmes
  useEffect(() => {
    const done = timers.filter((t) => t.endsAt && t.endsAt <= now && !t.rang);
    if (!done.length) return;
    setTimers((ts) => ts.map((t) => (done.some((d) => d.id === t.id) ? { ...t, rang: true, endsAt: null, remaining: 0 } : t)));
    alarm.ring();
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        done.forEach((t) => new Notification("⏰ Minuteur terminé", { body: t.label }));
      }
    } catch { /* notifications indisponibles */ }
  }, [now, timers, alarm]);

  const start = useCallback((label: string, minutes: number) => {
    alarm.unlock();
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } catch { /* ignoré */ }
    const total = Math.round(minutes * 60_000);
    setTimers((ts) => [...ts, { id: crypto.randomUUID(), label, total, endsAt: Date.now() + total, remaining: total, rang: false }]);
  }, [alarm]);

  const update = (id: string, f: (t: Timer) => Timer | null) =>
    setTimers((ts) => ts.flatMap((t) => (t.id === id ? (f(t) ? [f(t)!] : []) : [t])));

  const ringing = timers.some((t) => t.rang);
  useEffect(() => { if (!ringing) alarm.stop(); }, [ringing, alarm]);

  return (
    <TimerContext.Provider value={{ start }}>
      {children}
      {timers.length > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm space-y-2 md:bottom-24 md:left-auto md:right-6">
          {timers.map((t) => {
            const left = t.endsAt ? t.endsAt - now : t.remaining;
            return (
              <div key={t.id} className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-lg ${t.rang ? "animate-pulse bg-tomate text-sur-tomate" : "bg-encre text-creme"}`}>
                <span className="text-xl">{t.rang ? "⏰" : "⏱"}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs opacity-80">{t.label}</div>
                  <div className="font-mono text-xl font-semibold tabular-nums">{t.rang ? "Terminé !" : formatClock(left)}</div>
                </div>
                {t.rang ? (
                  <button className="rounded-xl bg-white/20 px-3 py-2 font-semibold" onClick={() => update(t.id, () => null)}>OK</button>
                ) : (
                  <>
                    <button className="rounded-lg px-2 py-1 text-sm" aria-label="Ajouter une minute"
                      onClick={() => update(t.id, (x) => (x.endsAt ? { ...x, endsAt: x.endsAt + 60_000 } : { ...x, remaining: x.remaining + 60_000 }))}>+1</button>
                    <button className="rounded-lg px-2 py-1 text-lg" aria-label={t.endsAt ? "Pause" : "Reprendre"}
                      onClick={() => update(t.id, (x) => (x.endsAt ? { ...x, remaining: x.endsAt - Date.now(), endsAt: null } : { ...x, endsAt: Date.now() + x.remaining }))}>
                      {t.endsAt ? "⏸" : "▶️"}
                    </button>
                    <button className="rounded-lg px-2 py-1" aria-label="Annuler" onClick={() => update(t.id, () => null)}>✕</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </TimerContext.Provider>
  );
}
