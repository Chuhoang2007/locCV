# Phase 4 — Interview continuation

Operate mode; a precise extension of the existing candidate application and HR report workflow. Follow docs/04_IMPLEMENTATION_PLAN.md §8. Inherit DESIGN.md and its sidecar, existing typography, pine controls, warm canvas, thin separators and responsive platform shell. No new world, imagery or token system.

## Direction contract

THESIS: Let candidates work with confidence in what the server has received. Keep remaining time, save status and submission state distinct; browser time and cached answers never define the result.

OWN-WORLD: Existing Be Vietnam Pro, green controls, flat rows, white fields, visible keyboard focus and restrained notices. Error recovery uses the same button and notice vocabulary as Phase 3.

STORY: Read duration and one-attempt rules; explicitly start; answer quiz and essay with autosave; recover consciously from offline storage or conflicts; confirm submission; return to separate CV/quiz/essay/total scores. HR reads answers and evidence in the existing report.

FIRST VIEWPORT: Job context above a compact timer/save/action band. A question navigator sits beside a single active question on desktop and becomes a wrapped strip on mobile. Submit confirmation is inline and names unanswered questions. Before start, only instructions and the start action appear. After submit, the page explains that answers are locked and links to real persisted results.

FORM: Directly extend the specified application/detail forms and task flow. No concept round or comp; seed: none (precise workflow extension). Signature interaction: server-confirmed saves remain separate from unsynchronized local edits, with explicit recovery and conflict choices.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Required captures: phase4-prestart, runner, conflict/recovery, submitted and HR/candidate results on desktop 1440×960 and mobile 390×844. Synthetic data only; no shipping raster assets. Keep DESIGN.md and .impeccable/design.json unchanged. Test keyboard, focus, overflow, errors, multi-tab, offline recovery, reload, timeout and payload secrecy.
