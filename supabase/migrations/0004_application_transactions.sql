begin;

-- Temporary private files; never grant browser roles direct access.
create table public.cv_uploads (
  id uuid primary key,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  source text not null check (source in ('PDF','DOCX')),
  storage_path text not null unique,
  state text not null default 'UPLOADED' check (state in ('UPLOADED','PARSING','READY','FAILED')),
  extracted_text text check (length(extracted_text) <= 30000),
  parse_token uuid,
  parse_started_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index cv_uploads_owner_created on public.cv_uploads(owner_user_id,created_at);
alter table public.cv_uploads enable row level security;
revoke all on public.cv_uploads from public,anon,authenticated;
grant select,insert,update,delete on public.cv_uploads to service_role;

create function public.lc_reserve_cv_upload(p_actor uuid,p_id uuid,p_source text) returns text language plpgsql set search_path = '' as $$
declare path text;
begin
  perform pg_advisory_xact_lock(hashtextextended('cv.upload:' || p_actor::text,0));
  if p_source is null or p_source not in ('PDF','DOCX') then raise exception 'INVALID_INPUT'; end if;
  if (select count(*) from public.cv_uploads where owner_user_id=p_actor and created_at>now()-interval '1 hour')>=10 then raise exception 'CV_RATE_LIMITED'; end if;
  path := p_actor::text || '/' || p_id::text || case when p_source='PDF' then '.pdf' else '.docx' end;
  insert into public.cv_uploads(id,owner_user_id,source,storage_path) values(p_id,p_actor,p_source,path);
  return path;
end;
$$;

create function public.lc_begin_cv_extraction(p_actor uuid,p_upload uuid,p_token uuid) returns jsonb language plpgsql set search_path = '' as $$
declare upload public.cv_uploads%rowtype;
begin
  select * into upload from public.cv_uploads where id=p_upload and owner_user_id=p_actor for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if upload.expires_at<=now() or upload.used_at is not null then raise exception 'CV_UPLOAD_EXPIRED'; end if;
  if upload.state='READY' then return jsonb_build_object('ready',true,'text',upload.extracted_text,'source',upload.source); end if;
  if upload.state='FAILED' then raise exception 'CV_UNREADABLE'; end if;
  if upload.state='PARSING' and upload.parse_started_at>now()-interval '2 minutes' then raise exception 'CV_PARSING'; end if;
  update public.cv_uploads set state='PARSING',parse_token=p_token,parse_started_at=now() where id=p_upload;
  return jsonb_build_object('ready',false,'storage_path',upload.storage_path,'source',upload.source);
end;
$$;

create function public.lc_finish_cv_extraction(p_actor uuid,p_upload uuid,p_token uuid,p_text text) returns boolean language plpgsql set search_path = '' as $$
begin
  if p_text is not null and length(btrim(p_text)) not between 100 and 30000 then raise exception 'CV_UNREADABLE'; end if;
  update public.cv_uploads set state=case when p_text is null then 'FAILED' else 'READY' end,extracted_text=p_text,parse_token=null
    where id=p_upload and owner_user_id=p_actor and parse_token=p_token and state='PARSING' and used_at is null and expires_at>now();
  return found;
end;
$$;

create function public.lc_apply(p_actor uuid,p_job uuid,p_source text,p_upload uuid,p_text text,p_ack boolean,p_key text,p_hash text,p_model text,p_prompt_version text) returns jsonb language plpgsql set search_path = '' as $$
declare saved uuid; job public.jobs%rowtype; upload public.cv_uploads%rowtype; app_id uuid; task_id uuid; path text;
begin
  saved := public.lc_idempotent(p_actor,'application.create:' || p_job::text,p_key,p_hash);
  if saved is not null then return jsonb_build_object('application_id',saved); end if;
  select * into job from public.jobs where id=p_job for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if job.owner_user_id=p_actor then raise exception 'SELF_APPLICATION'; end if;
  if exists (select 1 from public.applications where job_id=p_job and candidate_user_id=p_actor) then raise exception 'ALREADY_APPLIED'; end if;
  if job.status<>'PUBLISHED' then raise exception 'JOB_NOT_PUBLISHED'; end if;
  if p_ack is distinct from true or p_source is null or p_source not in ('TEXT','PDF','DOCX') or
    length(btrim(coalesce(p_text,''))) not between 100 and 30000 or length(btrim(coalesce(p_model,''))) not between 1 and 200 or p_prompt_version is null then raise exception 'INVALID_INPUT'; end if;
  if p_source='TEXT' then
    if p_upload is not null then raise exception 'INVALID_INPUT'; end if;
  else
    select * into upload from public.cv_uploads where id=p_upload and owner_user_id=p_actor for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if upload.state<>'READY' or upload.expires_at<=now() or upload.used_at is not null or upload.source<>p_source then raise exception 'CV_UPLOAD_EXPIRED'; end if;
    -- File text was extracted by the server and must be explicitly confirmed unchanged.
    if btrim(p_text) is distinct from btrim(upload.extracted_text) then raise exception 'CV_TEXT_CHANGED'; end if;
    path := upload.storage_path;
    update public.cv_uploads set used_at=now() where id=p_upload;
  end if;
  insert into public.applications(job_id,candidate_user_id,job_snapshot_json,cv_source,cv_storage_path,cv_sha256,cv_text,ai_processing_acknowledged_at)
    values(p_job,p_actor,'{}',p_source,path,encode(sha256(convert_to(btrim(p_text),'UTF8')),'hex'),btrim(p_text),now()) returning id into app_id;
  insert into public.ai_tasks(requested_by_user_id,kind,application_id,input_version,model,prompt_version)
    values(p_actor,'EVALUATE_CV',app_id,1,p_model,p_prompt_version) returning id into task_id;
  insert into public.messages(recipient_user_id,application_id,kind,event_key,subject,body,payload_json)
    values(p_actor,app_id,'APPLICATION_RECEIVED',app_id::text || ':received:' || p_actor::text,'Đã nhận hồ sơ ứng tuyển','CV đã được tiếp nhận và đang chờ đánh giá.',jsonb_build_object('application_id',app_id));
  insert into public.idempotency_keys(user_id,operation,key,request_hash,resource_id,response_status)
    values(p_actor,'application.create:' || p_job::text,p_key,p_hash,app_id,202);
  insert into public.audit_events(actor_user_id,job_id,application_id,event_type,to_state,metadata_json)
    values(p_actor,p_job,app_id,'APPLICATION_RECEIVED','CV_SUBMITTED',jsonb_build_object('task_id',task_id));
  return jsonb_build_object('application_id',app_id);
end;
$$;

create function public.lc_retry_cv(p_actor uuid,p_task uuid,p_key text,p_hash text,p_model text,p_prompt_version text) returns jsonb language plpgsql set search_path = '' as $$
declare app public.applications%rowtype; old_task public.ai_tasks%rowtype; target uuid; saved uuid; new_id uuid; gen integer;
begin
  select application_id into target from public.ai_tasks where id=p_task and kind='EVALUATE_CV';
  select * into app from public.applications where id=target for update;
  if not found or not (app.candidate_user_id=p_actor or exists(select 1 from public.jobs where id=app.job_id and owner_user_id=p_actor)) then raise exception 'NOT_FOUND'; end if;
  saved := public.lc_idempotent(p_actor,'cv.retry:' || p_task::text,p_key,p_hash);
  if saved is not null then return jsonb_build_object('task_id',saved,'application_id',app.id); end if;
  select * into old_task from public.ai_tasks where id=p_task for update;
  if old_task.state<>'FAILED' or app.status<>'CV_SUBMITTED' or app.cv_score is not null or
    exists(select 1 from public.ai_tasks where application_id=app.id and kind='EVALUATE_CV' and generation>old_task.generation) then raise exception 'TASK_NOT_RETRYABLE'; end if;
  if (select count(*) from public.ai_tasks where application_id=app.id and kind='EVALUATE_CV' and generation>1 and created_at>now()-interval '24 hours')>=2 then raise exception 'CV_RETRY_LIMITED'; end if;
  if length(btrim(coalesce(p_model,''))) not between 1 and 200 or p_prompt_version is null then raise exception 'INVALID_INPUT'; end if;
  select coalesce(max(generation),0)+1 into gen from public.ai_tasks where application_id=app.id and kind='EVALUATE_CV';
  insert into public.ai_tasks(requested_by_user_id,kind,application_id,input_version,generation,model,prompt_version)
    values(p_actor,'EVALUATE_CV',app.id,1,gen,p_model,p_prompt_version) returning id into new_id;
  insert into public.idempotency_keys(user_id,operation,key,request_hash,resource_id,response_status)
    values(p_actor,'cv.retry:' || p_task::text,p_key,p_hash,new_id,202);
  insert into public.audit_events(actor_user_id,application_id,event_type,metadata_json)
    values(p_actor,app.id,'CV_EVALUATION_RETRIED',jsonb_build_object('task_id',new_id));
  return jsonb_build_object('task_id',new_id,'application_id',app.id);
end;
$$;

-- Claim both shipped task kinds. Essay evaluation is introduced by Phase 4.
create or replace function public.lc_claim_task(p_lease uuid) returns jsonb language plpgsql set search_path = '' as $$
declare task public.ai_tasks%rowtype;
begin
  loop
    select * into task from public.ai_tasks where kind in ('GENERATE_JOB','EVALUATE_CV') and
      ((state in ('QUEUED','RETRY_WAIT') and available_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp())) or
       (state='RUNNING' and lease_until<=clock_timestamp())) order by available_at,created_at,id for update skip locked limit 1;
    if not found then return null; end if;
    if task.network_attempts>=3 then
      update public.ai_tasks set state='FAILED',error_code='ATTEMPTS_EXHAUSTED',finished_at=clock_timestamp(),lease_owner=null,lease_until=null where id=task.id;
      continue;
    end if;
    update public.ai_tasks set state='RUNNING',lease_owner=p_lease,lease_until=clock_timestamp()+interval '90 seconds' where id=task.id returning * into task;
    return jsonb_build_object('id',task.id,'kind',task.kind,'job_id',task.job_id,'application_id',task.application_id,'input_version',task.input_version,
      'network_attempts',task.network_attempts,'model',task.model,'prompt_version',task.prompt_version);
  end loop;
end;
$$;

create function public.lc_complete_cv(p_task uuid,p_lease uuid,p_result jsonb) returns boolean language plpgsql set search_path = '' as $$
declare task public.ai_tasks%rowtype; app public.applications%rowtype; target uuid; c jsonb; r jsonb; quote jsonb; total integer:=0; threshold integer; owner_id uuid; recipient uuid; result jsonb; passed boolean;
begin
  select application_id into target from public.ai_tasks where id=p_task;
  select * into app from public.applications where id=target for update;
  select * into task from public.ai_tasks where id=p_task for update;
  if task.id is null or task.kind<>'EVALUATE_CV' or task.lease_owner is distinct from p_lease or task.lease_until<=clock_timestamp() or task.state not in ('RUNNING','RETRY_WAIT') then return false; end if;
  if app.status<>'CV_SUBMITTED' or app.cv_score is not null or task.input_version<>1 then
    perform public.lc_fail_task(p_task,p_lease,'VERSION_CONFLICT'); return true;
  end if;
  if p_result is null or jsonb_typeof(p_result->'criteria') is distinct from 'array' or
    jsonb_array_length(p_result->'criteria')<>jsonb_array_length(app.job_snapshot_json->'scoring_rubric'->'criteria') or
    length(btrim(coalesce(p_result->>'summary',''))) not between 1 and 2000 or
    (select count(*)<>count(distinct value->>'criterion_id') from jsonb_array_elements(p_result->'criteria')) then raise exception 'INVALID_CV_RESULT'; end if;
  for c in select value from jsonb_array_elements(app.job_snapshot_json->'scoring_rubric'->'criteria') loop
    select value into r from jsonb_array_elements(p_result->'criteria') where value->>'criterion_id'=c->>'id';
    if r is null or (r->>'score') !~ '^[0-9]+$' or coalesce((r->>'score')::integer,-1) not between 0 and (c->>'max_points')::integer or
      jsonb_typeof(r->'evidence') is distinct from 'array' or jsonb_typeof(r->'missing_evidence') is distinct from 'array' or
      jsonb_array_length(r->'evidence')>10 or jsonb_array_length(r->'missing_evidence')>10 or
      length(btrim(coalesce(r->>'feedback',''))) not between 1 and 2000 or
      (r->>'score')::integer>0 and jsonb_array_length(r->'evidence')=0 then raise exception 'INVALID_CV_RESULT'; end if;
    for quote in select value from jsonb_array_elements(r->'evidence') loop
      if jsonb_typeof(quote)<>'string' or length(btrim(quote#>>'{}')) not between 1 and 2000 or strpos(app.cv_text,quote#>>'{}')=0 then raise exception 'INVALID_CV_RESULT'; end if;
    end loop;
    if (r->>'max_points')::integer is distinct from (c->>'max_points')::integer then raise exception 'INVALID_CV_RESULT'; end if;
    total := total + (r->>'score')::integer;
  end loop;
  threshold := (app.job_snapshot_json->'scoring_rubric'->>'pass_threshold')::integer;
  passed := total>=threshold;
  result := jsonb_build_object('schema_version',1,'criteria',p_result->'criteria','summary',p_result->>'summary','total_score',total,'pass_threshold',threshold,'passed',passed);
  update public.applications set cv_evaluation_json=result,cv_score=total,status=case when passed then 'CV_PASSED' else 'CV_FAILED' end where id=app.id;
  update public.ai_tasks set state='SUCCEEDED',finished_at=clock_timestamp(),error_code=null,lease_owner=null,lease_until=null where id=p_task;
  select owner_user_id into owner_id from public.jobs where id=app.job_id;
  foreach recipient in array array[app.candidate_user_id,owner_id] loop
    insert into public.messages(recipient_user_id,application_id,kind,event_key,subject,body,payload_json)
      values(recipient,app.id,'CV_EVALUATED',app.id::text || ':cv-evaluated:' || recipient::text,'Đã có kết quả đánh giá CV',
        'Điểm CV: ' || total::text || '/100. ' || case when passed then 'Đạt ngưỡng CV.' else 'Chưa đạt ngưỡng CV.' end,
        jsonb_build_object('application_id',app.id,'cv_score',total)) on conflict(event_key) do nothing;
  end loop;
  insert into public.audit_events(application_id,event_type,from_state,to_state,metadata_json)
    values(app.id,'CV_EVALUATED','CV_SUBMITTED',case when passed then 'CV_PASSED' else 'CV_FAILED' end,jsonb_build_object('task_id',p_task,'model',task.model,'prompt_version',task.prompt_version));
  return true;
end;
$$;

create function public.lc_application_task(p_actor uuid,p_application uuid) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',t.id,'job_id',a.job_id,'application_id',a.id,'state',t.state,'attempt',t.network_attempts,'max_attempts',3,
    'next_retry_at',case when t.state='RETRY_WAIT' then t.available_at else null end,'error_code',t.error_code,'updated_at',t.updated_at,
    'can_retry',t.state='FAILED' and a.status='CV_SUBMITTED' and a.cv_score is null and
      (select count(*) from public.ai_tasks x where x.application_id=a.id and x.kind='EVALUATE_CV' and x.generation>1 and x.created_at>now()-interval '24 hours')<2)
  from public.applications a join public.jobs j on j.id=a.job_id
  join lateral (select * from public.ai_tasks where application_id=a.id and kind='EVALUATE_CV' order by generation desc limit 1) t on true
  where a.id=p_application and (a.candidate_user_id=p_actor or j.owner_user_id=p_actor);
$$;

create function public.lc_list_applications(p_actor uuid,p_job uuid,p_status text,p_before_time timestamptz,p_before_id uuid,p_limit integer) returns jsonb language plpgsql stable set search_path = '' as $$
declare result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 50 or ((p_before_time is null)<>(p_before_id is null)) or
    (p_status is not null and p_status not in ('CV_SUBMITTED','CV_PASSED','CV_FAILED','INTERVIEW_IN_PROGRESS','EVALUATED','HR_APPROVED','HR_REJECTED')) then raise exception 'INVALID_INPUT'; end if;
  if p_job is not null and not exists(select 1 from public.jobs where id=p_job and owner_user_id=p_actor) then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) into result from (
    select a.created_at,a.id,jsonb_build_object('id',a.id,'job_id',a.job_id,'job_title',a.job_snapshot_json->'jd'->>'title','candidate_name',u.display_name,
      'status',a.status,'cv_score',a.cv_score,'created_at',a.created_at) item
    from public.applications a join public.users u on u.id=a.candidate_user_id
    where (case when p_job is null then a.candidate_user_id=p_actor else a.job_id=p_job end) and
      (p_status is null or a.status=p_status) and (p_before_time is null or (a.created_at,a.id)<(p_before_time,p_before_id))
    order by a.created_at desc,a.id desc limit p_limit+1
  ) x;
  return result;
end;
$$;

create function public.lc_cv_download(p_actor uuid,p_application uuid) returns jsonb language plpgsql set search_path = '' as $$
declare app public.applications%rowtype;
begin
  select a.* into app from public.applications a join public.jobs j on j.id=a.job_id
    where a.id=p_application and (a.candidate_user_id=p_actor or j.owner_user_id=p_actor);
  if not found or app.cv_storage_path is null then raise exception 'NOT_FOUND'; end if;
  insert into public.audit_events(actor_user_id,application_id,event_type) values(p_actor,app.id,'CV_DOWNLOAD_LINK_REQUESTED');
  return jsonb_build_object('id',app.id,'path',app.cv_storage_path,'source',app.cv_source);
end;
$$;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lc\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end;
$$;
commit;
