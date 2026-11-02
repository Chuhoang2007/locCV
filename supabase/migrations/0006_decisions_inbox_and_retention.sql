begin;

alter table public.applications add column purge_pending_at timestamptz;
alter table public.cv_uploads add column purge_pending_at timestamptz;
create index applications_retention on public.applications(coalesce(hr_decided_at,created_at));
create index users_deletion_due on public.users(deletion_requested_at) where deletion_requested_at is not null;

create function public.lc_decide_application(p_actor uuid,p_application uuid,p_version integer,p_decision text,p_message text) returns jsonb language plpgsql set search_path='' as $$
declare a public.applications%rowtype; target text;
begin
  select a0.* into a from public.applications a0 join public.jobs j on j.id=a0.job_id
    where a0.id=p_application and j.owner_user_id=p_actor for update of a0;
  if not found or a.purge_pending_at is not null then raise exception 'NOT_FOUND'; end if;
  if p_decision is null or p_decision not in ('APPROVE','REJECT') or p_message is null or length(btrim(p_message)) not between 1 and 2000 then raise exception 'INVALID_INPUT'; end if;
  target:=case p_decision when 'APPROVE' then 'HR_APPROVED' else 'HR_REJECTED' end;
  -- Retrying the exact committed decision is safe even after a lost response.
  if a.status=target and a.hr_decision_message=btrim(p_message) then
    return jsonb_build_object('application_id',a.id,'status',a.status,'version',a.version);
  end if;
  if a.status in ('HR_APPROVED','HR_REJECTED') then raise exception 'DECISION_FINAL'; end if;
  if p_version is null or a.version<>p_version then raise exception 'DECISION_VERSION_CONFLICT'; end if;
  if a.status<>'EVALUATED' and not (p_decision='REJECT' and a.status='CV_FAILED' and a.interview_started_at is null) then raise exception 'DECISION_NOT_ALLOWED'; end if;
  update public.applications set status=target,hr_decision_message=btrim(p_message),hr_decided_by_user_id=p_actor,hr_decided_at=clock_timestamp() where id=a.id returning * into a;
  insert into public.messages(recipient_user_id,actor_user_id,application_id,kind,event_key,subject,body,payload_json)
    values(a.candidate_user_id,p_actor,a.id,'HR_DECISION',a.id::text||':HR_DECISION:'||a.candidate_user_id::text,
      case p_decision when 'APPROVE' then 'Hồ sơ được chấp thuận' else 'Phản hồi từ nhà tuyển dụng' end,btrim(p_message),
      jsonb_build_object('status',a.status,'cv_score',a.cv_score,'interview_score',a.interview_score));
  insert into public.audit_events(actor_user_id,job_id,application_id,event_type,to_state)
    values(p_actor,a.job_id,a.id,'HR_DECISION',a.status);
  return jsonb_build_object('application_id',a.id,'status',a.status,'version',a.version);
end;
$$;

create function public.lc_inbox(p_actor uuid,p_before_time timestamptz,p_before_id uuid,p_limit integer,p_unread boolean) returns jsonb language plpgsql stable set search_path='' as $$
declare items jsonb; unread bigint;
begin
  if p_limit is null or p_limit not between 1 and 50 or ((p_before_time is null)<>(p_before_id is null)) or p_unread is null then raise exception 'INVALID_INPUT'; end if;
  select count(*) into unread from public.messages where recipient_user_id=p_actor and read_at is null;
  select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) into items from (
    select m.id,m.created_at,jsonb_build_object('id',m.id,'application_id',m.application_id,'subject',m.subject,'kind',m.kind,'read_at',m.read_at,'created_at',m.created_at,
      'audience',case when a.candidate_user_id=p_actor then 'CANDIDATE' else 'HR' end,'job_title',a.job_snapshot_json->'jd'->>'title') item
    from public.messages m join public.applications a on a.id=m.application_id where m.recipient_user_id=p_actor
      and (not p_unread or m.read_at is null) and (p_before_time is null or (m.created_at,m.id)<(p_before_time,p_before_id))
    order by m.created_at desc,m.id desc limit p_limit+1
  ) x;
  return jsonb_build_object('items',items,'unread_count',unread);
end;
$$;

create function public.lc_message(p_actor uuid,p_message uuid,p_read boolean) returns jsonb language plpgsql set search_path='' as $$
declare m public.messages%rowtype; a public.applications%rowtype;
begin
  select * into m from public.messages where id=p_message and recipient_user_id=p_actor for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_read then update public.messages set read_at=coalesce(read_at,clock_timestamp()) where id=m.id returning * into m; end if;
  select * into a from public.applications where id=m.application_id;
  -- Explicit projection: payload_json and private snapshots never leave this RPC.
  return jsonb_build_object('id',m.id,'application_id',m.application_id,'subject',m.subject,'body',m.body,'kind',m.kind,'read_at',m.read_at,'created_at',m.created_at,
    'audience',case when a.candidate_user_id=p_actor then 'CANDIDATE' else 'HR' end,'job_title',a.job_snapshot_json->'jd'->>'title',
    'status',a.status,'cv_score',a.cv_score,'interview_score',a.interview_score);
end;
$$;

create function public.lc_deletion_request(p_actor uuid,p_requested boolean) returns jsonb language plpgsql set search_path='' as $$
declare stamp timestamptz;
begin
  perform 1 from public.users where id=p_actor for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_requested is null then raise exception 'INVALID_INPUT'; end if;
  if p_requested then
    update public.jobs set status='CLOSED',closed_at=clock_timestamp() where owner_user_id=p_actor and status='PUBLISHED';
    update public.users set deletion_requested_at=coalesce(deletion_requested_at,clock_timestamp()) where id=p_actor returning deletion_requested_at into stamp;
  else
    if exists(select 1 from public.users where id=p_actor and deletion_requested_at<clock_timestamp()-interval '7 days') then raise exception 'DELETION_STARTED'; end if;
    update public.users set deletion_requested_at=null where id=p_actor returning deletion_requested_at into stamp;
  end if;
  return jsonb_build_object('requested_at',stamp,'scheduled_at',stamp+interval '7 days');
end;
$$;

create function public.lc_guard_retention() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_table_name='applications' then
    if tg_op='UPDATE' then
      if old.purge_pending_at is not null then raise exception 'DATA_PURGING'; end if;
    else
      if exists(select 1 from public.users where id=new.candidate_user_id and deletion_requested_at is not null) or
        exists(select 1 from public.jobs j join public.users u on u.id=j.owner_user_id where j.id=new.job_id and u.deletion_requested_at is not null) then raise exception 'DELETION_PENDING'; end if;
    end if;
  elsif tg_table_name='jobs' then
    if new.status<>'CLOSED' and exists(select 1 from public.users where id=new.owner_user_id and deletion_requested_at is not null) then raise exception 'DELETION_PENDING'; end if;
  elsif tg_table_name='cv_uploads' then
    if tg_op='UPDATE' then
      if old.purge_pending_at is not null then raise exception 'DATA_PURGING'; end if;
    elsif exists(select 1 from public.users where id=new.owner_user_id and deletion_requested_at is not null) then raise exception 'DELETION_PENDING'; end if;
  elsif tg_table_name='ai_tasks' then
    if new.kind='GENERATE_JOB' and exists(select 1 from public.users where id=new.requested_by_user_id and deletion_requested_at is not null) then raise exception 'DELETION_PENDING'; end if;
    if exists(select 1 from public.applications where id=new.application_id and purge_pending_at is not null) then raise exception 'DATA_PURGING'; end if;
  end if;
  return new;
end;
$$;
create trigger applications_retention_guard before insert or update on public.applications for each row execute function public.lc_guard_retention();
create trigger jobs_retention_guard before insert or update on public.jobs for each row execute function public.lc_guard_retention();
create trigger cv_uploads_retention_guard before insert or update on public.cv_uploads for each row execute function public.lc_guard_retention();
create trigger tasks_retention_guard before insert on public.ai_tasks for each row execute function public.lc_guard_retention();

-- Persist a tombstone BEFORE touching Storage. A crashed purge resumes the same objects;
-- application edits and task creation stay blocked until deletion is finished.
create function public.lc_claim_purge(p_limit integer,p_retention boolean) returns jsonb language plpgsql set search_path='' as $$
declare a record; u record; result jsonb:='[]'::jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 or p_retention is null then raise exception 'INVALID_INPUT'; end if;
  for a in select x.* from public.applications x join public.jobs j on j.id=x.job_id
    join public.users c on c.id=x.candidate_user_id join public.users h on h.id=j.owner_user_id
    where p_retention and (x.purge_pending_at is not null or coalesce(x.hr_decided_at,x.created_at)<clock_timestamp()-interval '180 days'
      or c.deletion_requested_at<clock_timestamp()-interval '7 days' or h.deletion_requested_at<clock_timestamp()-interval '7 days')
    and not exists(select 1 from public.ai_tasks t where t.application_id=x.id and t.state in ('RUNNING','RETRY_WAIT') and t.lease_until>clock_timestamp())
    order by x.created_at,x.id limit p_limit for update of x skip locked
  loop
    perform 1 from public.ai_tasks where application_id=a.id for update;
    if exists(select 1 from public.ai_tasks where application_id=a.id and state in ('RUNNING','RETRY_WAIT') and lease_until>clock_timestamp()) then continue; end if;
    update public.ai_tasks set state='FAILED',finished_at=clock_timestamp(),lease_owner=null,lease_until=null,error_code='DATA_EXPIRED'
      where application_id=a.id and state in ('QUEUED','RETRY_WAIT','RUNNING');
    if a.purge_pending_at is null then update public.applications set purge_pending_at=clock_timestamp() where id=a.id; end if;
    result:=result||jsonb_build_array(jsonb_build_object('kind','APPLICATION','id',a.id,'storage_path',a.cv_storage_path));
  end loop;
  for u in select x.* from public.cv_uploads x join public.users p on p.id=x.owner_user_id where
    not exists(select 1 from public.applications app_ref where app_ref.cv_storage_path=x.storage_path)
    and (x.purge_pending_at is not null or x.expires_at<clock_timestamp() or (p_retention and p.deletion_requested_at<clock_timestamp()-interval '7 days'))
    and (x.state<>'PARSING' or x.parse_started_at<clock_timestamp()-interval '1 minute')
    order by x.created_at,x.id limit p_limit for update of x skip locked
  loop
    if u.purge_pending_at is null then update public.cv_uploads set purge_pending_at=clock_timestamp() where id=u.id; end if;
    result:=result||jsonb_build_array(jsonb_build_object('kind','UPLOAD','id',u.id,'storage_path',u.storage_path));
  end loop;
  delete from public.idempotency_keys where expires_at<clock_timestamp();
  return result;
end;
$$;

-- SECURITY DEFINER narrowly allows removing linked audit rows. Direct audit mutation
-- remains revoked from service_role; no browser role may execute these functions.
create function public.lc_finish_purge(p_kind text,p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype;
begin
  if p_kind='UPLOAD' then
    delete from public.cv_uploads where id=p_id and purge_pending_at is not null;
    return found;
  elsif p_kind<>'APPLICATION' or p_kind is null then raise exception 'INVALID_INPUT'; end if;
  select * into a from public.applications where id=p_id and purge_pending_at is not null for update;
  if not found then return false; end if;
  if exists(select 1 from public.ai_tasks where application_id=p_id and state='RUNNING' and lease_until>clock_timestamp()) then return false; end if;
  delete from public.messages where application_id=p_id;
  delete from public.audit_events where application_id=p_id;
  delete from public.idempotency_keys where resource_id=p_id or resource_id in(select id from public.ai_tasks where application_id=p_id);
  delete from public.ai_tasks where application_id=p_id;
  delete from public.cv_uploads where storage_path=a.cv_storage_path;
  delete from public.applications where id=p_id;
  return true;
end;
$$;

create function public.lc_deletion_candidates(p_limit integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u record; result jsonb:='[]'::jsonb;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_INPUT'; end if;
  for u in select * from public.users where deletion_requested_at<clock_timestamp()-interval '7 days' order by deletion_requested_at limit p_limit for update skip locked loop
    if exists(select 1 from public.applications a join public.jobs j on j.id=a.job_id where a.candidate_user_id=u.id or j.owner_user_id=u.id)
      or exists(select 1 from public.cv_uploads where owner_user_id=u.id)
      or exists(select 1 from public.ai_tasks where requested_by_user_id=u.id and state='RUNNING' and lease_until>clock_timestamp()) then continue; end if;
    delete from public.messages where recipient_user_id=u.id or actor_user_id=u.id;
    delete from public.audit_events where actor_user_id=u.id or job_id in(select id from public.jobs where owner_user_id=u.id);
    delete from public.ai_tasks where requested_by_user_id=u.id or job_id in(select id from public.jobs where owner_user_id=u.id);
    delete from public.idempotency_keys where user_id=u.id or resource_id in(select id from public.jobs where owner_user_id=u.id);
    delete from public.jobs where owner_user_id=u.id;
    result:=result||jsonb_build_array(u.id);
  end loop;
  return result;
end;
$$;

create function public.lc_operations() returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('schema_version',6,'queued',(select count(*) from public.ai_tasks where state in ('QUEUED','RETRY_WAIT')),
    'running',(select count(*) from public.ai_tasks where state='RUNNING'),
    'oldest_queue_seconds',coalesce((select greatest(0,extract(epoch from now()-min(created_at))) from public.ai_tasks where state in ('QUEUED','RETRY_WAIT')),0),
    'retries_24h',(select coalesce(sum(greatest(network_attempts-1,0)),0) from public.ai_tasks where created_at>now()-interval '24 hours'),
    'failed_24h',(select count(*) from public.ai_tasks where state='FAILED' and finished_at>now()-interval '24 hours'),
    'timeout_24h',(select count(*) from public.ai_tasks where error_code like '%TIMEOUT%' and updated_at>now()-interval '24 hours'),
    'invalid_json_24h',(select count(*) from public.ai_tasks where error_code in ('INVALID_JSON','INVALID_OUTPUT') and updated_at>now()-interval '24 hours'),
    'autosubmit_lag_seconds',coalesce((select greatest(0,extract(epoch from now()-min(interview_deadline_at))) from public.applications where status='INTERVIEW_IN_PROGRESS' and interview_submitted_at is null and purge_pending_at is null),0),
    'purge_pending',(select count(*) from public.applications where purge_pending_at is not null));
$$;

create function public.lc_hr_summary(p_actor uuid,p_job uuid) returns jsonb language plpgsql stable set search_path='' as $$
begin
  if p_job is not null and not exists(select 1 from public.jobs where id=p_job and owner_user_id=p_actor) then raise exception 'NOT_FOUND'; end if;
  return (select jsonb_build_object('total',count(*),'pending',count(*) filter(where a.status not in ('EVALUATED','HR_APPROVED','HR_REJECTED')),
    'evaluated',count(*) filter(where a.status='EVALUATED'),'decided',count(*) filter(where a.status in ('HR_APPROVED','HR_REJECTED')))
    from public.applications a join public.jobs j on j.id=a.job_id where j.owner_user_id=p_actor and (p_job is null or j.id=p_job) and a.purge_pending_at is null);
end;
$$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lc\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end;
$$;
notify pgrst, 'reload schema';
commit;
