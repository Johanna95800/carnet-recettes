"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

/** Diaporama de la page recette : glisser, miniatures, plein écran. */
export function PhotoGallery({ urls }: { urls: string[] }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState<number | null>(null);

  const goTo = (i: number) => {
    const el = strip.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = strip.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (!urls.length) return null;
  const many = urls.length > 1;

  return (
    <div className="md:mt-4">
      <div className="relative">
        <div ref={strip} onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] md:rounded-2xl [&::-webkit-scrollbar]:hidden">
          {urls.map((u, i) => (
            <button key={u} onClick={() => setFull(i)} aria-label={`Agrandir la photo ${i + 1}`}
              className="relative aspect-[4/3] max-h-[65vh] w-full shrink-0 snap-center overflow-hidden bg-encre/10">
              {/* fond flou de la même photo : une page en portrait reste entière et jolie */}
              <img src={u} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
              <img src={u} alt="" className="relative h-full w-full object-contain" />
            </button>
          ))}
        </div>
        {many && (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-medium text-white">
              {index + 1} / {urls.length}
            </span>
            {index > 0 && <Arrow dir="prev" onClick={() => goTo(index - 1)} />}
            {index < urls.length - 1 && <Arrow dir="next" onClick={() => goTo(index + 1)} />}
          </>
        )}
      </div>
      {many && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 md:px-0">
          {urls.map((u, i) => (
            <button key={u} onClick={() => goTo(i)} aria-label={`Photo ${i + 1}`}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-tomate" : "border-transparent opacity-70"}`}>
              <img src={u} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {full != null && <Lightbox urls={urls} start={full} onClose={() => setFull(null)} />}
    </div>
  );
}

function Arrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={dir === "prev" ? "Photo précédente" : "Photo suivante"}
      className={`absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-xl text-white md:flex ${dir === "prev" ? "left-3" : "right-3"}`}>
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}

function Lightbox({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
      if (e.key === "ArrowRight") setI((v) => Math.min(urls.length - 1, v + 1));
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [onClose, urls.length]);

  let startX: number | null = null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" role="dialog" aria-modal
      onTouchStart={(e) => { startX = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (startX == null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (dx > 50) setI((v) => Math.max(0, v - 1));
        if (dx < -50) setI((v) => Math.min(urls.length - 1, v + 1));
      }}>
      <img src={urls[i]} alt="" className="max-h-full max-w-full object-contain" />
      <button onClick={onClose} aria-label="Fermer"
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] h-10 w-10 rounded-full bg-white/15 text-xl text-white">✕</button>
      {urls.length > 1 && (
        <>
          <span className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] text-sm text-white/80">{i + 1} / {urls.length}</span>
          {i > 0 && <button onClick={() => setI(i - 1)} aria-label="Précédente" className="absolute left-2 h-12 w-12 rounded-full bg-white/15 text-2xl text-white">‹</button>}
          {i < urls.length - 1 && <button onClick={() => setI(i + 1)} aria-label="Suivante" className="absolute right-2 h-12 w-12 rounded-full bg-white/15 text-2xl text-white">›</button>}
        </>
      )}
    </div>
  );
}
