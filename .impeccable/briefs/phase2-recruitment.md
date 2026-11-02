# Phase 2 — recruitment workspace

Operate mode; extends the existing LocCV system in DESIGN.md without a new brand/world or token change. User authorized Phase 2 of docs/04_IMPLEMENTATION_PLAN.md: AI drafts, HR review and editing, publication/closure, public job search. Existing Be Vietnam Pro, forest-green shell, warm background, flat separators and standard forms remain authoritative.

Surfaces: HR list/new job/editor/detail plus anonymous job search/detail. Editor separates JD, CV rubric, assessment and preview in accessible arrow-key tabs. Correct answers are HR-only. Persisted task progress replaces made-up progress percentages. Published content is immutable; closing is confirmed inline. Search is a standard GET form with stable pagination and explicit empty/error states.

Required captures: .impeccable/review/phase2-editor-desktop.png (1440×960), phase2-editor-mobile.png (390×844), phase2-jobs-desktop.png (1440×960), phase2-jobs-mobile.png (390×844). All job data is explicitly labeled test data. No approved image comp and no photographic assets are needed. Review against the incumbent system and craft floor, preserving DESIGN.md and design.json.

Implementation: src/components/job-editor.tsx, rubric-editor.tsx, assessment-editor.tsx, new-job-form.tsx, task-progress.tsx and HR/public route groups. Queue/worker and HTTP Nine Router client are tested independently; end-to-end runs the production worker against a real migrated PGlite database through a test-only HTTP adapter, mocking only Auth and Nine Router transport. The live Nine Router generation also succeeded with ag/gemini-3.8-flash and explicit stream:false; project Supabase deployment remains external configuration.
