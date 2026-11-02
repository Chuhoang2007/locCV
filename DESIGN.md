---
name: LocCV
description: A shared professional workspace for one account and two modes.
colors:
  background: "#f8f9f5"
  foreground: "#23382f"
  primary: "#24543f"
  pine: "#173f35"
  pine-deep: "#12362d"
  lime: "#daedb5"
  muted: "#64706a"
  border: "#dbe1d7"
  surface: "#fff"
  error: "#a33035"
  input-border: "#cfd8cb"
  focus: "#5a876b"
  input-focus: "#a8c598"
  sidebar: "#eef2e9"
  nav-active: "#dce9cc"
  secondary-hover: "#eef3e8"
  ghost: "#526259"
  ghost-hover: "#e9eee4"
typography:
  display:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "clamp(35px,3.2vw,49px)"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "-.035em"
  headline:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "clamp(24px,2.1vw,30px)"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.035em"
  title:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "27px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.03em"
  body:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: '"Be Vietnam Pro", sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.65
rounded:
  compact: "5px"
  badge: "6px"
  control: "8px"
  surface: "12px"
  circle: "50%"
spacing:
  "8": "8px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "20": "20px"
  "22": "22px"
  "24": "24px"
  "25": "25px"
  "28": "28px"
  "34": "34px"
  "40": "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
  button-primary-hover:
    backgroundColor: "{colors.pine-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.pine}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ghost}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
  button-ghost-hover:
    backgroundColor: "{colors.ghost-hover}"
    textColor: "{colors.pine}"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "49px"
    width: "100%"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    rounded: "{rounded.control}"
    padding: "12px 13px"
  account-badge:
    rounded: "{rounded.badge}"
    padding: "5px 9px"
  empty-state:
    rounded: "{rounded.surface}"
    padding: "40px 22px"
  mode-switch:
    rounded: "{rounded.control}"
    padding: "4px"
  identity-node:
    rounded: "9px"
    padding: "13px 18px"
---

# Design System: LocCV

## Overview

**Creative North Star: "The Shared Professional Workspace"**

LocCV uses a calm, approachable professional workspace to connect one identity with two modes. Forest-green framing, pale green navigation and a warm neutral ground establish continuity across authentication and account settings. This records the implemented direction; it is not a separately approved brand identity.

The interface gives Vietnamese forms deliberate whitespace and compact supporting text. Its signature is the shared-account diagram: one identity node connects to two equal role branches. Functional controls and honest account states remain the center of the experience.

**Key Characteristics:**
- Forest-green anchors with pale green supporting surfaces.
- Self-hosted Vietnamese typography and restrained weight contrast.
- Flat sections, thin separators and softly rounded controls.
- One visual identity across candidate and recruiter modes.

## Colors

The palette combines deep botanical greens with a warm near-white ground; the frontmatter preserves the source CSS values.

### Primary
- **Professional Forest** (`primary`): primary actions, form links and caret color.
- **Pine Anchor** (`pine`): authentication story panel, selected mode and brand mark.
- **Deep Pine** (`pine-deep`): primary-button hover and selected-text contrast.
- **Pale Lime** (`lime`): emphasis on the dark story panel and identity markers.

### Neutral
- **Warm Ground** (`background`): the page canvas.
- **White Surface** (`surface`): inputs and secondary buttons.
- **Forest Ink** (`foreground`): default text.
- **Quiet Green Gray** (`muted`): descriptions, hints and supporting copy.
- **Soft Divider** (`border`) and **Field Edge** (`input-border`): section boundaries and editable-field outlines.
- **Pale Workspace** (`sidebar`) and **Selected Leaf** (`nav-active`): navigation context and current location.
- **Secondary Wash** (`secondary-hover`), **Quiet Action** (`ghost`) and **Ghost Wash** (`ghost-hover`): restrained action states.
- **Focus Green** (`focus`) and **Field Focus** (`input-focus`): visible keyboard focus.

Errors use `error` with explanatory text. Additional component-specific tones remain literal CSS in the sidecar rather than expanding the shared palette.

**The Shared Identity Rule.** Keep the same green palette when the account changes mode; selection communicates context without assigning a new brand to each role.

## Typography

**Display Font:** Be Vietnam Pro, with sans-serif fallback.
**Body Font:** Be Vietnam Pro, with sans-serif fallback.

Self-hosted Vietnamese and Latin subsets provide regular, medium, semibold and bold weights. Rounded letterforms and moderate weight contrast keep a professional tone while supporting Vietnamese diacritics. The observed hierarchy is role-based rather than a single mathematical scale.

### Hierarchy
- **Display:** the responsive story headline; its exact range, weight and generous line-height are recorded in frontmatter.
- **Headline:** authentication page titles; at the tablet breakpoint they become (29px), and on narrow screens (26px).
- **Title:** account page titles; narrow screens use (23px). Section/profile titles use (17px), with compact settings labels at (13px).
- **Body:** the base reading style. Form descriptions commonly use (13px) and settings descriptions (12px), with line-height (1.8) for supporting paragraphs.
- **Label:** field labels and button text. Hints, metadata and status text use the observed (10–12px) supporting range.

**The One Family Rule.** Use Be Vietnam Pro for headings, forms and navigation; distinguish hierarchy through size, spacing and weight.

## Layout

Authentication fills the viewport with two desktop columns: `minmax(360px,.88fr)` and `minmax(500px,1.12fr)`. The story has a bounded text column; the form is capped at (390px). At (860px) and below the story disappears, the brand moves into the form header and the form cap becomes (420px). At (600px) and below the auth workspace uses (23px) horizontal padding.

The account workspace uses a fixed (230px) sidebar and an (81px) header row. Main content has a (1280px) maximum width; settings is capped at (950px), with profile fields capped at (490px). Settings sections pair a (210px) description column with flexible content, reduce to (165px) at (1100px), and stack at (860px). The sidebar narrows to (185px) at that breakpoint.

At (600px) and below, the account layout becomes a vertical flow: header, horizontal navigation, then content. The mode switch spans the header width and its options have a minimum height of (44px). Main content uses (22px) side padding. Forms use vertical groups and thin separators rather than dense boxed cards; common spacing steps are captured in frontmatter.

## Elevation & Depth

The system uses no box shadows. Depth comes from the dark story panel, pale navigation, white fields and fine borders against the warm canvas. Settings are flat sections with dividers; the empty state uses a dashed outline. Focus outlines indicate interaction rather than elevation.

**The Flat Surface Rule.** Preserve tonal layering and thin separators when extending the current workspace.

## Shapes

Controls and navigation have gently curved corners, represented by `rounded.control`. Compact mode options use `rounded.compact`; the account badge uses `rounded.badge`. Empty-state/setup containers use `rounded.surface`, while avatars and status dots are circular. The identity node has its own modest (9px) curve. Borders are generally (1px); the signature uses line connectors and equal branches rather than an illustration asset.

## Components

### Buttons

Compact, confident actions use a minimum height of (44px), centered content, a (9px) icon gap and semibold text at (13px). Frontmatter records the shared padding and radius. The primary variant is green with white text, secondary is white with a soft border, ghost is quiet text on a transparent surface, and danger uses the error color. Small buttons use a (38px) minimum height and (8px 12px) padding; icon buttons are (44px) wide.

Primary, secondary and ghost buttons change background on hover. All retain the global visible-focus outline (3px, offset 4px). Disabled actions use a muted green-gray surface and a not-allowed cursor. The auth submit is full width, at least (49px) high, with its label and arrow separated. Background/color transitions last (.18s).

### Chips

The account badge is an informational outlined label with a small icon, compact (10px) text and a green-gray border. It has no interactive selected state and is hidden at (860px) and below.

### Cards / Containers

Settings sections remain unboxed with bottom dividers. The empty-state container has a dashed (1px) outline, rounded corners, centered copy and no shadow. Notices use a pale tonal fill and compact explanatory text; errors switch to a pale red treatment with explicit words. Do not turn these patterns into an all-purpose raised card.

### Inputs / Fields

Fields use white surfaces, a single thin edge and the height/padding recorded in frontmatter. Hover darkens the edge. Keyboard focus shifts the border to the primary color and adds a (2px) pale green outline with a (1px) offset. Labels sit above fields with an (8px) gap; errors use the error color and `aria-invalid` changes the field border. Password visibility controls sit inside the right edge. Inputs and selects share the same visual treatment.

### Navigation

Desktop navigation is a vertical set of rounded links with small line icons and (12px), medium-weight text. Hover adds a pale wash; the active link uses the selected leaf surface, darker text and `aria-current`. On mobile it becomes a horizontal strip. The adjacent two-option mode switch uses a pine selected segment and `aria-pressed`; at narrow widths both options expand equally.

### Shared-account diagram

One outlined identity node, a downward connector and two equal role branches express the relationship between the account and its modes. Pale lime icons and accents sit on the pine story panel. This is the implemented signature; preserve its account-first meaning when reusing it. It is hidden with the story panel on compact screens.

Motion is limited to short control-state transitions and a linear pending spinner (1s). Reduced-motion preferences shorten animations and transitions to (.01ms) and limit animation iteration to one.

## Do's and Don'ts

### Do:
- **Do** keep account identity and the green visual language consistent across both modes.
- **Do** use self-hosted Be Vietnam Pro with the Vietnamese subset.
- **Do** pair error and success colors with clear text and preserve visible keyboard focus.
- **Do** use responsive stacked settings sections and the mobile horizontal navigation pattern.

### Don't:
- **Don't** replace flat settings sections with shadowed cards.
- **Don't** communicate current mode, validation or account status through color alone.
- **Don't** allow a desktop sidebar or two-column auth composition to force horizontal scrolling on mobile.
- **Don't** add photographic decoration to the existing account-form patterns.
