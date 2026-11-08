"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Connexion() {
  const router = useRouter();
  const [mode, setMode] = useState<"connexion" | "inscription">("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    if (mode === "connexion") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ type: "erreur", text: "Email ou mot de passe incorrect." });
      else { router.replace("/"); router.refresh(); }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) setMessage({ type: "erreur", text: error.message });
      else if (data.session) { router.replace("/famille"); router.refresh(); }
      else setMessage({ type: "ok", text: "Compte créé ! Ouvrez le lien reçu par email pour le confirmer." });
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="text-5xl">🍲</div>
        <h1 className="titre mt-3 text-3xl font-semibold">Carnet de recettes</h1>
        <p className="mt-1 text-encre-douce">Les recettes de la famille, au même endroit.</p>
      </div>
      <form onSubmit={submit} className="carte space-y-4 p-5">
        <div className="grid grid-cols-2 rounded-xl bg-creme p-1 text-sm">
          {(["connexion", "inscription"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`rounded-lg py-2 font-medium ${mode === m ? "bg-papier shadow-sm" : "text-encre-douce"}`}>
              {m === "connexion" ? "Se connecter" : "Créer un compte"}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="etiquette">Email</span>
          <input className="champ" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="etiquette">Mot de passe</span>
          <input className="champ" type="password" minLength={6} required value={password}
            autoComplete={mode === "connexion" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)} />
        </label>
        {message && (
          <p className={`text-sm ${message.type === "ok" ? "text-basilic" : "text-tomate"}`}>{message.text}</p>
        )}
        <button className="btn-primaire w-full" disabled={busy}>
          {busy ? "Un instant…" : mode === "connexion" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
    </main>
  );
}
