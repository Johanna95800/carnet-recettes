import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // appelé depuis un Server Component : le middleware rafraîchit la session
          }
        },
      },
    },
  );
}

/** Utilisateur connecté + sa famille (la première s'il en a plusieurs). */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, family: null };
  const { data } = await supabase
    .from("family_members")
    .select("family_id, display_name, role, families(id, name, invite_code)")
    .eq("user_id", user.id)
    .order("joined_at")
    .limit(1)
    .maybeSingle();
  const family = data?.families as unknown as { id: string; name: string; invite_code: string } | null;
  return { supabase, user, family, member: data };
}
