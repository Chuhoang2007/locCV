# Phase 1 account surface

Mode: Operate. Code-led implementation, no approved raster comp. Product and scope come from `PRODUCT.md` and the user's authorization to implement Phase 1 of `docs/04_IMPLEMENTATION_PLAN.md`. No separate aesthetic preference was provided; visual choices are implementation defaults, not claimed user approvals.

Direction: an approachable shared professional workspace. Forest-green auth panel and pale green navigation give the two roles a common home; the identity diagram is the signature, showing one account connecting two modes. Standard web forms and navigation remain familiar. Neutral warm ground, deliberate whitespace, thin separators and self-hosted Be Vietnam Pro support Vietnamese text. Seven grounding options considered are professional directories, correspondence, shared workspaces, research notebooks, career guides, connected portfolios and onboarding booklets; the connected-portfolio direction supplies the signature. Seed reference: seed:e51c4e1ab5aed5a6.

Contract: task labels must be clear, signup/login/recovery usable, account identity constant across mode switches, state changes persisted via server. Auth errors/success/pending and configuration absence are honest. No fabricated live jobs or metrics. Keyboard focus visible, label-associated errors, reduced motion, no horizontal overflow at 390px. Desktop 1440×960 and mobile 390×844 are required viewports.

Implementation: `src/app/globals.css`, `src/components/auth-shell.tsx`, auth-form.tsx, navigation.tsx, mode-switch.tsx, profile-form.tsx and protected settings/home pages. Existing four docs remain authoritative for business behavior. Account screenshots contain explicitly marked fixture users; HTTP Auth/PostgREST is mocked only in tests. Production Supabase connection is unverified because no project configuration was supplied.

Evidence: `.impeccable/review/desktop.png`, mobile.png, settings-desktop.png, settings-mobile.png. Detector on src/app and src/components returned `[]`. Axe WCAG A/AA desktop auth/settings passes after darkening footer text; E2E verifies mobile overflow and all account flows. No photographic assets are appropriate to these forms.
