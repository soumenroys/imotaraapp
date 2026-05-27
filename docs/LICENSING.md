# Imotara — Proposed Licensing Matrix

> **Status:** Proposed / design-phase. Not yet fully enforced in code.
> `NEXT_PUBLIC_IMOTARA_LICENSE_MODE=off` — all users currently receive full access during soft launch.
> Server-side quota (20 cloud replies/day for Free) is always active regardless of this flag.

---

## Pricing

| Tier | Monthly | Annual | Annual Savings | Target |
|------|---------|--------|----------------|--------|
| **Free** | ₹0 | ₹0 | — | First-time users, casual use |
| **Plus** | ₹99 | ₹699 | ~41% | Daily users who need history & export |
| **Pro** | ₹149 | ₹1,299 | ~27% | Power users who want deep insights |
| **Family** | Custom | Custom | — | Shared household, up to 6 profiles |
| **EDU** | Custom | Custom | — | Schools, colleges, counselling orgs |
| **Enterprise** | Custom | Custom | — | Corporates, HR, mental-health platforms |

---

## Token Packs (all tiers, one-time purchase)

Token packs extend AI-reply capacity beyond the daily quota. Tokens never expire and carry over indefinitely.

| Pack | Price | Tokens | Rate |
|------|-------|--------|------|
| Starter | ₹49 | 100 tokens | ₹0.49/token |
| Standard | ₹99 | 250 tokens | ₹0.40/token |
| Value | ₹199 | 600 tokens | ₹0.33/token |
| Pro Pack | ₹499 | 1,800 tokens | ₹0.28/token |

---

## Feature Matrix

Legend: ✅ Included · ❌ Not included · `value` — specific limit or parameter

### 1. Core Experience

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Daily reply limit** | Max AI replies the user can send per calendar day before needing token top-up | 10/day | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |
| **Companion tone selection** | Choose the personality/mood of the AI companion (e.g. Warm, Direct, Playful) | 1 tone | All tones | All tones | All tones | All tones | All tones |
| **Response length control** | Switch between short, medium, and long AI response modes | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Conversation threading** | Replies grouped into sessions/threads for cleaner navigation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Message search** | Full-text search across conversation history | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Offline mode** | Read previously loaded messages without a network connection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Companion mode / personas** | Themed AI personalities beyond the default (e.g. Coach, Listener, Challenger) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Token top-up purchases** | Buy one-time token packs to extend reply capacity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 2. Voice & Audio

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Text-to-speech (TTS)** | AI replies read aloud by a synthetic voice | ✅ basic | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Voice input (STT)** | Speak your message instead of typing; transcribed before sending | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **TTS voice selection** | Choose from multiple Azure Neural TTS voices (male/female/neutral, regional accents) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **TTS rate & pitch control** | Adjust speaking speed and pitch of the TTS voice | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Offline / native TTS fallback** | Uses device's built-in TTS engine when network is unavailable | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Azure Neural TTS (cloud)** | High-quality cloud-rendered speech via Azure Cognitive Services | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Language-specific voices** | TTS voices matched to the user's selected app language | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Haptic feedback on send** | Device vibrates when a message is sent (mobile only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 3. History & Storage

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **History retention period** | How far back conversation history is accessible | 7 days | 90 days | Unlimited | Unlimited | Unlimited | Unlimited |
| **Unlimited history** | All conversations stored indefinitely with no rolling cutoff | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Local storage** | Conversations stored on-device for fast, offline access | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **History search across dates** | Search messages older than the current session | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 4. Cloud & Sync

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Cloud sync** | Conversations backed up to cloud and synced across devices | ✅ (quota) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Cross-device sync** | Seamless switch between phone, tablet, and web app with full history | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Real-time sync** | Changes on one device appear on other devices within seconds | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sync conflict resolution** | Automatic handling when the same conversation is edited on two devices | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 5. Analytics & Insights

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Emotion trends** | Chart of detected emotional states over time (joy, sadness, stress, calm, etc.) | ❌ | ❌ | ✅ | ✅ | ✅ (agg.) | ✅ |
| **Mood graphs** | Visual weekly/monthly graphs of mood patterns derived from conversations | ❌ | ❌ | ✅ | ✅ | ✅ (agg.) | ✅ |
| **Weekly emotional summary** | Auto-generated narrative summary of the week's emotional themes | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Monthly growth letter** | Personalised letter each month reflecting progress, patterns, and growth themes | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Growth arc** | Long-term narrative arc tracking how the user's emotional expression evolves over months | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Conversation insights** | Per-conversation annotations: topics identified, emotional tone, key moments | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Streak tracking** | Counts consecutive days the user engaged with the app | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Session duration stats** | Shows how long each conversation session lasted | ❌ | ✅ | ✅ | ✅ | ✅ (agg.) | ✅ |

---

### 6. Export & Data

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Conversation export** | Download conversations to a file for personal archiving or sharing | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Export as PDF** | Render conversation history as a formatted PDF document | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Export as CSV / JSON** | Machine-readable export formats for personal data portability | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **GDPR data request** | Download all personal data held about the account in a machine-readable package | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Data deletion request** | Request permanent deletion of all account data from Imotara servers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Bulk export (admin)** | Export anonymised data for all users within an org via admin panel | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

> **Note:** Family export is intentionally disabled — shared-device privacy boundary. EDU individual export is disabled; aggregated/anonymised export is available to admins only.

---

### 7. Profiles & Family Safety

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Multiple profiles** | Create and switch between distinct user profiles on one device/account | ❌ | ❌ | ❌ | ✅ (6) | ✅ | ✅ |
| **Profile switching** | Quickly switch the active profile without logging out | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Child-safe mode** | Filters AI responses to age-appropriate language; blocks sensitive topics | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Parental controls** | Parent can review child profile activity, set daily limits, and approve tone changes | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Family usage dashboard** | See aggregated engagement metrics across all household profiles | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Profile-level privacy** | Each profile's history is isolated; other profiles cannot view it | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

---

### 8. Notifications & Habits

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Daily check-in reminder** | Push notification reminding the user to open the app at a chosen time | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Custom notification schedule** | Set specific days and times for reminders rather than a single daily slot | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Streak notifications** | Alert when the user is at risk of breaking a streak | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Milestone celebrations** | In-app celebration when user hits streaks, first insight, or growth milestones | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Weekly insight digest** | Weekly push notification summarising the user's emotional highlights | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |

---

### 9. Customization & Accessibility

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Light / dark / system theme** | Switch between light mode, dark mode, or follow device system setting | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Language selection** | Change the app language (UI and AI responses) from the supported language list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Font size control** | Increase or decrease text size across the app for readability | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Haptic feedback toggle** | Enable or disable vibration feedback on interactions (mobile) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Custom app icon** | Choose from alternate app icons (mobile) | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Search mode selection** | Toggle between semantic/keyword search modes in history | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Cadence / reply pacing** | Set how quickly or slowly the AI types out replies (streaming speed) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Institution branding** | Replace Imotara's logo/colours with the organisation's own brand assets | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### 10. Privacy & Security

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Encrypted cloud storage** | All cloud-synced data encrypted at rest (AES-256) and in transit (TLS 1.3) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Local-only / offline mode** | Option to disable cloud sync entirely, keeping all data on-device only | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **AsyncStorage encryption** | Mobile local storage encrypted with device-level key (planned v1.0.11) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Data residency control** | Choose which geographic region stores the organisation's data | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Audit logs** | Immutable logs of admin actions, profile changes, and data access events | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Session token management** | View and revoke active sessions from account security settings | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **SSO / SAML integration** | Sign in via the organisation's identity provider (Okta, Google Workspace, Azure AD) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

### 11. Admin & Institutional

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Admin dashboard** | Web panel for managing users, viewing usage stats, and setting org-level policies | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **User management** | Add, remove, suspend, or reassign users within the organisation | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Bulk user provisioning** | Import users via CSV or SCIM; set default tier and permissions en masse | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Org-level usage analytics** | Aggregate engagement metrics: DAU, streak rates, feature adoption, etc. | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Student / employee progress view** | Anonymised per-user progress indicators for counsellors or HR leads | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Classroom / cohort mode** | Group users into classes or teams; set shared companion tone policies | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **LMS integration** | Embed Imotara within an LMS (Moodle, Canvas) via LTI or iframe | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **API access** | Programmatic access to conversation summaries and analytics via REST API | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Custom integrations** | Bespoke webhooks, HR system connectors, or custom AI model tuning | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Team / department management** | Organise users into teams with separate policies and admins | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

### 12. Support

| Feature | Description | Free | Plus | Pro | Family | EDU | Enterprise |
|---------|-------------|------|------|-----|--------|-----|------------|
| **Community / docs support** | Access to public help centre, FAQ, and community forum | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Email support** | Submit support tickets via email with a response SLA | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Priority support queue** | Support tickets routed to a faster queue with shorter response time | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Dedicated account manager** | Named contact for onboarding, renewals, and escalations | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **SLA guarantee** | Contractual uptime and response-time commitments | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Onboarding assistance** | Guided setup session with Imotara team for org deployment | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Upgrade Trigger Summary

Why a user or org should move to the next tier:

| Current Tier | Key Upgrade Trigger |
|---|---|
| **Free → Plus** | Hitting the 10/day reply cap · needing history beyond 7 days · wanting cross-device sync or data export |
| **Plus → Pro** | Wanting emotional insights, mood trends, weekly summaries, monthly letters, or growth arc |
| **Pro → Family** | Multiple household members sharing one app account · need for child-safe profiles |
| **Pro → EDU** | Institution deploying for students/staff · need for admin panel, LMS, bulk provisioning |
| **Pro → Enterprise** | Corporate deployment · API access · SSO · data residency · custom integrations |

---

## EDU vs Family vs Enterprise — Key Differences

| Capability | Family | EDU | Enterprise |
|---|---|---|---|
| Multi-profile | ✅ (up to 6) | ✅ | ✅ |
| Child-safe mode | ✅ | ✅ | ✅ |
| Parental controls | ✅ | ❌ | ❌ |
| Family usage dashboard | ✅ | ❌ | ❌ |
| Admin dashboard | ❌ | ✅ | ✅ |
| Classroom / cohort mode | ❌ | ✅ | ❌ |
| LMS integration | ❌ | ✅ | ❌ |
| API access | ❌ | ❌ | ✅ |
| Custom integrations | ❌ | ❌ | ✅ |
| Data export (individual) | ❌ | ❌ | ✅ |
| Bulk export (admin) | ❌ | ✅ (anon.) | ✅ |
| Institution branding | ❌ | ✅ | ✅ |
| SSO / SAML | ❌ | ✅ | ✅ |
| Data residency | ❌ | ✅ | ✅ |
| Audit logs | ❌ | ✅ | ✅ |
| SLA | ❌ | ✅ | ✅ |
| Dedicated account manager | ❌ | ✅ | ✅ |

---

## Platform Notes

- **Web** (`imotaraapp`): Feature gating controlled by `NEXT_PUBLIC_IMOTARA_LICENSE_MODE`. Currently `"off"` — all features accessible regardless of tier. Tier-specific UI nudges (upgrade prompts) are still rendered.
- **Mobile** (`imotara-mobile`): Feature gating handled by `featureGates.ts`. `LAUNCH_CLOUD_SYNC_FREE_FOR_ALL=true` by default during launch period, granting all mobile users cloud sync.
- **Server**: Quota enforcement (20 cloud replies/day for Free tier) always active regardless of the `LICENSE_MODE` flag.
- **Family export intentionally disabled**: Shared-device privacy — one family member should not be able to export another's conversations.
- **EDU individual export intentionally disabled**: Institution data privacy — aggregated admin export is available but individual records stay within the platform.

---

## Enforcement Roadmap

| Phase | Action |
|---|---|
| **Now (soft launch)** | All features open; server quota (20/day) enforces Free limit |
| **Phase 2** | Set `LICENSE_MODE=enforce`; Plus/Pro gates activate in UI |
| **Phase 3** | Activate mobile gates; update `LAUNCH_CLOUD_SYNC_FREE_FOR_ALL=false` |
| **Phase 4** | EDU/Enterprise gate enforcement via admin-assigned org tier |

---

*Last updated: 2026-05-27 — proposed matrix, pending engineering implementation of Phase 2 gates.*
