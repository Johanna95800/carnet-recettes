import { getSession } from "@/lib/supabase/server";
import { FamilySetup } from "@/components/FamilySetup";
import { InviteCard, SignOutButton } from "@/components/FamilyActions";
import { PreferredServings } from "@/components/PreferredServings";
import { BackupButton } from "@/components/BackupButton";

export default async function Famille() {
  const { supabase, user, family } = await getSession();
  if (!family) {
    return (
      <main className="mx-auto max-w-md px-4 pt-10">
        <h1 className="titre text-3xl font-semibold">Bienvenue !</h1>
        <p className="mt-1 text-encre-douce">Créez le carnet de votre famille, ou rejoignez-le avec le code reçu.</p>
        <FamilySetup defaultName={user!.email?.split("@")[0] ?? ""} />
        <div className="mt-8 text-center"><SignOutButton /></div>
      </main>
    );
  }
  const { data: members } = await supabase
    .from("family_members").select("user_id, display_name, role, joined_at")
    .eq("family_id", family.id).order("joined_at");
  const { count } = await supabase.from("recipes").select("id", { count: "exact", head: true }).eq("family_id", family.id);

  return (
    <main className="px-4 pt-6 space-y-5">
      <header>
        <p className="etiquette">Famille</p>
        <h1 className="titre text-3xl font-semibold">{family.name}</h1>
        <p className="text-encre-douce">{count ?? 0} recette{(count ?? 0) > 1 ? "s" : ""} dans le carnet</p>
      </header>
      <PreferredServings />
      <InviteCard code={family.invite_code} familyName={family.name} />
      <section className="carte p-5">
        <h2 className="font-semibold">Membres</h2>
        <ul className="mt-3 divide-y divide-trait">
          {members?.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-2.5">
              <span>{m.display_name || "Sans nom"}{m.user_id === user!.id && <span className="text-encre-douce"> (vous)</span>}</span>
              {m.role === "owner" && <span className="text-xs text-encre-douce">créateur</span>}
            </li>
          ))}
        </ul>
      </section>
      <BackupButton familyId={family.id} familyName={family.name} />
      <div className="text-center"><SignOutButton /></div>
    </main>
  );
}
