-- supabase/migrations/0006_storage.sql

insert into storage.buckets (id, name, public)
values ('candidate-photos', 'candidate-photos', true)
on conflict (id) do nothing;

create policy "candidate photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'candidate-photos');

create policy "candidate photos are writable by the owning page's owner"
  on storage.objects for insert
  with check (
    bucket_id = 'candidate-photos'
    and exists (
      select 1 from pages
      where pages.id::text = (storage.foldername(name))[1]
        and pages.owner_id = auth.uid()
    )
  );

create policy "candidate photos are updatable by the owning page's owner"
  on storage.objects for update
  using (
    bucket_id = 'candidate-photos'
    and exists (
      select 1 from pages
      where pages.id::text = (storage.foldername(name))[1]
        and pages.owner_id = auth.uid()
    )
  );

create policy "candidate photos are deletable by the owning page's owner"
  on storage.objects for delete
  using (
    bucket_id = 'candidate-photos'
    and exists (
      select 1 from pages
      where pages.id::text = (storage.foldername(name))[1]
        and pages.owner_id = auth.uid()
    )
  );
