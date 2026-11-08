-- Carnet de recettes familial — schéma Supabase
-- À exécuter une fois dans Supabase > SQL Editor.

create extension if not exists "pgcrypto";

-- Familles ----------------------------------------------------------------
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 8)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Fonction utilitaire (security definer pour éviter la récursion RLS)
create or replace function public.is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid());
$$;

-- Recettes ----------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'plat'
    check (category in ('aperitif','entree','plat','accompagnement','dessert','boisson','sauce','petit-dejeuner','autre')),
  difficulty text check (difficulty in ('tres-facile','facile','moyen','difficile')),
  servings int,
  servings_unit text,               -- ex. "personnes", "parts", "pièces"
  prep_minutes int,
  cook_minutes int,
  rest_minutes int,
  rest_label text,                  -- ex. "Réfrigération", "Levée", "Marinade"
  ingredients jsonb not null default '[]'::jsonb,  -- [{quantity, unit, name, note, group}]
  steps jsonb not null default '[]'::jsonb,        -- [{text, group}]
  utensils jsonb not null default '[]'::jsonb,     -- ["fouet", ...]
  tips text,
  tags text[] not null default '{}',
  photos text[] not null default '{}',             -- chemins dans le bucket "recipe-photos"
  source_type text check (source_type in ('url','photo-manuscrite','photo-livre','manuel')),
  source_url text,
  source_label text,                -- ex. "Livre de mamie", "Elle à table n°123"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_family_idx on public.recipes(family_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

-- RLS ---------------------------------------------------------------------
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.recipes enable row level security;

create policy "voir ma famille" on public.families for select using (public.is_family_member(id));
create policy "modifier ma famille" on public.families for update using (public.is_family_member(id));

create policy "voir les membres" on public.family_members for select using (public.is_family_member(family_id));
create policy "modifier mon profil" on public.family_members for update using (user_id = auth.uid());
create policy "quitter la famille" on public.family_members for delete using (user_id = auth.uid());

create policy "lire recettes" on public.recipes for select using (public.is_family_member(family_id));
create policy "ajouter recettes" on public.recipes for insert with check (public.is_family_member(family_id) and created_by = auth.uid());
create policy "modifier recettes" on public.recipes for update using (public.is_family_member(family_id));
create policy "supprimer recettes" on public.recipes for delete using (public.is_family_member(family_id));

-- Créer / rejoindre une famille (RPC) -------------------------------------
create or replace function public.create_family(family_name text, member_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  insert into families(name, created_by) values (family_name, auth.uid()) returning id into fid;
  insert into family_members(family_id, user_id, display_name, role) values (fid, auth.uid(), member_name, 'owner');
  return fid;
end; $$;

create or replace function public.join_family(code text, member_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select id into fid from families where invite_code = upper(trim(code));
  if fid is null then raise exception 'Code d''invitation inconnu'; end if;
  insert into family_members(family_id, user_id, display_name) values (fid, auth.uid(), member_name)
    on conflict (family_id, user_id) do nothing;
  return fid;
end; $$;

grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;

-- Stockage des photos -----------------------------------------------------
-- Bucket privé ; chemin = <family_id>/<fichier>
insert into storage.buckets (id, name, public) values ('recipe-photos', 'recipe-photos', false)
  on conflict (id) do nothing;

create policy "photos lecture" on storage.objects for select
  using (bucket_id = 'recipe-photos' and public.is_family_member(((storage.foldername(name))[1])::uuid));
create policy "photos ajout" on storage.objects for insert
  with check (bucket_id = 'recipe-photos' and public.is_family_member(((storage.foldername(name))[1])::uuid));
create policy "photos suppression" on storage.objects for delete
  using (bucket_id = 'recipe-photos' and public.is_family_member(((storage.foldername(name))[1])::uuid));
