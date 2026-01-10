# UI Parity — Mobile → Web (Imotara)

Goal: Web must match Mobile UX/behavior exactly (features + response experience).
Rule: Any mobile UI/UX enhancement must be mirrored on web.

## 1) Chat Screen
- [ ] Header layout matches (spacing, chips, buttons)
- [ ] Bubble styles match (radius, padding, text size, max width)
- [ ] Typing indicator style matches
- [ ] Timestamps style matches
- [ ] Input bar (height, rounded, icons, placeholder, disabled states)
- [ ] Micro-animations match (hover/glow where applicable)

## 2) Reflection Seed Card (New)
- [ ] Render `reflectionSeedCard` separately (not in chat bubble)
- [ ] Card placement matches mobile
- [ ] Card design matches Aurora Calm style

## 3) History Screen
- [ ] Emotion cards match (layout, typography, spacing)
- [ ] Trend visualization style matches
- [ ] Sync status UI matches
- [ ] Conflict UI matches

## 4) Settings Screen
- [ ] Toggles match (labels, spacing, grouping)
- [ ] Consent + Privacy actions match (Export/Delete)
- [ ] Tone profile controls match

## 5) Labels & Truthfulness (Must be identical)
- [ ] “Local vs Cloud” wording matches mobile
- [ ] Any “Remote analysis allowed” messaging matches
- [ ] Any banners/tooltips match

## 6) QA Parity Checks
- [ ] Same prompt behavior across platforms (tone + structure)
- [ ] Same edge-case handling (empty input, offline, AI disabled)
- [ ] Same safe fallbacks and disclaimers
