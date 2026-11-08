"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Barre d'actions (masquée à l'impression) ; ouvre l'impression une fois les photos chargées. */
export function PrintButton({ auto }: { auto: boolean }) {
  const router = useRouter();
  const print = async () => {
    await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
    window.print();
  };
  useEffect(() => { if (auto) print(); }, [auto]);
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
      <button className="text-sm text-neutral-600" onClick={() => router.back()}>← Retour</button>
      <p className="hidden flex-1 text-sm text-neutral-600 sm:block">Choisissez « Enregistrer en PDF » comme imprimante pour obtenir un fichier.</p>
      <button className="btn-primaire ml-auto" onClick={print}>🖨️ Imprimer / PDF</button>
    </div>
  );
}
