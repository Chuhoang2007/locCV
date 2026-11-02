# Phase 3 — CV screening

Operate mode. A precise extension of the existing application workflow, defined by docs/04_IMPLEMENTATION_PLAN.md §7. Inherit DESIGN.md, Be Vietnam Pro, green controls, flat sections, standard fields and the responsive platform shell. No new visual identity, comps or raster assets.

## Direction contract

THESIS: Show what is actually received and assessed. Extend the existing application guide and empty candidate list with explicit file/text input, confirmed text, acknowledgment and persisted evaluation states.

OWN-WORLD: Existing pine/leaf colors, warm canvas, thin separators, white fields and established button/navigation treatments. No system-token changes.

STORY: Candidate selects a file or pastes text, reviews it and consents before submission; later returns to the same application. HR follows a job's applicant list to evidence and criterion scores. A service failure never reads as rejection.

FIRST VIEWPORT: Application heading and job context precede the file/text choice and its usable input. Tracking opens with the real status and score/summary, then eligibility and the submitted CV. HR detail uses the same reading order with a criterion-by-criterion report. Mobile stacks the same sections without horizontal scrolling.

FORM: Extend existing form, list and detail compositions directly; the detailed Phase 3 specification settles the flow. No open concept round; seed: none (local extension). Signature interaction: the extracted text must be reviewed before sending; persisted task polling survives reload.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Verification: synthetic CVs only; desktop 1440×960 and mobile 390×844 captures of apply, candidate status and HR evidence, plus invalid-file and failed-AI recovery. Axe and browser tests exercise submission, reload, retry, self-apply and access boundaries. Preserve DESIGN.md and .impeccable/design.json.
