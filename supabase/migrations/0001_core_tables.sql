-- Phase 1: cấu trúc nền. Chạy bởi migration owner, không phải browser.
begin;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(120) not null check (length(btrim(display_name)) between 1 and 120),
  preferred_mode text not null default 'CANDIDATE' check (preferred_mode in ('HR','CANDIDATE')),
  timezone text not null default 'Asia/Bangkok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deletion_requested_at timestamptz
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','CLOSED')),
  version integer not null default 1 check (version > 0),
  raw_hr_prompt text check (length(raw_hr_prompt) <= 8000),
  jd_json jsonb check (jsonb_typeof(jd_json) = 'object'),
  title varchar(180),
  skills text[] not null default '{}',
  location varchar(180),
  salary_min bigint check (salary_min >= 0),
  salary_max bigint check (salary_max >= 0),
  salary_currency text not null default 'VND' check (salary_currency = 'VND'),
  salary_period text not null default 'MONTH' check (salary_period = 'MONTH'),
  scoring_rubric_json jsonb check (jsonb_typeof(scoring_rubric_json) = 'object'),
  interview_questions_json jsonb check (jsonb_typeof(interview_questions_json) = 'object'),
  interview_access_policy text not null default 'CV_THRESHOLD' check (interview_access_policy in ('CV_THRESHOLD','ALWAYS')),
  approved_by_user_id uuid references public.users(id) on delete restrict,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(title,'') || ' ' || coalesce(location,'') || ' ' || coalesce(jd_json->>'summary',''))
  ) stored,
  constraint jobs_salary_range check (salary_min is null or salary_max is null or salary_min <= salary_max),
  constraint jobs_publication_fields check (status = 'DRAFT' or (
    title is not null and length(btrim(title)) > 0 and jd_json is not null and
    scoring_rubric_json is not null and interview_questions_json is not null and
    approved_by_user_id is not null and approved_by_user_id = owner_user_id and published_at is not null
  )),
  constraint jobs_closed_at check ((status = 'CLOSED') = (closed_at is not null))
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  candidate_user_id uuid not null references public.users(id) on delete restrict,
  status text not null default 'CV_SUBMITTED' check (status in ('CV_SUBMITTED','CV_PASSED','CV_FAILED','INTERVIEW_IN_PROGRESS','EVALUATED','HR_APPROVED','HR_REJECTED')),
  version integer not null default 1 check (version > 0),
  job_snapshot_json jsonb not null check (jsonb_typeof(job_snapshot_json) = 'object'),
  cv_source text not null check (cv_source in ('PDF','DOCX','TEXT')),
  cv_storage_path text,
  cv_sha256 char(64) not null check (cv_sha256 ~ '^[a-f0-9]{64}$'),
  cv_text text not null check (length(btrim(cv_text)) between 100 and 30000),
  ai_processing_acknowledged_at timestamptz not null,
  cv_evaluation_json jsonb check (jsonb_typeof(cv_evaluation_json) = 'object'),
  cv_score smallint check (cv_score between 0 and 100),
  interview_started_at timestamptz,
  interview_deadline_at timestamptz,
  candidate_answers_json jsonb not null default '{"quiz":[],"essay":[]}' check (
    jsonb_typeof(candidate_answers_json) = 'object' and
    jsonb_typeof(candidate_answers_json->'quiz') = 'array' and
    jsonb_typeof(candidate_answers_json->'essay') = 'array'
  ),
  answer_version integer not null default 0 check (answer_version >= 0),
  interview_submitted_at timestamptz,
  submission_reason text check (submission_reason in ('MANUAL','TIMEOUT')),
  quiz_result_json jsonb check (jsonb_typeof(quiz_result_json) = 'object'),
  interview_evaluation_json jsonb check (jsonb_typeof(interview_evaluation_json) = 'object'),
  interview_score numeric(5,2) check (interview_score between 0 and 100),
  hr_decision_message text check (length(btrim(hr_decision_message)) between 1 and 2000),
  hr_decided_by_user_id uuid references public.users(id) on delete restrict,
  hr_decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id,candidate_user_id),
  constraint applications_deadline check (
    (interview_started_at is null and interview_deadline_at is null) or
    (interview_started_at is not null and interview_deadline_at is not null and interview_deadline_at > interview_started_at)
  ),
  constraint applications_submission check ((interview_submitted_at is null) = (submission_reason is null)),
  constraint applications_cv_result check ((cv_evaluation_json is null) = (cv_score is null)),
  constraint applications_interview_result check ((interview_evaluation_json is null) = (interview_score is null)),
  constraint applications_cv_required check (status = 'CV_SUBMITTED' or cv_evaluation_json is not null),
  constraint applications_evaluation_required check (status not in ('EVALUATED','HR_APPROVED') or (
    interview_submitted_at is not null and interview_evaluation_json is not null
  )),
  constraint applications_hr_decision check (
    (status in ('HR_APPROVED','HR_REJECTED') and hr_decided_at is not null and hr_decided_by_user_id is not null and hr_decision_message is not null) or
    (status not in ('HR_APPROVED','HR_REJECTED') and hr_decided_at is null and hr_decided_by_user_id is null and hr_decision_message is null)
  )
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete restrict,
  application_id uuid not null references public.applications(id) on delete restrict,
  kind text not null check (kind in ('APPLICATION_RECEIVED','CV_EVALUATED','INTERVIEW_SUBMITTED','APPLICATION_EVALUATED','HR_DECISION')),
  event_key varchar(240) not null unique,
  subject varchar(200) not null check (length(btrim(subject)) > 0),
  body text not null check (length(body) between 1 and 5000),
  payload_json jsonb not null default '{}' check (jsonb_typeof(payload_json) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  requested_by_user_id uuid not null references public.users(id) on delete restrict,
  kind text not null check (kind in ('GENERATE_JOB','EVALUATE_CV','EVALUATE_ESSAY')),
  job_id uuid references public.jobs(id) on delete restrict,
  application_id uuid references public.applications(id) on delete restrict,
  input_version integer not null check (input_version > 0),
  generation integer not null default 1 check (generation > 0),
  state text not null default 'QUEUED' check (state in ('QUEUED','RUNNING','RETRY_WAIT','SUCCEEDED','FAILED')),
  network_attempts smallint not null default 0 check (network_attempts between 0 and 3),
  available_at timestamptz not null default now(),
  lease_owner uuid,
  lease_until timestamptz,
  error_code text,
  model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint ai_task_target check (
    (kind = 'GENERATE_JOB' and job_id is not null and application_id is null) or
    (kind in ('EVALUATE_CV','EVALUATE_ESSAY') and job_id is null and application_id is not null)
  ),
  constraint ai_task_lease check ((lease_owner is null) = (lease_until is null)),
  constraint ai_task_finished check ((state in ('SUCCEEDED','FAILED')) = (finished_at is not null))
);

create table public.idempotency_keys (
  user_id uuid not null references public.users(id) on delete restrict,
  operation text not null,
  key varchar(128) not null check (length(key) > 0),
  request_hash char(64) not null check (request_hash ~ '^[a-f0-9]{64}$'),
  resource_id uuid not null,
  response_status integer not null check (response_status between 200 and 299),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (user_id,operation,key),
  check (expires_at > created_at)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete restrict,
  application_id uuid references public.applications(id) on delete restrict,
  event_type text not null,
  from_state text,
  to_state text,
  metadata_json jsonb not null default '{}' check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now()
);

create index jobs_owner_created on public.jobs(owner_user_id,created_at desc,id);
create index jobs_published on public.jobs(published_at desc,id) where status = 'PUBLISHED';
create index jobs_skills on public.jobs using gin(skills);
create index jobs_search on public.jobs using gin(search_vector);
create index applications_job_status on public.applications(job_id,status,created_at desc,id);
create index applications_candidate_created on public.applications(candidate_user_id,created_at desc,id);
create index applications_deadlines on public.applications(interview_deadline_at) where status = 'INTERVIEW_IN_PROGRESS' and interview_submitted_at is null;
create index messages_recipient_created on public.messages(recipient_user_id,created_at desc,id);
create index messages_unread on public.messages(recipient_user_id) where read_at is null;
create unique index ai_tasks_job_generation on public.ai_tasks(kind,job_id,input_version,generation) where job_id is not null;
create unique index ai_tasks_application_generation on public.ai_tasks(kind,application_id,input_version,generation) where application_id is not null;
create unique index ai_tasks_active_job on public.ai_tasks(kind,job_id) where job_id is not null and state in ('QUEUED','RUNNING','RETRY_WAIT');
create unique index ai_tasks_active_application on public.ai_tasks(kind,application_id) where application_id is not null and state in ('QUEUED','RUNNING','RETRY_WAIT');
create index ai_tasks_ready on public.ai_tasks(available_at,created_at,id) where state in ('QUEUED','RETRY_WAIT');
create index ai_tasks_leases on public.ai_tasks(lease_until) where state = 'RUNNING';
create index idempotency_expiry on public.idempotency_keys(expires_at);
create index audit_application on public.audit_events(application_id,created_at,id);
create index audit_job on public.audit_events(job_id,created_at,id);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.validate_user_profile() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'INVALID_TIMEZONE' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.created_at <> old.created_at) then
    raise exception 'IMMUTABLE_USER_IDENTITY' using errcode = '23514';
  end if;
  new.display_name := btrim(new.display_name);
  new.updated_at := now();
  return new;
end;
$$;
create trigger users_validate before insert or update on public.users for each row execute function public.validate_user_profile();

create function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users(id,display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'Thành viên mới'),120))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();
-- Tài khoản có trước migration cũng nhận profile mà không sửa thông tin đã có.
insert into public.users(id,display_name)
select id,left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Thành viên mới'),120) from auth.users
on conflict (id) do nothing;

create function public.guard_job() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status <> 'DRAFT' then
    raise exception 'JOB_MUST_START_AS_DRAFT' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.owner_user_id <> old.owner_user_id or new.id <> old.id or new.created_at <> old.created_at then
      raise exception 'IMMUTABLE_JOB_IDENTITY' using errcode = '23514';
    end if;
    if new.status <> old.status and not ((old.status = 'DRAFT' and new.status = 'PUBLISHED') or (old.status = 'PUBLISHED' and new.status = 'CLOSED')) then
      raise exception 'INVALID_JOB_TRANSITION' using errcode = '23514';
    end if;
    if old.status <> 'DRAFT' and
      (to_jsonb(new) - array['status','version','updated_at','closed_at','search_vector']) is distinct from
      (to_jsonb(old) - array['status','version','updated_at','closed_at','search_vector']) then
      raise exception 'PUBLISHED_JOB_IS_IMMUTABLE' using errcode = '23514';
    end if;
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger jobs_guard before insert or update on public.jobs for each row execute function public.guard_job();

create function public.guard_application() returns trigger language plpgsql set search_path = '' as $$
declare job public.jobs%rowtype; access_policy text;
begin
  if tg_op = 'INSERT' then
    select * into job from public.jobs where id = new.job_id for update;
    if not found then raise exception 'JOB_NOT_FOUND' using errcode = '23503'; end if;
    if job.owner_user_id = new.candidate_user_id then raise exception 'SELF_APPLICATION' using errcode = '23514'; end if;
    if job.status <> 'PUBLISHED' then raise exception 'JOB_NOT_OPEN' using errcode = '23514'; end if;
    if new.status <> 'CV_SUBMITTED' then raise exception 'INVALID_INITIAL_APPLICATION_STATUS' using errcode = '23514'; end if;
    new.job_snapshot_json := jsonb_build_object('job_id',job.id,'job_version',job.version,'jd',job.jd_json,
      'scoring_rubric',job.scoring_rubric_json,'interview_questions',job.interview_questions_json,
      'interview_access_policy',job.interview_access_policy);
  else
    if (new.id,new.job_id,new.candidate_user_id,new.job_snapshot_json,new.cv_source,new.cv_storage_path,new.cv_sha256,new.cv_text,new.ai_processing_acknowledged_at,new.created_at)
      is distinct from
      (old.id,old.job_id,old.candidate_user_id,old.job_snapshot_json,old.cv_source,old.cv_storage_path,old.cv_sha256,old.cv_text,old.ai_processing_acknowledged_at,old.created_at) then
      raise exception 'IMMUTABLE_APPLICATION_INPUT' using errcode = '23514';
    end if;
    access_policy := old.job_snapshot_json->>'interview_access_policy';
    if new.status <> old.status and not (
      (old.status = 'CV_SUBMITTED' and new.status in ('CV_PASSED','CV_FAILED')) or
      (old.status = 'CV_PASSED' and new.status = 'INTERVIEW_IN_PROGRESS') or
      (old.status = 'CV_FAILED' and new.status = 'INTERVIEW_IN_PROGRESS' and access_policy = 'ALWAYS') or
      (old.status = 'CV_FAILED' and new.status = 'HR_REJECTED') or
      (old.status = 'INTERVIEW_IN_PROGRESS' and new.status = 'EVALUATED') or
      (old.status = 'EVALUATED' and new.status in ('HR_APPROVED','HR_REJECTED'))
    ) then raise exception 'INVALID_APPLICATION_TRANSITION' using errcode = '23514'; end if;
    if old.status in ('HR_APPROVED','HR_REJECTED') then raise exception 'APPLICATION_IS_FINAL' using errcode = '23514'; end if;
    if old.interview_started_at is not null and
      (new.interview_started_at,new.interview_deadline_at) is distinct from (old.interview_started_at,old.interview_deadline_at) then
      raise exception 'IMMUTABLE_INTERVIEW_DEADLINE' using errcode = '23514';
    end if;
    if old.interview_submitted_at is not null and
      (new.candidate_answers_json,new.answer_version,new.interview_submitted_at,new.submission_reason) is distinct from
      (old.candidate_answers_json,old.answer_version,old.interview_submitted_at,old.submission_reason) then
      raise exception 'ANSWERS_ALREADY_SUBMITTED' using errcode = '23514';
    end if;
    if new.candidate_answers_json is distinct from old.candidate_answers_json and
      (old.status <> 'INTERVIEW_IN_PROGRESS' or old.interview_deadline_at is null or clock_timestamp() >= old.interview_deadline_at) then
      raise exception 'ANSWER_WINDOW_CLOSED' using errcode = '23514';
    end if;
    new.version := old.version + 1;
  end if;
  if new.cv_evaluation_json is not null then
    if new.cv_score is distinct from (new.cv_evaluation_json->>'total_score')::smallint then
      raise exception 'CV_SCORE_MISMATCH' using errcode = '23514';
    end if;
    if new.status = 'CV_PASSED' and new.cv_score < (new.job_snapshot_json->'scoring_rubric'->>'pass_threshold')::integer then
      raise exception 'CV_THRESHOLD_NOT_MET' using errcode = '23514';
    end if;
    if new.status = 'CV_FAILED' and new.cv_score >= (new.job_snapshot_json->'scoring_rubric'->>'pass_threshold')::integer then
      raise exception 'CV_THRESHOLD_MET' using errcode = '23514';
    end if;
  end if;
  if new.interview_evaluation_json is not null and new.interview_score is distinct from (new.interview_evaluation_json->>'total_score')::numeric then
    raise exception 'INTERVIEW_SCORE_MISMATCH' using errcode = '23514';
  end if;
  if new.hr_decided_by_user_id is not null and not exists (
    select 1 from public.jobs j where j.id = new.job_id and j.owner_user_id = new.hr_decided_by_user_id
  ) then raise exception 'DECISION_OWNER_REQUIRED' using errcode = '23514'; end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger applications_guard before insert or update on public.applications for each row execute function public.guard_application();
create trigger ai_tasks_updated before update on public.ai_tasks for each row execute function public.touch_updated_at();

commit;
