"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

const RATIOS = [
  { label: "4:3", value: 4 / 3 },
  { label: "Carré", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality = 0.86) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/jpeg", quality));
}

/** Tourne l'image d'un quart de tour (sens horaire si dir = 1). */
async function rotateQuarter(src: string, dir: 1 | -1) {
  const img = await loadImage(src);
  const c = document.createElement("canvas");
  c.width = img.naturalHeight;
  c.height = img.naturalWidth;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return URL.createObjectURL(await toBlob(c, 0.95));
}

async function cropToBlob(src: string, area: Area, maxSide = 2000) {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(area.width, area.height));
  const c = document.createElement("canvas");
  c.width = Math.round(area.width * scale);
  c.height = Math.round(area.height * scale);
  c.getContext("2d")!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, c.width, c.height);
  return toBlob(c);
}

/** Éditeur plein écran : rotation par quart de tour, recadrage et zoom. */
export function PhotoEditor({ load, onSave, onClose }: {
  load: () => Promise<Blob>;
  onSave: (blob: Blob) => Promise<void>;
  onClose: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<number>(4 / 3);
  const [aspect, setAspect] = useState<number | "original">(4 / 3);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    load().then((b) => { url = URL.createObjectURL(b); setSrc(url); });
    document.body.style.overflow = "hidden";
    return () => { if (url) URL.revokeObjectURL(url); document.body.style.overflow = ""; };
  }, [load]);

  useEffect(() => {
    if (src) loadImage(src).then((i) => setNatural(i.naturalWidth / i.naturalHeight));
  }, [src]);

  async function rotate(dir: 1 | -1) {
    if (!src) return;
    setBusy(true);
    setSrc(await rotateQuarter(src, dir));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setBusy(false);
  }

  async function save() {
    if (!src || !area) return;
    setBusy(true);
    try {
      await onSave(await cropToBlob(src, area));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal>
      <div className="flex items-center justify-between px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <button className="rounded-lg px-3 py-2" onClick={onClose} disabled={busy}>Annuler</button>
        <span className="font-semibold">Retoucher la photo</span>
        <button className="rounded-lg bg-tomate px-4 py-2 font-medium text-sur-tomate disabled:opacity-50" onClick={save} disabled={busy || !area}>
          {busy ? "…" : "OK"}
        </button>
      </div>
      <div className="relative flex-1">
        {src ? (
          <Cropper image={src} crop={crop} zoom={zoom} maxZoom={5}
            aspect={aspect === "original" ? natural : aspect}
            onCropChange={setCrop} onZoomChange={setZoom}
            onCropComplete={(_, px) => setArea(px)} />
        ) : <p className="p-6 text-center text-white/70">Chargement…</p>}
      </div>
      <div className="space-y-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <input type="range" min={1} max={5} step={0.01} value={zoom} aria-label="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-[var(--color-tomate)]" />
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <button className="rounded-full bg-white/15 px-3 py-1.5" onClick={() => rotate(-1)} disabled={busy} aria-label="Tourner à gauche">↺</button>
          <button className="rounded-full bg-white/15 px-3 py-1.5" onClick={() => rotate(1)} disabled={busy} aria-label="Tourner à droite">↻</button>
          <span className="mx-1 h-5 w-px bg-white/30" />
          {[...RATIOS, { label: "Original", value: "original" as const }].map((r) => (
            <button key={r.label} onClick={() => setAspect(r.value)}
              className={`rounded-full px-3 py-1.5 ${aspect === r.value ? "bg-white text-black" : "bg-white/15"}`}>{r.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
