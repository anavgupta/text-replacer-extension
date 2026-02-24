# ReText Extension — Vision & Roadmap

> Product and engineering roadmap for the ReText Chrome/Edge text replacement extension.
> Last updated: 2026-02-24

---

## Current State (v2.0.0)

ReText is a Manifest V3 browser extension that finds and replaces text on web pages with configurable rules. It supports regex patterns, scoped rules, rule groups, whole-word matching, import/export (JSON + CSV), and a dark mode UI.

**Test suite:** 252 unit tests — all passing.

---

## Feature Inventory

### Proposed Features

| ID | Feature | SP | Complexity | Productivity | Description |
|----|---------|---:|------------|--------------|-------------|
| F1 | Debounced MutationObserver | 2 | Low | High | Throttle DOM observer to prevent lag on SPAs |
| F2 | Storage sync→local fallback | 3 | Medium | High | Edge users get zero functionality without this |
| F3 | Case-sensitive matching option | 2 | Low | Medium | Needed for code/technical content |
| F4 | Regex mode | 5 | High | High | Power-user feature with capture groups |
| F5 | Rule ordering / drag-and-drop | 5 | High | Medium | Matters when rules conflict |
| F6 | Undo delete | 3 | Medium | High | Prevents accidental data loss |
| F7 | Rule groups / folders | 8 | High | Medium | Organization at scale (50+ rules) |
| F8 | Replacement preview / dry-run | 8 | Very High | High | Requires content script highlight mode |
| F9 | Statistics dashboard | 5 | Medium | Low | Analytics on replacement counts |
| F10 | Context menu integration | 3 | Medium | High | Fastest rule creation flow |
| F11 | Cloud sync / profile sharing | 13 | Very High | Medium | Requires backend service |
| F12 | Skip script/style/textarea nodes | 1 | Low | Critical | Prevents breaking page JS/CSS |

### Tech Debt

| ID | Issue | SP | Severity | Description |
|----|-------|---:|----------|-------------|
| TD1 | Debounce MutationObserver | 2 | High | No debounce = performance hazard on SPA pages |
| TD2 | Duplicated logic (source/tests) | 3 | Medium | Shared module needs build tooling |
| TD3 | Stale dist/ folder | 2 | High | Loading it gives broken v1.0.0 |
| TD4 | Missing error handling in popup | 1 | Medium | Silent failures confuse users |
| TD5 | Native alert()/confirm() dialogs | 3 | Low | Blocks UI, ugly, no customization |
| TD6 | No accessibility (a11y) | 3 | Medium | Keyboard users and screen readers excluded |
| TD7 | Hardcoded colors, no CSS vars | 2 | Low | Blocks theming / dark mode |
| TD8 | Outdated README + dev guide | 2 | Low | Misleading documentation |

---

## Prioritized Backlog (4 Tiers)

### Tier 1: Critical (Sprint 1 — 11 SP)

Items with the highest impact-to-effort ratio: bugs, performance hazards, and feature breakage.

| # | Item | SP | Justification | Status |
|---|------|---:|---------------|--------|
| 1 | TD1: Debounce MutationObserver | 2 | Performance — prevents lag and infinite loops on SPAs | **DONE** |
| 2 | F12: Skip script/style/textarea nodes | 1 | Correctness — prevents breaking page JS | **DONE** |
| 3 | TD3: Fix or remove stale dist/ | 2 | Correctness — stale dist is a trap | **DONE** |
| 4 | TD4: Error handling in popup.js | 1 | Reliability — silent failures confuse users | **DONE** |
| 5 | F2: Storage sync→local fallback | 3 | Edge users get zero functionality without this | **DONE** |
| 6 | TD8: Update README + dev guide | 2 | Onboarding — docs were misleading | **DONE** |

### Tier 2: High Value (Sprint 2 — 10 SP)

Most user-facing value per SP. Context menu is a workflow accelerator. Undo replaces the worst UX pattern. A11y is the right thing to do.

| # | Item | SP | Justification | Status |
|---|------|---:|---------------|--------|
| 7 | F10: Context menu "Create rule" | 3 | Fastest rule creation — eliminates manual popup workflow | **DONE** |
| 8 | F3: Case-sensitive option | 2 | Needed for code/technical content | **SKIPPED** (user decision) |
| 9 | F6: Undo delete (toast) | 3 | Prevents accidental data loss; replaces confirm() dialog | **DONE** |
| 10 | TD6: Accessibility fixes | 3 | ARIA, labels, focus trap — important for keyboard users | **DONE** |

### Tier 3: Nice-to-Have (Sprint 3 — 15 SP)

Enhancements and polish. Not necessities.

| # | Item | SP | Justification | Status |
|---|------|---:|---------------|--------|
| 11 | F4: Regex mode | 5 | Power-user feature; high value for those who need it | **DONE** |
| 12 | F5: Rule ordering / drag-and-drop | 5 | Matters when rules conflict; medium productivity gain | **SKIPPED** (user decision) |
| 13 | TD5: Replace alert/confirm with toasts | 3 | UI polish; removes last native dialog dependency | **DONE** |
| 14 | TD7: CSS variables / dark mode prep | 2 | Low effort, enables theming | **DONE** (+ dark mode toggle added) |

### Tier 4: Future / Deferred (16+ SP)

Require significant architecture changes or have limited audience. Defer until demand is validated.

| # | Item | SP | Justification | Status |
|---|------|---:|---------------|--------|
| 15 | F7: Rule groups / folders | 8 | Only valuable at 50+ rules scale | **DONE** (pulled into Sprint 2) |
| 16 | F8: Replacement preview / dry-run | 8 | High complexity — needs content script highlight mode | Backlog |
| 17 | TD2: Extract shared.js module | 3 | Requires build tooling; low user impact | Backlog |
| 18 | F9: Statistics dashboard | 5 | Nice analytics but no direct productivity gain | Backlog |
| 19 | F11: Cloud sync / profile sharing | 13 | Requires backend; only for team scenarios | Backlog |

---

## Completion Summary

| Tier | SP | Items | Done | Skipped | Backlog |
|------|---:|------:|-----:|--------:|--------:|
| Tier 1 (Critical) | 11 | 6 | **6** | 0 | 0 |
| Tier 2 (High Value) | 10 | 4 | **3** | 1 | 0 |
| Tier 3 (Nice-to-Have) | 15 | 4 | **3** | 1 | 0 |
| Tier 4 (Future) | 37 | 5 | **1** | 0 | 4 |
| **Total** | **73** | **19** | **13** | **2** | **4** |

### Bonus features added beyond the original plan:
- **Dark mode toggle** — Full `:root.dark` CSS variable set with persistent preference (added during TD7 implementation)
- **Branding overhaul** — Renamed to "ReText" with new A→B arrow logo (icon16/48/128)

---

## What's Left (Backlog — 29 SP)

| Priority | Item | SP | Notes |
|----------|------|---:|-------|
| 1 | F8: Replacement preview / dry-run | 8 | Highest user value among remaining items. Needs a content script "highlight mode" that marks matches without replacing. |
| 2 | F9: Statistics dashboard | 5 | Track how many replacements fire per rule, per page. Popup panel or separate page. |
| 3 | TD2: Extract shared.js module | 3 | Move `matchesScope`, `applyReplacement`, etc. to a shared module. Requires a build step (Rollup/esbuild). |
| 4 | F11: Cloud sync / profile sharing | 13 | Requires a backend (Firebase / Supabase). Export-as-link could be a lightweight alternative. |

---

## Architecture (v2.0)

```
┌─────────────────────────────────────────────────────┐
│                     ReText v2.0                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  Popup UI  │  │  Content   │  │  Background  │  │
│  │ popup.*    │  │  Script    │  │  Service     │  │
│  │            │  │ content.js │  │  Worker      │  │
│  │ - CRUD     │  │            │  │ background.js│  │
│  │ - Groups   │  │ - DOM Walk │  │              │  │
│  │ - Regex    │  │ - Skip     │  │ - Badge      │  │
│  │ - Import   │  │   Tags     │  │ - Context    │  │
│  │ - Export   │  │ - Debounce │  │   Menu       │  │
│  │ - Toasts   │  │ - Regex    │  │ - Storage    │  │
│  │ - Dark     │  │ - Scope    │  │   Listener   │  │
│  │   Mode     │  │            │  │              │  │
│  └─────┬──────┘  └─────┬──────┘  └──────────────┘  │
│        │               │                            │
│        └───────┬───────┘                            │
│                ▼                                    │
│       ┌──────────────────┐                          │
│       │  Chrome Storage  │                          │
│       │  (sync → local)  │                          │
│       └──────────────────┘                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Data Shape (v2.0)

```json
{
  "globalEnabled": true,
  "darkMode": false,
  "replacements": [
    {
      "textToReplace": "hello",
      "replacementText": "world",
      "scope": "example.com",
      "group": "Demo",
      "wholeWord": true,
      "isRegex": false,
      "enabled": true
    }
  ]
}
```

---

*Created by Anav Gupta*
