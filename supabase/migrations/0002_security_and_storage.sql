begin;

-- Không có policy cho browser trên dữ liệu nghiệp vụ: API server là cổng duy nhất.
alter table public.users enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.messages enable row level security;
alter table public.ai_tasks enable row level security;
alter table public.idempotency_keys enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.users, public.jobs, public.applications, public.messages,
  public.ai_tasks, public.idempotency_keys, public.audit_events from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on public.users, public.jobs, public.applications,
  public.messages, public.ai_tasks, public.idempotency_keys to service_role;
grant select, insert on public.audit_events to service_role;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.validate_user_profile() from public, anon, authenticated;
revoke all on function public.guard_job() from public, anon, authenticated;
revoke all on function public.guard_application() from public, anon, authenticated;

-- Grants của bảng tương lai phải được khai báo rõ trong migration của tính năng đó.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('cvs','cvs',false,5242880,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bucket mới không có policy cấp quyền cho browser. Các policy deny mang tính RESTRICTIVE
-- còn ngăn một permissive policy rộng ở nơi khác vô tình mở bucket cvs.
create policy cvs_deny_browser_select on storage.objects as restrictive for select to anon, authenticated using (bucket_id <> 'cvs');
create policy cvs_deny_browser_insert on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> 'cvs');
create policy cvs_deny_browser_update on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> 'cvs') with check (bucket_id <> 'cvs');
create policy cvs_deny_browser_delete on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> 'cvs');

commit;
