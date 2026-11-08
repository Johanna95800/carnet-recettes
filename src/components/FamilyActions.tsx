"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function InviteCard({ code, familyName }: { code: string; familyName: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Rejoins le carnet de recettes « ${familyName} » : crée un compte sur ${typeof location !== "undefined" ? location.origin : ""} puis entre le code ${code}`;
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: "Carnet de recettes", text }); return; } catch { /* annulé */ }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <section className="carte p-5">
      <h2 className="font-semibold">Inviter la famille</h2>
      <p className="mt-1 text-sm text-encre-douce">Chacun crée son compte puis saisit ce code.</p>
      <div className="mt-3 flex items-center gap-3">
        <code className="flex-1 rounded-xl bg-creme px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em]">{code}</code>
        <button className="btn-primaire" onClick={share}>{copied ? "Copié ✓" : "Partager"}</button>
      </div>
    </section>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button className="text-sm text-encre-douce underline" onClick={async () => {
      await createClient().auth.signOut();
      router.replace("/connexion");
      router.refresh();
    }}>Se déconnecter</button>
  );
}
