// Generated from SQL migrations by npm run db:types:local. Do not edit.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = { public: { Tables: {
  ai_tasks: {
    Row: {
      id: string;
      requested_by_user_id: string;
      kind: string;
      job_id: string | null;
      application_id: string | null;
      input_version: number;
      generation: number;
      state: string;
      network_attempts: number;
      available_at: string;
      lease_owner: string | null;
      lease_until: string | null;
      error_code: string | null;
      model: string;
      prompt_version: string;
      created_at: string;
      updated_at: string;
      finished_at: string | null;
    };
    Insert: {
      id?: string;
      requested_by_user_id: string;
      kind: string;
      job_id?: string | null;
      application_id?: string | null;
      input_version: number;
      generation?: number;
      state?: string;
      network_attempts?: number;
      available_at?: string;
      lease_owner?: string | null;
      lease_until?: string | null;
      error_code?: string | null;
      model: string;
      prompt_version: string;
      created_at?: string;
      updated_at?: string;
      finished_at?: string | null;
    };
    Update: {
      id?: string;
      requested_by_user_id?: string;
      kind?: string;
      job_id?: string | null;
      application_id?: string | null;
      input_version?: number;
      generation?: number;
      state?: string;
      network_attempts?: number;
      available_at?: string;
      lease_owner?: string | null;
      lease_until?: string | null;
      error_code?: string | null;
      model?: string;
      prompt_version?: string;
      created_at?: string;
      updated_at?: string;
      finished_at?: string | null;
    };
    Relationships: [];
  };
  applications: {
    Row: {
      id: string;
      job_id: string;
      candidate_user_id: string;
      status: string;
      version: number;
      job_snapshot_json: Json;
      cv_source: string;
      cv_storage_path: string | null;
      cv_sha256: string;
      cv_text: string;
      ai_processing_acknowledged_at: string;
      cv_evaluation_json: Json | null;
      cv_score: number | null;
      interview_started_at: string | null;
      interview_deadline_at: string | null;
      candidate_answers_json: Json;
      answer_version: number;
      interview_submitted_at: string | null;
      submission_reason: string | null;
      quiz_result_json: Json | null;
      interview_evaluation_json: Json | null;
      interview_score: number | null;
      hr_decision_message: string | null;
      hr_decided_by_user_id: string | null;
      hr_decided_at: string | null;
      created_at: string;
      updated_at: string;
      purge_pending_at: string | null;
    };
    Insert: {
      id?: string;
      job_id: string;
      candidate_user_id: string;
      status?: string;
      version?: number;
      job_snapshot_json: Json;
      cv_source: string;
      cv_storage_path?: string | null;
      cv_sha256: string;
      cv_text: string;
      ai_processing_acknowledged_at: string;
      cv_evaluation_json?: Json | null;
      cv_score?: number | null;
      interview_started_at?: string | null;
      interview_deadline_at?: string | null;
      candidate_answers_json?: Json;
      answer_version?: number;
      interview_submitted_at?: string | null;
      submission_reason?: string | null;
      quiz_result_json?: Json | null;
      interview_evaluation_json?: Json | null;
      interview_score?: number | null;
      hr_decision_message?: string | null;
      hr_decided_by_user_id?: string | null;
      hr_decided_at?: string | null;
      created_at?: string;
      updated_at?: string;
      purge_pending_at?: string | null;
    };
    Update: {
      id?: string;
      job_id?: string;
      candidate_user_id?: string;
      status?: string;
      version?: number;
      job_snapshot_json?: Json;
      cv_source?: string;
      cv_storage_path?: string | null;
      cv_sha256?: string;
      cv_text?: string;
      ai_processing_acknowledged_at?: string;
      cv_evaluation_json?: Json | null;
      cv_score?: number | null;
      interview_started_at?: string | null;
      interview_deadline_at?: string | null;
      candidate_answers_json?: Json;
      answer_version?: number;
      interview_submitted_at?: string | null;
      submission_reason?: string | null;
      quiz_result_json?: Json | null;
      interview_evaluation_json?: Json | null;
      interview_score?: number | null;
      hr_decision_message?: string | null;
      hr_decided_by_user_id?: string | null;
      hr_decided_at?: string | null;
      created_at?: string;
      updated_at?: string;
      purge_pending_at?: string | null;
    };
    Relationships: [];
  };
  audit_events: {
    Row: {
      id: string;
      actor_user_id: string | null;
      job_id: string | null;
      application_id: string | null;
      event_type: string;
      from_state: string | null;
      to_state: string | null;
      metadata_json: Json;
      created_at: string;
    };
    Insert: {
      id?: string;
      actor_user_id?: string | null;
      job_id?: string | null;
      application_id?: string | null;
      event_type: string;
      from_state?: string | null;
      to_state?: string | null;
      metadata_json?: Json;
      created_at?: string;
    };
    Update: {
      id?: string;
      actor_user_id?: string | null;
      job_id?: string | null;
      application_id?: string | null;
      event_type?: string;
      from_state?: string | null;
      to_state?: string | null;
      metadata_json?: Json;
      created_at?: string;
    };
    Relationships: [];
  };
  cv_uploads: {
    Row: {
      id: string;
      owner_user_id: string;
      source: string;
      storage_path: string;
      state: string;
      extracted_text: string | null;
      parse_token: string | null;
      parse_started_at: string | null;
      used_at: string | null;
      created_at: string;
      expires_at: string;
      purge_pending_at: string | null;
    };
    Insert: {
      id: string;
      owner_user_id: string;
      source: string;
      storage_path: string;
      state?: string;
      extracted_text?: string | null;
      parse_token?: string | null;
      parse_started_at?: string | null;
      used_at?: string | null;
      created_at?: string;
      expires_at?: string;
      purge_pending_at?: string | null;
    };
    Update: {
      id?: string;
      owner_user_id?: string;
      source?: string;
      storage_path?: string;
      state?: string;
      extracted_text?: string | null;
      parse_token?: string | null;
      parse_started_at?: string | null;
      used_at?: string | null;
      created_at?: string;
      expires_at?: string;
      purge_pending_at?: string | null;
    };
    Relationships: [];
  };
  idempotency_keys: {
    Row: {
      user_id: string;
      operation: string;
      key: string;
      request_hash: string;
      resource_id: string;
      response_status: number;
      created_at: string;
      expires_at: string;
    };
    Insert: {
      user_id: string;
      operation: string;
      key: string;
      request_hash: string;
      resource_id: string;
      response_status: number;
      created_at?: string;
      expires_at?: string;
    };
    Update: {
      user_id?: string;
      operation?: string;
      key?: string;
      request_hash?: string;
      resource_id?: string;
      response_status?: number;
      created_at?: string;
      expires_at?: string;
    };
    Relationships: [];
  };
  jobs: {
    Row: {
      id: string;
      owner_user_id: string;
      status: string;
      version: number;
      raw_hr_prompt: string | null;
      jd_json: Json | null;
      title: string | null;
      skills: string[];
      location: string | null;
      salary_min: number | null;
      salary_max: number | null;
      salary_currency: string;
      salary_period: string;
      scoring_rubric_json: Json | null;
      interview_questions_json: Json | null;
      interview_access_policy: string;
      approved_by_user_id: string | null;
      published_at: string | null;
      closed_at: string | null;
      created_at: string;
      updated_at: string;
      search_vector: string | null;
      search_document: string | null;
    };
    Insert: {
      id?: string;
      owner_user_id: string;
      status?: string;
      version?: number;
      raw_hr_prompt?: string | null;
      jd_json?: Json | null;
      title?: string | null;
      skills?: string[];
      location?: string | null;
      salary_min?: number | null;
      salary_max?: number | null;
      salary_currency?: string;
      salary_period?: string;
      scoring_rubric_json?: Json | null;
      interview_questions_json?: Json | null;
      interview_access_policy?: string;
      approved_by_user_id?: string | null;
      published_at?: string | null;
      closed_at?: string | null;
      created_at?: string;
      updated_at?: string;
      search_vector?: never;
      search_document?: never;
    };
    Update: {
      id?: string;
      owner_user_id?: string;
      status?: string;
      version?: number;
      raw_hr_prompt?: string | null;
      jd_json?: Json | null;
      title?: string | null;
      skills?: string[];
      location?: string | null;
      salary_min?: number | null;
      salary_max?: number | null;
      salary_currency?: string;
      salary_period?: string;
      scoring_rubric_json?: Json | null;
      interview_questions_json?: Json | null;
      interview_access_policy?: string;
      approved_by_user_id?: string | null;
      published_at?: string | null;
      closed_at?: string | null;
      created_at?: string;
      updated_at?: string;
      search_vector?: never;
      search_document?: never;
    };
    Relationships: [];
  };
  messages: {
    Row: {
      id: string;
      recipient_user_id: string;
      actor_user_id: string | null;
      application_id: string;
      kind: string;
      event_key: string;
      subject: string;
      body: string;
      payload_json: Json;
      read_at: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      recipient_user_id: string;
      actor_user_id?: string | null;
      application_id: string;
      kind: string;
      event_key: string;
      subject: string;
      body: string;
      payload_json?: Json;
      read_at?: string | null;
      created_at?: string;
    };
    Update: {
      id?: string;
      recipient_user_id?: string;
      actor_user_id?: string | null;
      application_id?: string;
      kind?: string;
      event_key?: string;
      subject?: string;
      body?: string;
      payload_json?: Json;
      read_at?: string | null;
      created_at?: string;
    };
    Relationships: [];
  };
  users: {
    Row: {
      id: string;
      display_name: string;
      preferred_mode: string;
      timezone: string;
      created_at: string;
      updated_at: string;
      deletion_requested_at: string | null;
    };
    Insert: {
      id: string;
      display_name: string;
      preferred_mode?: string;
      timezone?: string;
      created_at?: string;
      updated_at?: string;
      deletion_requested_at?: string | null;
    };
    Update: {
      id?: string;
      display_name?: string;
      preferred_mode?: string;
      timezone?: string;
      created_at?: string;
      updated_at?: string;
      deletion_requested_at?: string | null;
    };
    Relationships: [];
  };
}; Views: { [_ in never]: never }; Functions: {
  lc_application_task: { Args: {
    p_actor: string | null;
    p_application: string | null;
  }; Returns: Json; };
  lc_apply: { Args: {
    p_actor: string | null;
    p_job: string | null;
    p_source: string | null;
    p_upload: string | null;
    p_text: string | null;
    p_ack: boolean | null;
    p_key: string | null;
    p_hash: string | null;
    p_model: string | null;
    p_prompt_version: string | null;
  }; Returns: Json; };
  lc_begin_attempt: { Args: {
    p_task: string | null;
    p_lease: string | null;
    p_attempt: number | null;
  }; Returns: boolean; };
  lc_begin_cv_extraction: { Args: {
    p_actor: string | null;
    p_upload: string | null;
    p_token: string | null;
  }; Returns: Json; };
  lc_claim_purge: { Args: {
    p_limit: number | null;
    p_retention: boolean | null;
  }; Returns: Json; };
  lc_claim_task: { Args: {
    p_lease: string | null;
  }; Returns: Json; };
  lc_close_job: { Args: {
    p_actor: string | null;
    p_job: string | null;
    p_version: number | null;
  }; Returns: Json; };
  lc_complete_cv: { Args: {
    p_task: string | null;
    p_lease: string | null;
    p_result: Json | null;
  }; Returns: boolean; };
  lc_complete_essay: { Args: {
    p_task: string | null;
    p_lease: string | null;
    p_result: Json | null;
  }; Returns: boolean; };
  lc_complete_job: { Args: {
    p_task: string | null;
    p_lease: string | null;
    p_result: Json | null;
  }; Returns: boolean; };
  lc_create_job: { Args: {
    p_actor: string | null;
    p_prompt: string | null;
    p_generate: boolean | null;
    p_key: string | null;
    p_hash: string | null;
    p_model: string | null;
    p_prompt_version: string | null;
  }; Returns: Json; };
  lc_cv_download: { Args: {
    p_actor: string | null;
    p_application: string | null;
  }; Returns: Json; };
  lc_decide_application: { Args: {
    p_actor: string | null;
    p_application: string | null;
    p_version: number | null;
    p_decision: string | null;
    p_message: string | null;
  }; Returns: Json; };
  lc_deletion_candidates: { Args: {
    p_limit: number | null;
  }; Returns: Json; };
  lc_deletion_request: { Args: {
    p_actor: string | null;
    p_requested: boolean | null;
  }; Returns: Json; };
  lc_due_interviews: { Args: {
    p_limit: number | null;
  }; Returns: Json; };
  lc_essay_task: { Args: {
    p_actor: string | null;
    p_application: string | null;
  }; Returns: Json; };
  lc_fail_task: { Args: {
    p_task: string | null;
    p_lease: string | null;
    p_code: string | null;
  }; Returns: boolean; };
  lc_finish_cv_extraction: { Args: {
    p_actor: string | null;
    p_upload: string | null;
    p_token: string | null;
    p_text: string | null;
  }; Returns: boolean; };
  lc_finish_purge: { Args: {
    p_kind: string | null;
    p_id: string | null;
  }; Returns: boolean; };
  lc_generate_job: { Args: {
    p_actor: string | null;
    p_job: string | null;
    p_version: number | null;
    p_prompt: string | null;
    p_key: string | null;
    p_hash: string | null;
    p_model: string | null;
    p_prompt_version: string | null;
    p_retry_task: string | null;
  }; Returns: Json; };
  lc_heartbeat: { Args: {
    p_task: string | null;
    p_lease: string | null;
  }; Returns: boolean; };
  lc_hr_summary: { Args: {
    p_actor: string | null;
    p_job: string | null;
  }; Returns: Json; };
  lc_idempotent: { Args: {
    p_actor: string | null;
    p_operation: string | null;
    p_key: string | null;
    p_hash: string | null;
  }; Returns: string; };
  lc_inbox: { Args: {
    p_actor: string | null;
    p_before_time: string | null;
    p_before_id: string | null;
    p_limit: number | null;
    p_unread: boolean | null;
  }; Returns: Json; };
  lc_interview_dto: { Args: {
    p_actor: string | null;
    p_application: string | null;
  }; Returns: Json; };
  lc_list_applications: { Args: {
    p_actor: string | null;
    p_job: string | null;
    p_status: string | null;
    p_before_time: string | null;
    p_before_id: string | null;
    p_limit: number | null;
  }; Returns: Json; };
  lc_list_hr_jobs: { Args: {
    p_actor: string | null;
    p_status: string | null;
    p_before_time: string | null;
    p_before_id: string | null;
    p_limit: number | null;
  }; Returns: Json; };
  lc_message: { Args: {
    p_actor: string | null;
    p_message: string | null;
    p_read: boolean | null;
  }; Returns: Json; };
  lc_normalize: { Args: {
    p_text: string | null;
  }; Returns: string; };
  lc_operations: { Args: Record<string, never>; Returns: Json; };
  lc_prepare_submission: { Args: {
    p_actor: string | null;
    p_application: string | null;
    p_timeout: boolean | null;
  }; Returns: Json; };
  lc_public_job: { Args: {
    p_job: string | null;
  }; Returns: Json; };
  lc_publish_job: { Args: {
    p_actor: string | null;
    p_job: string | null;
    p_version: number | null;
  }; Returns: Json; };
  lc_reserve_cv_upload: { Args: {
    p_actor: string | null;
    p_id: string | null;
    p_source: string | null;
  }; Returns: string; };
  lc_retry_cv: { Args: {
    p_actor: string | null;
    p_task: string | null;
    p_key: string | null;
    p_hash: string | null;
    p_model: string | null;
    p_prompt_version: string | null;
  }; Returns: Json; };
  lc_retry_essay: { Args: {
    p_actor: string | null;
    p_task: string | null;
    p_key: string | null;
    p_hash: string | null;
    p_model: string | null;
    p_prompt_version: string | null;
  }; Returns: Json; };
  lc_retry_wait: { Args: {
    p_task: string | null;
    p_lease: string | null;
    p_next: string | null;
    p_code: string | null;
  }; Returns: boolean; };
  lc_save_answers: { Args: {
    p_actor: string | null;
    p_application: string | null;
    p_version: number | null;
    p_answers: Json | null;
  }; Returns: Json; };
  lc_save_job: { Args: {
    p_actor: string | null;
    p_job: string | null;
    p_version: number | null;
    p_draft: Json | null;
  }; Returns: Json; };
  lc_search_jobs: { Args: {
    p_q: string | null;
    p_skill: string | null;
    p_min: number | null;
    p_max: number | null;
    p_before_time: string | null;
    p_before_id: string | null;
    p_limit: number | null;
  }; Returns: Json; };
  lc_start_interview: { Args: {
    p_actor: string | null;
    p_application: string | null;
  }; Returns: Json; };
  lc_submit_interview: { Args: {
    p_actor: string | null;
    p_application: string | null;
    p_version: number | null;
    p_quiz: Json | null;
    p_model: string | null;
    p_prompt_version: string | null;
    p_timeout: boolean | null;
  }; Returns: Json; };
  lc_validate_answers: { Args: {
    p_answers: Json | null;
    p_questions: Json | null;
  }; Returns: undefined; };
  lc_validate_content: { Args: {
    p_jd: Json | null;
    p_rubric: Json | null;
    p_questions: Json | null;
  }; Returns: undefined; };
}; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } };
