-- Favoris / notes, commentaires de la famille, lien de partage public

create or replace function public.recipe_family(rid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select family_id from recipes where id = rid;
$$;

-- Favoris, « déjà faite », note sur 5 (une ligne par personne et par recette)
create table if not exists public.recipe_marks (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  favorite boolean not null default false,
  cooked boolean not null default false,
  rating smallint check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);
alter table public.recipe_marks enable row level security;
drop policy if exists "marks lecture" on public.recipe_marks;
drop policy if exists "marks ajout" on public.recipe_marks;
drop policy if exists "marks modif" on public.recipe_marks;
drop policy if exists "marks suppression" on public.recipe_marks;
create policy "marks lecture" on public.recipe_marks for select using (public.is_family_member(public.recipe_family(recipe_id)));
create policy "marks ajout" on public.recipe_marks for insert with check (user_id = auth.uid() and public.is_family_member(public.recipe_family(recipe_id)));
create policy "marks modif" on public.recipe_marks for update using (user_id = auth.uid());
create policy "marks suppression" on public.recipe_marks for delete using (user_id = auth.uid());

-- Commentaires
create table if not exists public.recipe_comments (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists recipe_comments_recipe_idx on public.recipe_comments(recipe_id, created_at);
alter table public.recipe_comments enable row level security;
drop policy if exists "comments lecture" on public.recipe_comments;
drop policy if exists "comments ajout" on public.recipe_comments;
drop policy if exists "comments modif" on public.recipe_comments;
drop policy if exists "comments suppression" on public.recipe_comments;
create policy "comments lecture" on public.recipe_comments for select using (public.is_family_member(public.recipe_family(recipe_id)));
create policy "comments ajout" on public.recipe_comments for insert with check (user_id = auth.uid() and public.is_family_member(public.recipe_family(recipe_id)));
create policy "comments modif" on public.recipe_comments for update using (user_id = auth.uid());
create policy "comments suppression" on public.recipe_comments for delete using (user_id = auth.uid());

-- Lien de partage public (lecture seule, sans compte)
alter table public.recipes add column if not exists share_token uuid unique;

create or replace function public.get_shared_recipe(token uuid)
returns setof public.recipes language sql stable security definer set search_path = public as $$
  select * from recipes where share_token = token;
$$;
grant execute on function public.get_shared_recipe(uuid) to anon, authenticated;

create or replace function public.is_shared_photo(path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from recipes where share_token is not null and path = any(photos));
$$;
grant execute on function public.is_shared_photo(text) to anon, authenticated;

drop policy if exists "photos partagées" on storage.objects;
create policy "photos partagées" on storage.objects for select to anon
  using (bucket_id = 'recipe-photos' and public.is_shared_photo(name));
