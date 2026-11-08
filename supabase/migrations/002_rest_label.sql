-- Type du temps d'attente (refroidissement, réfrigération, levée, marinade…)
alter table public.recipes add column if not exists rest_label text;
