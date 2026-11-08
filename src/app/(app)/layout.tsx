import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, family } = await getSession();
  if (!user) redirect("/connexion");
  const path = (await headers()).get("x-pathname") ?? "";
  if (!family && !path.startsWith("/famille")) redirect("/famille");

  return (
    <div className="mx-auto min-h-dvh max-w-3xl pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10">
      {children}
      {family && <BottomNav />}
    </div>
  );
}
