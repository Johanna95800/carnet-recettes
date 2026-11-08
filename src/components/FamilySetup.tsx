"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function FamilySetup({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [familyName, setFamilyName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(fn: "create_family" | "join_family") {
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = fn === "create_family"
      ? await supabase.rpc("create_family", { family_name: familyName.trim(), member_name: name.trim() })
      : await supabase.rpc("join_family", { code: code.trim(), member_name: name.trim() });
    setBusy(false);
    if (error) setError(error.message.includes("inconnu") ? "Ce code d'invitation n'existe pas." : error.message);
    else { router.replace("/"); router.refresh(); }
  }

  return (
    <div className="mt-6 space-y-5">
      <label className="block space-y-1">
        <span className="etiquette">Votre prénom (visible par la famille)</span>
        <input className="champ" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <form className="carte space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); call("join_family"); }}>
        <h2 className="font-semibold">Rejoindre ma famille</h2>
        <input className="champ uppercase tracking-widest" placeholder="Code d'invitation" required
          value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn-primaire w-full" disabled={busy || !name.trim()}>Rejoindre</button>
      </form>
      <form className="carte space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); call("create_family"); }}>
        <h2 className="font-semibold">…ou créer un nouveau carnet</h2>
        <input className="champ" placeholder="ex. Famille Martin" required
          value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
        <button className="btn-secondaire w-full" disabled={busy || !name.trim()}>Créer le carnet</button>
      </form>
      {error && <p className="text-sm text-tomate">{error}</p>}
    </div>
  );
}
