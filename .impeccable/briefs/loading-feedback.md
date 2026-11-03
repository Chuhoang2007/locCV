# Loading feedback continuation

Mode: Operate. User asks for visible loading when navigating or pressing a function because the application feels frozen. Extend the incumbent UI; preserve DESIGN.md and design.json. This precise state/feedback addition requires no concept or seed round.

THESIS: Acknowledge a real pending action immediately, then replace waiting feedback with the real result without adding artificial delay.

OWN-WORLD: Existing pine, warm canvas, Be Vietnam Pro, flat separators and native button vocabulary. No new imagery, overlays that block work, or decorative entrances.

STORY: Click an internal link or submit an action; see an indeterminate top line and compact loading status while navigation is pending. When a route streams, see neutral placeholders in the content area. Mutation buttons show a spinner and prevent repeat submission; errors restore the controls.

FIRST VIEWPORT: Keep the existing navigation usable. The top progress line occupies fixed space outside layout; the compact status floats at the lower edge without intercepting clicks. Skeleton heading and separated rows reserve the content area, with one accessible status message and decorative bars hidden from screen readers.

FORM: Code-led refinement. Focal moment is the transition from acknowledged click to real page content. Continuity uses Next Link pending state, React transitions and Suspense fallbacks, not network polling or invented percentages. Budget: CSS transform/opacity and existing Lucide icons; no new dependency. Fast navigation has no minimum waiting time. Reduced motion keeps static progress and readable status.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Required desktop 1440×960 and mobile 390×844 evidence: navigation pending, streamed content skeleton, button mutation pending and settled result. Include reduced motion and error recovery checks. Use synthetic accounts and deterministic slow requests in test fixtures only. No shipping raster assets.
