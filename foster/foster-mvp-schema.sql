-- Second Leash Foster MVP: link each Supabase Auth user to one foster record.
-- Run once in Supabase SQL Editor after reviewing your existing schema.

alter table public.fosters add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists fosters_user_id_unique on public.fosters(user_id) where user_id is not null;

create policy "Fosters can read own foster record"
on public.fosters for select to authenticated
using (user_id = auth.uid());

create policy "Fosters can read own placements"
on public.placements for select to authenticated
using (foster_id in (select id from public.fosters where user_id = auth.uid()));

create policy "Fosters can read assigned dogs"
on public.dogs for select to authenticated
using (id in (select dog_id from public.placements where foster_id in (select id from public.fosters where user_id = auth.uid())));

create policy "Fosters can create own checkins"
on public.checkins for insert to authenticated
with check (foster_id in (select id from public.fosters where user_id = auth.uid()) and created_by = auth.uid());

create policy "Fosters can read own checkins"
on public.checkins for select to authenticated
using (foster_id in (select id from public.fosters where user_id = auth.uid()));
