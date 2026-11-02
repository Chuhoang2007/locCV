begin;

create function public.lc_interview_dto(p_actor uuid,p_application uuid) returns jsonb language plpgsql stable set search_path = '' as $$
declare app public.applications%rowtype; questions jsonb; paper jsonb; state text;
begin
  select * into app from public.applications where id=p_application and candidate_user_id=p_actor;
  if not found then raise exception 'NOT_FOUND'; end if;
  questions:=app.job_snapshot_json->'interview_questions';
  state:=case when app.interview_evaluation_json is not null then 'EVALUATED' when app.interview_submitted_at is not null then 'SUBMITTED' when app.interview_started_at is not null then 'IN_PROGRESS' else 'NOT_STARTED' end;
  if state='IN_PROGRESS' then
    paper:=jsonb_build_object(
      'quiz',(select jsonb_agg(jsonb_build_object('id',q->>'id','prompt',q->>'prompt','options',(select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text')) from jsonb_array_elements(q->'options') o))) from jsonb_array_elements(questions->'quiz') q),
      'essay',(select jsonb_agg(jsonb_build_object('id',q->>'id','prompt',q->>'prompt')) from jsonb_array_elements(questions->'essay') q));
  end if;
  return jsonb_build_object('id',app.id,'job_title',app.job_snapshot_json->'jd'->>'title','state',state,
    'eligible',app.cv_score is not null and (app.cv_score>=(app.job_snapshot_json->'scoring_rubric'->>'pass_threshold')::integer or app.job_snapshot_json->>'interview_access_policy'='ALWAYS'),
    'duration_minutes',(questions->>'duration_minutes')::integer,'started_at',app.interview_started_at,'deadline_at',app.interview_deadline_at,
    'server_now',clock_timestamp(),'answer_version',app.answer_version,'saved_at',case when app.answer_version>0 then app.updated_at else null end,
    'questions',paper,'answers',case when state='IN_PROGRESS' then app.candidate_answers_json else null end,
    'submitted_at',app.interview_submitted_at,'submission_reason',app.submission_reason);
end;
$$;

create function public.lc_start_interview(p_actor uuid,p_application uuid) returns jsonb language plpgsql set search_path = '' as $$
declare app public.applications%rowtype; started timestamptz;
begin
  select * into app from public.applications where id=p_application and candidate_user_id=p_actor for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if app.interview_started_at is not null then return public.lc_interview_dto(p_actor,p_application); end if;
  if app.status not in ('CV_PASSED','CV_FAILED') or app.cv_score is null or app.cv_evaluation_json is null or
    (app.cv_score<(app.job_snapshot_json->'scoring_rubric'->>'pass_threshold')::integer and app.job_snapshot_json->>'interview_access_policy'<>'ALWAYS') then raise exception 'INTERVIEW_NOT_ELIGIBLE'; end if;
  started:=clock_timestamp();
  update public.applications set status='INTERVIEW_IN_PROGRESS',interview_started_at=started,
    interview_deadline_at=started+make_interval(mins=>(app.job_snapshot_json->'interview_questions'->>'duration_minutes')::integer) where id=app.id;
  insert into public.audit_events(actor_user_id,application_id,event_type,from_state,to_state) values(p_actor,app.id,'INTERVIEW_STARTED',app.status,'INTERVIEW_IN_PROGRESS');
  return public.lc_interview_dto(p_actor,p_application);
end;
$$;

-- SQL validation defends persisted answers as well as the strict server schema.
create function public.lc_validate_answers(p_answers jsonb,p_questions jsonb) returns void language plpgsql immutable set search_path = '' as $$
declare answer jsonb; question jsonb;
begin
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or
    exists(select 1 from jsonb_object_keys(p_answers) k where k not in ('quiz','essay')) or
    jsonb_typeof(p_answers->'quiz') is distinct from 'array' or jsonb_typeof(p_answers->'essay') is distinct from 'array' or
    jsonb_array_length(p_answers->'quiz')>30 or jsonb_array_length(p_answers->'essay')>10 then raise exception 'INVALID_ANSWERS'; end if;
  if (select count(*)<>count(distinct value->>'question_id') from jsonb_array_elements(p_answers->'quiz')) or
    (select count(*)<>count(distinct value->>'question_id') from jsonb_array_elements(p_answers->'essay')) then raise exception 'INVALID_ANSWERS'; end if;
  for answer in select value from jsonb_array_elements(p_answers->'quiz') loop
    select value into question from jsonb_array_elements(p_questions->'quiz') where value->>'id'=answer->>'question_id';
    if question is null or jsonb_typeof(answer)<>'object' or not (answer ?& array['question_id','selected_answer']) or
      exists(select 1 from jsonb_object_keys(answer) k where k not in ('question_id','selected_answer')) or
      (answer->'selected_answer'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(question->'options') o where o->>'id'=answer->>'selected_answer')) then raise exception 'INVALID_ANSWERS'; end if;
  end loop;
  for answer in select value from jsonb_array_elements(p_answers->'essay') loop
    if jsonb_typeof(answer)<>'object' or not(answer ?& array['question_id','text']) or
      exists(select 1 from jsonb_object_keys(answer) k where k not in ('question_id','text')) or
      jsonb_typeof(answer->'text') is distinct from 'string' or length(answer->>'text')>5000 or
      not exists(select 1 from jsonb_array_elements(p_questions->'essay') q where q->>'id'=answer->>'question_id') then raise exception 'INVALID_ANSWERS'; end if;
  end loop;
end;
$$;

create function public.lc_save_answers(p_actor uuid,p_application uuid,p_version integer,p_answers jsonb) returns jsonb language plpgsql set search_path = '' as $$
declare app public.applications%rowtype;
begin
  select * into app from public.applications where id=p_application and candidate_user_id=p_actor for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if app.status<>'INTERVIEW_IN_PROGRESS' or app.interview_submitted_at is not null or app.interview_deadline_at is null or clock_timestamp()>=app.interview_deadline_at then raise exception 'INTERVIEW_CLOSED'; end if;
  if p_version is null or p_version<>app.answer_version then raise exception 'ANSWER_VERSION_CONFLICT'; end if;
  perform public.lc_validate_answers(p_answers,app.job_snapshot_json->'interview_questions');
  update public.applications set candidate_answers_json=p_answers,answer_version=answer_version+1 where id=app.id returning * into app;
  return jsonb_build_object('answer_version',app.answer_version,'saved_at',app.updated_at,'deadline_at',app.interview_deadline_at,'server_now',clock_timestamp());
end;
$$;

-- Private source for gradeQuiz. The result never crosses the candidate API boundary.
create function public.lc_prepare_submission(p_actor uuid,p_application uuid,p_timeout boolean) returns jsonb language plpgsql stable set search_path = '' as $$
declare app public.applications%rowtype;
begin
  select * into app from public.applications where id=p_application;
  if not found or (p_actor is distinct from app.candidate_user_id and not(p_actor is null and p_timeout is true)) then raise exception 'NOT_FOUND'; end if;
  if app.interview_started_at is null then raise exception 'INTERVIEW_NOT_STARTED'; end if;
  if p_timeout and app.interview_deadline_at>clock_timestamp() then raise exception 'INTERVIEW_NOT_DUE'; end if;
  return jsonb_build_object('id',app.id,'answer_version',app.answer_version,'submitted_at',app.interview_submitted_at,
    'questions',app.job_snapshot_json->'interview_questions','answers',app.candidate_answers_json);
end;
$$;

create function public.lc_submit_interview(p_actor uuid,p_application uuid,p_version integer,p_quiz jsonb,p_model text,p_prompt_version text,p_timeout boolean) returns jsonb language plpgsql set search_path = '' as $$
declare app public.applications%rowtype; task_id uuid; reason text;
begin
  select * into app from public.applications where id=p_application for update;
  if not found or (p_actor is distinct from app.candidate_user_id and not(p_actor is null and p_timeout is true)) then raise exception 'NOT_FOUND'; end if;
  if app.interview_submitted_at is not null then
    return jsonb_build_object('submitted_at',app.interview_submitted_at,'submission_reason',app.submission_reason,'task_id',(select id from public.ai_tasks where application_id=app.id and kind='EVALUATE_ESSAY' order by generation desc limit 1));
  end if;
  if app.status<>'INTERVIEW_IN_PROGRESS' or app.interview_started_at is null or app.interview_deadline_at is null then raise exception 'INTERVIEW_NOT_STARTED'; end if;
  if p_timeout and app.interview_deadline_at>clock_timestamp() then raise exception 'INTERVIEW_NOT_DUE'; end if;
  if p_version is null or p_version<>app.answer_version then raise exception 'ANSWER_VERSION_CONFLICT'; end if;
  if p_timeout is null or p_quiz is null or jsonb_typeof(p_quiz->'questions') is distinct from 'array' or
    jsonb_array_length(p_quiz->'questions')<>jsonb_array_length(app.job_snapshot_json->'interview_questions'->'quiz') or
    coalesce((p_quiz->>'score')::numeric,-1) not between 0 and 100 or length(btrim(coalesce(p_model,''))) not between 1 and 200 or p_prompt_version is null then raise exception 'INVALID_INPUT'; end if;
  -- gradeQuiz ran on persisted answers at p_version. Row lock + CAS ensure that source is still current.
  reason:=case when clock_timestamp()>=app.interview_deadline_at then 'TIMEOUT' else 'MANUAL' end;
  update public.applications set interview_submitted_at=clock_timestamp(),submission_reason=reason,quiz_result_json=p_quiz where id=app.id returning * into app;
  insert into public.ai_tasks(requested_by_user_id,kind,application_id,input_version,model,prompt_version)
    values(app.candidate_user_id,'EVALUATE_ESSAY',app.id,app.answer_version+1,p_model,p_prompt_version) returning id into task_id;
  insert into public.messages(recipient_user_id,application_id,kind,event_key,subject,body,payload_json)
    values(app.candidate_user_id,app.id,'INTERVIEW_SUBMITTED',app.id::text || ':interview-submitted:' || app.candidate_user_id::text,
      'Đã nhận bài làm','Bài làm đã được khóa và đang chờ đánh giá tự luận.',jsonb_build_object('application_id',app.id)) on conflict(event_key) do nothing;
  insert into public.audit_events(actor_user_id,application_id,event_type,metadata_json) values(p_actor,app.id,'INTERVIEW_SUBMITTED',jsonb_build_object('reason',reason,'task_id',task_id));
  return jsonb_build_object('submitted_at',app.interview_submitted_at,'submission_reason',reason,'task_id',task_id);
end;
$$;

create function public.lc_due_interviews(p_limit integer) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(id),'[]'::jsonb) from (select id from public.applications where status='INTERVIEW_IN_PROGRESS' and
    interview_submitted_at is null and interview_deadline_at<=clock_timestamp() order by interview_deadline_at,id limit least(greatest(p_limit,1),100)) x;
$$;

create or replace function public.lc_claim_task(p_lease uuid) returns jsonb language plpgsql set search_path = '' as $$
declare task public.ai_tasks%rowtype;
begin
  loop
    select * into task from public.ai_tasks where kind in ('GENERATE_JOB','EVALUATE_CV','EVALUATE_ESSAY') and
      ((state in ('QUEUED','RETRY_WAIT') and available_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp())) or
       (state='RUNNING' and lease_until<=clock_timestamp())) order by available_at,created_at,id for update skip locked limit 1;
    if not found then return null; end if;
    if task.network_attempts>=3 then
      update public.ai_tasks set state='FAILED',error_code='ATTEMPTS_EXHAUSTED',finished_at=clock_timestamp(),lease_owner=null,lease_until=null where id=task.id;continue;
    end if;
    update public.ai_tasks set state='RUNNING',lease_owner=p_lease,lease_until=clock_timestamp()+interval '90 seconds' where id=task.id returning * into task;
    return jsonb_build_object('id',task.id,'kind',task.kind,'job_id',task.job_id,'application_id',task.application_id,'input_version',task.input_version,
      'network_attempts',task.network_attempts,'model',task.model,'prompt_version',task.prompt_version);
  end loop;
end;
$$;

create function public.lc_complete_essay(p_task uuid,p_lease uuid,p_result jsonb) returns boolean language plpgsql set search_path = '' as $$
declare task public.ai_tasks%rowtype; app public.applications%rowtype; target uuid; question jsonb; criterion jsonb; row jsonb; score_row jsonb; quote jsonb; answer text;
  earned integer:=0; maximum integer:=0; question_earned integer; essay_score numeric; total numeric; report jsonb; owner_id uuid; recipient uuid;
begin
  select application_id into target from public.ai_tasks where id=p_task;
  select * into app from public.applications where id=target for update;
  select * into task from public.ai_tasks where id=p_task for update;
  if task.id is null or task.kind<>'EVALUATE_ESSAY' or task.lease_owner is distinct from p_lease or task.lease_until<=clock_timestamp() or task.state not in ('RUNNING','RETRY_WAIT') then return false; end if;
  if app.status<>'INTERVIEW_IN_PROGRESS' or app.interview_submitted_at is null or app.interview_evaluation_json is not null or task.input_version<>app.answer_version+1 then perform public.lc_fail_task(p_task,p_lease,'VERSION_CONFLICT');return true; end if;
  if p_result is null or p_result->'quiz' is distinct from app.quiz_result_json or
    coalesce((p_result->>'quiz_weight')::integer,0)<>40 or coalesce((p_result->>'essay_weight')::integer,0)<>60 or
    jsonb_typeof(p_result->'essay'->'questions') is distinct from 'array' or
    length(btrim(coalesce(p_result->'essay'->>'summary',''))) not between 1 and 2000 or
    jsonb_array_length(p_result->'essay'->'questions')<>jsonb_array_length(app.job_snapshot_json->'interview_questions'->'essay') or
    (select count(*)<>count(distinct value->>'question_id') from jsonb_array_elements(p_result->'essay'->'questions')) then raise exception 'INVALID_ESSAY_RESULT'; end if;
  for question in select value from jsonb_array_elements(app.job_snapshot_json->'interview_questions'->'essay') loop
    select value into row from jsonb_array_elements(p_result->'essay'->'questions') where value->>'question_id'=question->>'id';
    select value->>'text' into answer from jsonb_array_elements(app.candidate_answers_json->'essay') where value->>'question_id'=question->>'id';answer:=coalesce(answer,'');
    if row is null or jsonb_typeof(row->'criteria') is distinct from 'array' or length(btrim(coalesce(row->>'feedback',''))) not between 1 and 2000 or
      jsonb_array_length(row->'criteria')<>jsonb_array_length(question->'rubric') or
      (select count(*)<>count(distinct value->>'criterion_id') from jsonb_array_elements(row->'criteria')) then raise exception 'INVALID_ESSAY_RESULT'; end if;
    question_earned:=0;
    for criterion in select value from jsonb_array_elements(question->'rubric') loop
      select value into score_row from jsonb_array_elements(row->'criteria') where value->>'criterion_id'=criterion->>'id';
      if score_row is null or coalesce(score_row->>'score','') !~ '^[0-9]+$' or (score_row->>'score')::integer not between 0 and (criterion->>'max_points')::integer or
        (score_row->>'max_points')::integer is distinct from (criterion->>'max_points')::integer or
        jsonb_typeof(score_row->'evidence') is distinct from 'array' or jsonb_array_length(score_row->'evidence')>10 or
        length(btrim(coalesce(score_row->>'feedback',''))) not between 1 and 2000 or
        ((score_row->>'score')::integer>0 and jsonb_array_length(score_row->'evidence')=0) or
        (length(btrim(answer))=0 and ((score_row->>'score')::integer<>0 or jsonb_array_length(score_row->'evidence')<>0)) then raise exception 'INVALID_ESSAY_RESULT'; end if;
      for quote in select value from jsonb_array_elements(score_row->'evidence') loop
        if jsonb_typeof(quote)<>'string' or length(btrim(quote#>>'{}')) not between 1 and 2000 or strpos(answer,quote#>>'{}')=0 then raise exception 'INVALID_ESSAY_RESULT'; end if;
      end loop;
      question_earned:=question_earned+(score_row->>'score')::integer;
    end loop;
    if (row->>'earned_points')::integer is distinct from question_earned or (row->>'max_points')::integer is distinct from (question->>'max_points')::integer then raise exception 'INVALID_ESSAY_RESULT'; end if;
    earned:=earned+question_earned;maximum:=maximum+(question->>'max_points')::integer;
  end loop;
  essay_score:=round(100.0*earned/maximum,2);total:=round((app.quiz_result_json->>'score')::numeric*0.4+essay_score*0.6,2);
  if (p_result->'essay'->>'score')::numeric is distinct from essay_score or (p_result->'essay'->>'earned_points')::integer is distinct from earned or
    (p_result->'essay'->>'max_points')::integer is distinct from maximum or (p_result->>'total_score')::numeric is distinct from total then raise exception 'INVALID_ESSAY_RESULT'; end if;
  report:=jsonb_build_object('schema_version',1,'quiz',app.quiz_result_json,'essay',p_result->'essay','quiz_weight',40,'essay_weight',60,'total_score',total);
  update public.applications set status='EVALUATED',interview_evaluation_json=report,interview_score=total where id=app.id;
  update public.ai_tasks set state='SUCCEEDED',finished_at=clock_timestamp(),error_code=null,lease_owner=null,lease_until=null where id=p_task;
  select owner_user_id into owner_id from public.jobs where id=app.job_id;
  foreach recipient in array array[app.candidate_user_id,owner_id] loop
    insert into public.messages(recipient_user_id,application_id,kind,event_key,subject,body,payload_json)
      values(recipient,app.id,'APPLICATION_EVALUATED',app.id::text || ':evaluated:' || recipient::text,'Đã có kết quả bài thi',
        'Điểm bài thi: ' || total::text || '/100. Hồ sơ đang chờ nhà tuyển dụng phản hồi.',jsonb_build_object('application_id',app.id,'cv_score',app.cv_score,'interview_score',total)) on conflict(event_key) do nothing;
  end loop;
  insert into public.audit_events(application_id,event_type,from_state,to_state,metadata_json) values(app.id,'INTERVIEW_EVALUATED','INTERVIEW_IN_PROGRESS','EVALUATED',jsonb_build_object('task_id',p_task,'model',task.model,'prompt_version',task.prompt_version));
  return true;
end;
$$;

create function public.lc_essay_task(p_actor uuid,p_application uuid) returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',t.id,'job_id',a.job_id,'application_id',a.id,'kind','EVALUATE_ESSAY','state',t.state,'attempt',t.network_attempts,'max_attempts',3,
    'next_retry_at',case when t.state='RETRY_WAIT' then t.available_at else null end,'error_code',t.error_code,'updated_at',t.updated_at,
    'can_retry',t.state='FAILED' and a.status='INTERVIEW_IN_PROGRESS' and a.interview_submitted_at is not null and a.interview_score is null and
      (select count(*) from public.ai_tasks x where x.application_id=a.id and x.kind='EVALUATE_ESSAY' and x.generation>1 and x.created_at>now()-interval '24 hours')<2)
  from public.applications a join public.jobs j on j.id=a.job_id
  join lateral (select * from public.ai_tasks where application_id=a.id and kind='EVALUATE_ESSAY' order by generation desc limit 1) t on true
  where a.id=p_application and (a.candidate_user_id=p_actor or j.owner_user_id=p_actor);
$$;

create function public.lc_retry_essay(p_actor uuid,p_task uuid,p_key text,p_hash text,p_model text,p_prompt_version text) returns jsonb language plpgsql set search_path = '' as $$
declare app public.applications%rowtype; old_task public.ai_tasks%rowtype; target uuid; saved uuid; new_id uuid; gen integer;
begin
  select application_id into target from public.ai_tasks where id=p_task and kind='EVALUATE_ESSAY';
  select * into app from public.applications where id=target for update;
  if not found or not(app.candidate_user_id=p_actor or exists(select 1 from public.jobs where id=app.job_id and owner_user_id=p_actor)) then raise exception 'NOT_FOUND'; end if;
  saved:=public.lc_idempotent(p_actor,'essay.retry:' || p_task::text,p_key,p_hash);
  if saved is not null then return jsonb_build_object('task_id',saved,'application_id',app.id); end if;
  select * into old_task from public.ai_tasks where id=p_task for update;
  if old_task.state<>'FAILED' or app.status<>'INTERVIEW_IN_PROGRESS' or app.interview_submitted_at is null or app.interview_score is not null or
    exists(select 1 from public.ai_tasks where application_id=app.id and kind='EVALUATE_ESSAY' and generation>old_task.generation) then raise exception 'TASK_NOT_RETRYABLE'; end if;
  if (select count(*) from public.ai_tasks where application_id=app.id and kind='EVALUATE_ESSAY' and generation>1 and created_at>now()-interval '24 hours')>=2 then raise exception 'ESSAY_RETRY_LIMITED'; end if;
  if length(btrim(coalesce(p_model,''))) not between 1 and 200 or p_prompt_version is null then raise exception 'INVALID_INPUT'; end if;
  select coalesce(max(generation),0)+1 into gen from public.ai_tasks where application_id=app.id and kind='EVALUATE_ESSAY';
  insert into public.ai_tasks(requested_by_user_id,kind,application_id,input_version,generation,model,prompt_version)
    values(p_actor,'EVALUATE_ESSAY',app.id,app.answer_version+1,gen,p_model,p_prompt_version) returning id into new_id;
  insert into public.idempotency_keys(user_id,operation,key,request_hash,resource_id,response_status) values(p_actor,'essay.retry:' || p_task::text,p_key,p_hash,new_id,202);
  insert into public.audit_events(actor_user_id,application_id,event_type,metadata_json) values(p_actor,app.id,'ESSAY_EVALUATION_RETRIED',jsonb_build_object('task_id',new_id));
  return jsonb_build_object('task_id',new_id,'application_id',app.id);
end;
$$;

create or replace function public.lc_list_applications(p_actor uuid,p_job uuid,p_status text,p_before_time timestamptz,p_before_id uuid,p_limit integer) returns jsonb language plpgsql stable set search_path = '' as $$
declare result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 50 or ((p_before_time is null)<>(p_before_id is null)) or
    (p_status is not null and p_status not in ('CV_SUBMITTED','CV_PASSED','CV_FAILED','INTERVIEW_IN_PROGRESS','EVALUATED','HR_APPROVED','HR_REJECTED')) then raise exception 'INVALID_INPUT'; end if;
  if p_job is not null and not exists(select 1 from public.jobs where id=p_job and owner_user_id=p_actor) then raise exception 'NOT_FOUND'; end if;
  select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) into result from (
    select a.created_at,a.id,jsonb_build_object('id',a.id,'job_id',a.job_id,'job_title',a.job_snapshot_json->'jd'->>'title','candidate_name',u.display_name,
      'status',a.status,'cv_score',a.cv_score,'interview_score',a.interview_score,'created_at',a.created_at) item
    from public.applications a join public.users u on u.id=a.candidate_user_id
    where (case when p_job is null then a.candidate_user_id=p_actor else a.job_id=p_job end) and
      (p_status is null or a.status=p_status) and (p_before_time is null or (a.created_at,a.id)<(p_before_time,p_before_id))
    order by a.created_at desc,a.id desc limit p_limit+1
  ) x;return result;
end;
$$;

-- Every new function remains server/worker only, including the private grading source.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'lc\_%' escape '\' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end;
$$;
commit;
