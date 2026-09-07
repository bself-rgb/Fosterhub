-- Second Leash Hub: secure dog photo storage
-- Run once in Supabase SQL Editor.

create table if not exists public.dog_photos (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  storage_path text not null,
  file_name text,
  caption text,
  is_primary boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dog_photos_dog_id on public.dog_photos(dog_id);
create index if not exists idx_dog_photos_primary on public.dog_photos(dog_id, is_primary);

alter table public.dog_photos enable row level security;

drop policy if exists "Authenticated users can view dog photos" on public.dog_photos;
create policy "Authenticated users can view dog photos" on public.dog_photos for select to authenticated using (true);

drop policy if exists "Authenticated users can add dog photos" on public.dog_photos;
create policy "Authenticated users can add dog photos" on public.dog_photos for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "Authenticated users can update dog photos" on public.dog_photos;
create policy "Authenticated users can update dog photos" on public.dog_photos for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete dog photos" on public.dog_photos;
create policy "Authenticated users can delete dog photos" on public.dog_photos for delete to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('dog-photos', 'dog-photos', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can view dog photo files" on storage.objects;
create policy "Authenticated users can view dog photo files" on storage.objects for select to authenticated using (bucket_id = 'dog-photos');

drop policy if exists "Authenticated users can upload dog photo files" on storage.objects;
create policy "Authenticated users can upload dog photo files" on storage.objects for insert to authenticated with check (bucket_id = 'dog-photos');

drop policy if exists "Authenticated users can update dog photo files" on storage.objects;
create policy "Authenticated users can update dog photo files" on storage.objects for update to authenticated using (bucket_id = 'dog-photos') with check (bucket_id = 'dog-photos');

drop policy if exists "Authenticated users can delete dog photo files" on storage.objects;
create policy "Authenticated users can delete dog photo files" on storage.objects for delete to authenticated using (bucket_id = 'dog-photos');
