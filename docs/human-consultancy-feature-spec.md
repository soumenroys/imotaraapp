# Imotara Human Consultancy Feature — Full Specification
**Version:** 1.0  
**Date:** 2026-06-05  
**Status:** Proposal

---

## 1. Executive Summary

Imotara currently provides AI/LLM-based emotional guidance and companionship. This document proposes **Imotara Connect** — a real-human consultancy layer that allows verified, trained human consultants to provide audio and video-based emotional, relational, and wellness support to users across all languages and time zones.

This feature positions Imotara beyond a chatbot into a **full mental wellness ecosystem**: AI-first for everyday reflection, and human-first for deeper support moments. Both layers share the same user account, history, and settings.

---

## 2. Consultant Categories

| # | Category | Target Users | Session Type |
|---|----------|-------------|--------------|
| 1 | Male Friend | Anyone seeking peer-style emotional support | Audio / Video |
| 2 | Female Friend | Anyone seeking peer-style emotional support | Audio / Video |
| 3 | Dad | Users seeking parental-figure support | Audio / Video |
| 4 | Mom | Users seeking parental-figure support | Audio / Video |
| 5 | Sister | Users seeking sibling-style empathy | Audio / Video |
| 6 | Brother | Users seeking sibling-style support | Audio / Video |
| 7 | Male Mental Wellness Companion | Users wanting structured emotional guidance from a male | Audio / Video |
| 8 | Female Mental Wellness Companion | Users wanting structured emotional guidance from a female | Audio / Video |
| 9 | Grandfather | Users seeking elder-wisdom / life-experience guidance | Audio / Video |
| 10 | Grandmother | Users seeking elder-wisdom / nurturing guidance | Audio / Video |
| 11 | Yoga Instructor | Users wanting mindfulness + breathing guidance | Audio / Video |
| 12 | Physical Wellness Companion | Users wanting fitness + body-mind integration support | Audio / Video |

> All categories are **non-clinical** — they are companionship and wellness support roles, not licensed therapy. Clear disclaimers are required on all booking flows.

---

## 3. User Flows

### 3.1 User (Seeker) Journey

```
Browse Consultants
  → Filter by category / language / rating / availability / gender
  → View consultant profile (photo, bio, expertise, languages, rates, reviews)
  → Choose session type: Audio or Audio+Video
  → Check availability in own time zone
      ├── Instant connect (consultant online now) → Request live session
      └── Schedule appointment → Pick slot → Pay → Receive confirmation
          → Reminder notification (24h, 1h, 10min before)
          → Join session at scheduled time
  → Post-session: Rate + review → Optional AI reflection summary
```

### 3.2 Consultant (Provider) Journey

```
Register as Consultant
  → Fill profile: name, photo, categories, languages, bio, rates, ID document
  → Choose consultancy mode: Audio-only OR Audio+Video
  → Set availability: weekly schedule + time zone + exceptions
  → Submit for Imotara verification
  → Verification review (2–5 business days)
  → Approved → Go online → Accept live requests or manage bookings
  → Conduct session via Imotara Call interface
  → Post-session: Add private session notes (not visible to user)
  → Earnings credited to wallet → Withdraw via bank / UPI / PayPal
```

---

## 4. Feature List

### 4.1 Consultant Registration & Verification

| Feature | Details |
|---------|---------|
| Multi-step registration form | Name, display name, gender, photo, bio (multi-language), categories (multi-select), languages spoken, consultancy type, rate/session, time zone, weekly availability grid |
| Government ID verification | Upload Aadhaar / Passport / Driving Licence (encrypted storage) |
| Self-declaration form | Agreement to Imotara Code of Conduct, disclaimer (non-clinical role) |
| Training badge | Optional upload of wellness/yoga/counselling certificates |
| Video intro (optional) | 60-second intro video for consultant profile |
| Background check consent | Consent for optional third-party background check |
| Re-verification | Annual re-verification reminder |

### 4.2 Admin Verification Workflow

| Feature | Details |
|---------|---------|
| Reviewer queue | Pending applications with ID docs, photo, bio |
| Approve / Reject / Request more info | With reason message sent to consultant |
| Reviewer assignment | Assign applications to specific Imotara review staff |
| Audit trail | Every action logged with reviewer ID + timestamp |
| Fraud flags | Duplicate ID detection, photo similarity check |

### 4.3 Consultant Profile (Public)

| Feature | Details |
|---------|---------|
| Profile photo + verification badge | Green tick once verified |
| Category badges | One or more of the 12 categories |
| Languages spoken | Multi-language tags |
| Session type indicator | Audio-only / Audio+Video |
| Bio (up to 500 words) | Shown in user's app language if translated |
| Star rating + review count | Aggregate from past sessions |
| Total sessions completed | Credibility signal |
| Response rate % | For scheduled requests |
| Next available slot | Shown in user's local time zone |
| Rate per session | Shown in user's local currency |
| Availability grid | Weekly visual calendar |

### 4.4 Discovery & Matching

| Feature | Details |
|---------|---------|
| Category filter | Browse by the 12 categories |
| Language filter | Match consultants who speak user's language |
| Gender filter | Explicit user preference |
| Rating filter | Min star threshold |
| Availability filter | Show only available now / available today / this week |
| Session type filter | Audio-only / Audio+Video |
| Sort options | Highest rated, most sessions, lowest price, soonest available |
| Recommended section | AI-curated suggestions based on user's mood history and prior sessions |
| Featured consultants | Admin-promoted spotlight slots |
| Search | Free-text search by name or keyword |

### 4.5 Scheduling & Booking

| Feature | Details |
|---------|---------|
| Time zone auto-detection | User's device time zone used automatically |
| Slot calendar | Visual grid showing consultant's open slots in user's time zone |
| Session duration options | 30 min / 60 min (consultant can configure) |
| Booking confirmation | Email + push notification |
| Pre-session questionnaire | Optional 3-question form for consultant context |
| Appointment management | User can cancel / reschedule up to 24h before |
| Cancellation policy | Configurable per consultant (e.g., refund if cancelled 24h before) |
| Calendar export | Add to Google / Apple / Outlook calendar (.ics export) |
| Reminder notifications | 24h, 1h, 10 min before session |
| Waitlist | Join waitlist if preferred slot is full |

### 4.6 Live / Instant Session

| Feature | Details |
|---------|---------|
| Online indicator | Green dot on consultant card when available now |
| Instant connect request | User sends request → consultant has 60s to accept or decline |
| Auto-decline if no response | Notifies user to try another consultant or book |
| Queue position indicator | If consultant is in another session |
| Session lobby | Waiting room screen with estimated wait time |

### 4.7 Call / Session Interface

| Feature | Details |
|---------|---------|
| Audio call | WebRTC-based encrypted audio channel |
| Video call (opt-in) | WebRTC video, consultant-controlled (can disable camera) |
| Session timer | Visible countdown to end of booked time |
| Extend session button | User can request extra 15/30 min (charges additional fee) |
| Text chat sidebar | Optional text fallback during call |
| Screen share | Yoga instructor can share poses / Physical wellness can share exercise demos |
| Virtual background | Blurred or custom background for consultant privacy |
| End call button | For both user and consultant |
| Emergency signal | Single-tap "I need urgent help" → shows crisis hotline numbers |
| Session recording | Disabled by default; requires explicit dual consent if enabled |
| Network quality indicator | Visible to both parties |
| Mobile-first layout | Optimised for both iOS and Android app |
| Web browser support | Chrome / Safari / Firefox full support |

### 4.8 Post-Session

| Feature | Details |
|---------|---------|
| Session summary | Auto-generated AI summary of session duration and category |
| Mood check-in | User rates how they feel post-session (1–5 emoji scale) |
| Rating & review | Star rating + optional text review (moderated before publish) |
| Tip consultant | Optional additional tip amount |
| Rebook prompt | "Book your next session with [Name]?" CTA |
| Private reflection | User-side notes linked to session in Imotara journal |
| Consultant session note | Private consultant note (visible only to consultant + admin) |

### 4.9 Consultant Dashboard

| Feature | Details |
|---------|---------|
| Earnings summary | Today / this week / this month / all time |
| Upcoming sessions | Calendar view of booked sessions |
| Session history | List of past sessions with ratings received |
| Availability management | Edit weekly schedule, block dates, add exceptions |
| Profile editor | Update bio, photo, categories, rate |
| Withdrawal | Request payout to bank / UPI / PayPal |
| Earnings breakdown | Platform fee deducted, tax withholding shown |
| Rating analytics | Trend of ratings over time |
| Notification preferences | SMS / Email / Push for new bookings / cancellations |
| Status toggle | Online / Busy / Offline toggle |

### 4.10 Payment & Billing

| Feature | Details |
|---------|---------|
| Per-session pricing | Set by consultant (within Imotara min/max bounds) |
| Currency auto-conversion | User pays in local currency; consultant receives in their currency |
| Payment at booking | Captured at booking, held in escrow |
| Escrow release | Released to consultant 24h after session completion |
| Refund policy | Full refund if consultant no-shows; partial if user cancels < 24h |
| Free first session | Optional consultant setting: first 15 min free |
| Subscription bundle | Users on Pro/Enterprise tier get discounted session credits |
| Gift sessions | User can gift a session credit to another Imotara user |
| Invoice generation | Auto-invoice for users post-payment |
| GST / Tax handling | Platform-level tax compliance per region |

---

## 5. Revenue Model

### 5.1 Commission Structure (Recommended)

| Revenue Source | Imotara Cut | Consultant Receives | Notes |
|---------------|-------------|-------------------|-------|
| Standard session | **25%** | 75% | Base commission for all verified consultants |
| Premium session (high-rated) | **20%** | 80% | Consultants with 4.7+ stars, 100+ sessions |
| Featured listing | Flat fee: ₹500/month or $6/month | — | Paid by consultant for top-of-feed placement |
| Session extension fee | **30%** | 70% | Impulse purchase, higher Imotara margin |
| Tip | **10%** | 90% | Near-pass-through to reward consultant |
| Subscription credit bundles | **40%** | Redeemed at 60% when consumed | Pre-purchased credits sold to users |

**Rationale:** 25% is the market-standard for marketplace platforms (Uber, Fiverr range 20–30%). Starting at 25% with a 20% fast-track incentive program encourages quality and retention.

### 5.2 User-Side Pricing (Suggested)

| Session Duration | Suggested Range (INR) | Suggested Range (USD) |
|-----------------|----------------------|----------------------|
| 30 minutes | ₹299 – ₹999 | $4 – $12 |
| 60 minutes | ₹499 – ₹1,999 | $6 – $24 |
| Extension (15 min) | ₹149 – ₹499 | $2 – $6 |

### 5.3 Subscription Integration

| Imotara Tier | Connect Benefit |
|-------------|----------------|
| Free | Pay per session, no discount |
| Plus | 5% discount on all sessions |
| Pro | 2 free 30-min sessions/month included |
| Family | 1 free session/month per family member (max 4) |
| Enterprise/EDU | Bulk session credits available via org admin |

### 5.4 Estimated Revenue Projections (Year 1)

| Metric | Conservative | Optimistic |
|--------|-------------|-----------|
| Active consultants | 50 | 200 |
| Avg sessions/consultant/month | 30 | 60 |
| Avg session revenue | ₹599 | ₹799 |
| Monthly GMV | ₹8.99L | ₹95.9L |
| Imotara revenue (25% cut) | ₹2.25L/mo | ₹23.9L/mo |
| Annual Imotara revenue | ₹26.9L | ₹2.87Cr |

---

## 6. Proposed Architecture

### 6.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Imotara Connect                          │
├───────────────┬────────────────┬───────────────┬───────────────┤
│  User App     │ Consultant App │  Admin Panel   │  Reviewer     │
│  (web+mobile) │  (web+mobile)  │  /admin/connect│  /admin/review│
└───────┬───────┴────────┬───────┴───────┬────────┴───────┬───────┘
        │                │               │                │
        ▼                ▼               ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Next.js API Layer                            │
│  /api/connect/consultants    /api/connect/sessions               │
│  /api/connect/bookings       /api/connect/payments               │
│  /api/connect/availability   /api/connect/reviews                │
│  /api/connect/calls          /api/connect/earnings               │
│  /api/admin/connect/review   /api/admin/connect/analytics        │
└───────────────────────────┬──────────────────────────────────────┘
                            │
        ┌───────────────────┼──────────────────────┐
        ▼                   ▼                       ▼
┌──────────────┐   ┌─────────────────┐   ┌──────────────────────┐
│  Supabase DB  │   │  Media / Calls  │   │  Payment Gateway     │
│  (PostgreSQL) │   │  (Daily.co or   │   │  Razorpay (India)    │
│               │   │   LiveKit)      │   │  Stripe (Global)     │
│               │   │                 │   │  PayPal (Global)     │
└──────────────┘   └─────────────────┘   └──────────────────────┘
        │
        ├── consultants table
        ├── consultant_availability table
        ├── bookings table
        ├── sessions table
        ├── session_reviews table
        ├── consultant_earnings table
        ├── consultant_payouts table
        ├── connect_payments table
        └── consultant_verification_docs table (encrypted)
```

### 6.2 Database Schema (Key Tables)

#### `consultants`
```sql
id                  uuid PRIMARY KEY
user_id             uuid REFERENCES auth.users   -- consultant's Imotara account
display_name        text NOT NULL
bio                 jsonb                        -- {en: "...", hi: "...", ...}
photo_url           text
intro_video_url     text
gender              text                         -- male | female | non-binary
categories          text[]                       -- from the 12 categories
languages           text[]                       -- ISO language codes
session_type        text                         -- audio | audio_video
rate_30min_paise    int                          -- in smallest currency unit
rate_60min_paise    int
timezone            text                         -- IANA tz e.g. "Asia/Kolkata"
status              text DEFAULT 'pending'       -- pending | approved | suspended | rejected
verification_notes  text                         -- admin notes
is_online           boolean DEFAULT false
rating_avg          numeric(3,2)
rating_count        int DEFAULT 0
sessions_completed  int DEFAULT 0
response_rate       numeric(5,2)
featured            boolean DEFAULT false
featured_until      timestamptz
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

#### `consultant_availability`
```sql
id              uuid PRIMARY KEY
consultant_id   uuid REFERENCES consultants
day_of_week     int                  -- 0=Sun ... 6=Sat
start_time      time                 -- local time in consultant's tz
end_time        time
is_active       boolean DEFAULT true
```

#### `bookings`
```sql
id                  uuid PRIMARY KEY
user_id             uuid REFERENCES auth.users
consultant_id       uuid REFERENCES consultants
scheduled_at        timestamptz NOT NULL           -- UTC
duration_minutes    int DEFAULT 30
session_type        text                           -- audio | video
status              text DEFAULT 'pending'         -- pending|confirmed|active|completed|cancelled|no_show
pre_session_notes   text                           -- user's optional context
payment_id          text                           -- Razorpay/Stripe payment ID
amount_paise        int
platform_fee_paise  int
consultant_paise    int
escrow_released     boolean DEFAULT false
cancellation_reason text
cancelled_by        text                           -- user | consultant | system
created_at          timestamptz DEFAULT now()
```

#### `sessions`
```sql
id                  uuid PRIMARY KEY
booking_id          uuid REFERENCES bookings
room_id             text                           -- Daily.co / LiveKit room ID
started_at          timestamptz
ended_at            timestamptz
duration_actual_sec int
call_quality        jsonb                          -- network stats
consultant_notes    text                           -- private, not shown to user
status              text DEFAULT 'waiting'
```

#### `session_reviews`
```sql
id              uuid PRIMARY KEY
session_id      uuid REFERENCES sessions
user_id         uuid REFERENCES auth.users
consultant_id   uuid REFERENCES consultants
rating          int CHECK (rating BETWEEN 1 AND 5)
review_text     text
is_approved     boolean DEFAULT false              -- moderated before publish
mood_after      int CHECK (mood_after BETWEEN 1 AND 5)
tip_paise       int DEFAULT 0
created_at      timestamptz DEFAULT now()
```

#### `consultant_earnings`
```sql
id              uuid PRIMARY KEY
consultant_id   uuid REFERENCES consultants
booking_id      uuid REFERENCES bookings
gross_paise     int
platform_fee    int
net_paise       int
status          text DEFAULT 'pending'             -- pending | available | withdrawn
available_at    timestamptz                        -- 24h after session
created_at      timestamptz DEFAULT now()
```

### 6.3 Real-Time Call Infrastructure

**Recommended Provider: Daily.co or LiveKit**

| Provider | Pros | Cons | Cost |
|----------|------|------|------|
| Daily.co | Managed WebRTC, simple REST API, HIPAA-eligible | Per-minute pricing | ~$0.004/participant/min |
| LiveKit | Open-source, self-hostable, full control | More ops overhead | Server cost only |
| Agora | Widely used in India, low latency | Proprietary, vendor lock-in | ~$0.0099/min |
| Jitsi | Free, open-source | Reliability concerns at scale | Free self-host |

**Recommendation:** Start with **Daily.co** for zero-ops quick launch. Migrate to self-hosted **LiveKit** at scale for cost savings.

**Call flow:**
```
User clicks "Join" →
  POST /api/connect/calls/create-room →
    Server creates Daily.co room with expiry = booking end time
    Returns ephemeral join token for user + consultant
  Both clients connect to room URL
  On room end → POST /api/connect/calls/session-end →
    Record duration, trigger escrow release job
```

### 6.4 Notification Infrastructure

| Event | Channels |
|-------|---------|
| Booking confirmed | Email (SMTP) + Push (Expo/FCM/APNs) |
| Booking reminder (24h) | Email + Push |
| Booking reminder (1h) | Push + SMS (optional) |
| Booking reminder (10min) | Push |
| Consultant request received | Push to consultant (immediate) |
| Session completed | Push + Email (receipt) |
| Payout processed | Email + Push to consultant |
| Review posted | Email to consultant |
| Verification approved/rejected | Email to consultant |

### 6.5 Document Storage (Verification)

- ID documents stored in **Supabase Storage** in a private bucket: `consultant-verification-docs/`
- Access controlled via signed URLs (admin reviewer only, short TTL)
- Documents encrypted at rest (Supabase default AES-256)
- Retention: 7 years post-account-deletion (legal compliance)
- GDPR: Right-to-erasure request handled manually by admin with legal review

---

## 7. API Design (Key Endpoints)

### Public / User-facing
```
GET  /api/connect/consultants               — browse with filters
GET  /api/connect/consultants/:id           — public profile
GET  /api/connect/consultants/:id/slots     — available time slots
POST /api/connect/bookings                  — create booking + payment
GET  /api/connect/bookings                  — user's bookings
PATCH /api/connect/bookings/:id/cancel      — cancel booking
POST /api/connect/calls/create-room         — create call room (at join time)
POST /api/connect/reviews                   — submit review
```

### Consultant-facing (requires consultant auth)
```
POST /api/connect/consultant/register       — submit registration
PATCH /api/connect/consultant/profile       — update profile
GET  /api/connect/consultant/bookings       — consultant's bookings
PATCH /api/connect/consultant/bookings/:id  — accept/decline instant request
GET  /api/connect/consultant/availability   — get schedule
PUT  /api/connect/consultant/availability   — update schedule
GET  /api/connect/consultant/earnings       — earnings summary
POST /api/connect/consultant/payout         — request payout
PATCH /api/connect/consultant/status        — toggle online/offline
```

### Admin (requires admin auth — extends existing /api/admin/)
```
GET  /api/admin/connect/pending-verifications  — reviewer queue
PATCH /api/admin/connect/verify/:id            — approve/reject/info-request
GET  /api/admin/connect/analytics             — GMV, sessions, revenue
GET  /api/admin/connect/consultants           — all consultants list
PATCH /api/admin/connect/consultants/:id       — suspend/feature/edit
GET  /api/admin/connect/sessions              — all sessions audit
GET  /api/admin/connect/payouts               — payout management
POST /api/admin/connect/payouts/:id/process   — mark payout processed
```

---

## 8. Mobile App (Imotara Mobile) Additions

| Screen | Description |
|--------|-------------|
| `Connect` tab | New bottom-nav tab: "Connect" icon |
| `BrowseConsultants` | Category grid → filtered list → profile |
| `ConsultantProfile` | Full profile, reviews, availability |
| `BookingFlow` | Slot picker → payment → confirmation |
| `LiveSessionScreen` | Call UI (audio/video), timer, end button |
| `SessionHistory` | Past Connect sessions in main history |
| `ConsultantDashboard` | For users who are also consultants |
| `ConsultantOnboarding` | Multi-step registration flow |

---

## 9. Safety & Compliance

### 9.1 Non-Clinical Disclaimer
- Prominent disclaimer on every consultant profile: *"Imotara Connect provides peer support and wellness companionship. Consultants are not licensed therapists or medical professionals. If you are in crisis, please contact a mental health helpline."*
- Crisis helpline numbers shown contextually (country-detected)

### 9.2 Emergency Protocol
- Single-tap "I need urgent help" button during session
- Shows local crisis lines (iCall, Vandrevala, Snehi for India; 988 for US; Samaritans for UK)
- Session auto-logged for safety review if emergency signal triggered

### 9.3 Code of Conduct
- Consultants agree to prohibitions: no romantic/sexual overtures, no clinical advice, no financial solicitation
- Three-strike policy: warning → suspension → permanent ban
- Users can report a consultant mid-session or post-session

### 9.4 Privacy
- Session content is private to user + consultant (not stored by default)
- Consultant's private session notes not accessible to user
- GDPR / DPDPA (India) compliant data handling
- Child protection: users under 18 require parental consent toggle (set in account settings)

### 9.5 Trust & Safety Metrics (Admin monitored)
- Low-rating alert: consultant drops below 3.5 stars on 10+ sessions → auto-review flag
- Session abandonment rate > 20% → flag for investigation
- Report frequency: more than 3 reports in 30 days → suspension pending review

---

## 10. Multilingual Support

All user-facing text is served in Imotara's existing i18n system. Additions required:

- Consultant bio translation (via AI-assisted translation at profile submission time)
- Booking confirmation emails in user's language
- In-app text for all 12 category names in all supported languages
- Consultant-to-user language matching (show "speaks your language" badge)

---

## 11. Admin Panel Assessment & Required Enhancements

### 11.1 What the Current Admin Panel Covers

The existing `/admin` panel handles:
- Super-admin login (email/password + legacy secret key)
- User license management (tier, status, expiry, token balance)
- Organization management (create, edit, member management, license pools)
- Blog comment moderation
- Admin action audit trail

### 11.2 What Is MISSING for Imotara Connect

The current admin panel is **not sufficient** for the consultancy feature. The following new sections must be added to `/admin`:

#### Section A: Consultant Verification Queue (`/admin` → "Verifications" tab)
| Capability | Current | Needed |
|-----------|---------|--------|
| View pending consultant applications | ✗ | ✓ |
| View uploaded ID documents (signed URL) | ✗ | ✓ |
| Approve / Reject with message | ✗ | ✓ |
| Request additional information | ✗ | ✓ |
| Assign reviewer | ✗ | ✓ |
| Verification audit trail | ✗ | ✓ |
| Search by name / email / status | ✗ | ✓ |

#### Section B: Consultant Management (`/admin` → "Consultants" tab)
| Capability | Current | Needed |
|-----------|---------|--------|
| List all consultants with status | ✗ | ✓ |
| Edit consultant profile fields | ✗ | ✓ |
| Suspend / Reinstate consultant | ✗ | ✓ |
| Feature / Unfeature consultant | ✗ | ✓ |
| View consultant ratings & reviews | ✗ | ✓ |
| View earnings for a consultant | ✗ | ✓ |
| Manual payout override | ✗ | ✓ |
| Flag for safety review | ✗ | ✓ |

#### Section C: Session Management (`/admin` → "Sessions" tab)
| Capability | Current | Needed |
|-----------|---------|--------|
| View all sessions (filtered by date, consultant, user) | ✗ | ✓ |
| View session metadata (duration, call quality) | ✗ | ✓ |
| View emergency signals triggered | ✗ | ✓ |
| Handle session disputes | ✗ | ✓ |
| Issue manual refund | ✗ | ✓ |

#### Section D: Connect Analytics (`/admin` → "Connect Analytics" tab)
| Capability | Current | Needed |
|-----------|---------|--------|
| GMV (Gross Merchandise Value) dashboard | ✗ | ✓ |
| Imotara revenue (platform fees) | ✗ | ✓ |
| Sessions per day / week / month chart | ✗ | ✓ |
| Top consultants by sessions / revenue | ✗ | ✓ |
| Category breakdown | ✗ | ✓ |
| User acquisition via Connect | ✗ | ✓ |
| Cancellation / No-show rates | ✗ | ✓ |

#### Section E: Payout Management (`/admin` → "Payouts" tab)
| Capability | Current | Needed |
|-----------|---------|--------|
| Pending payout requests list | ✗ | ✓ |
| Mark payout as processed | ✗ | ✓ |
| Payout history | ✗ | ✓ |
| Tax withholding records | ✗ | ✓ |
| Export payout CSV | ✗ | ✓ |

#### Section F: Moderation (`/admin` → existing Comments tab extended)
| Capability | Current | Needed |
|-----------|---------|--------|
| Approve / Reject session reviews | Partial (blog comments) | ✓ Extend |
| Handle user reports against consultants | ✗ | ✓ |
| Three-strike warning system | ✗ | ✓ |

### 11.3 Summary

> The current admin panel covers **0% of the new Connect requirements**. It must be extended with 5 new tabs (Verifications, Consultants, Sessions, Connect Analytics, Payouts) and the Moderation tab extended. The existing auth, UI patterns, and API conventions are fully reusable — this is additive development, not a rebuild.

---

## 12. Implementation Phasing

### Phase 1 — Foundation (6–8 weeks)
- DB schema (consultants, availability, bookings, sessions, reviews, earnings)
- Consultant registration + ID upload
- Admin Verification Queue (reviewer panel)
- Consultant profile page (public, read-only)
- Browse & filter consultants

### Phase 2 — Booking & Payments (4–6 weeks)
- Slot availability engine (time zone conversion)
- Booking flow + Razorpay payment capture
- Escrow logic (24h release)
- Booking confirmation emails + push notifications
- Cancellation & refund handling

### Phase 3 — Live Sessions (4–6 weeks)
- Daily.co / LiveKit integration
- Call interface (web + mobile)
- Session timer + extension flow
- Emergency signal button
- Post-session review + mood check-in

### Phase 4 — Consultant Dashboard (3–4 weeks)
- Earnings & payout management
- Availability management UI
- Profile editor
- Consultant-side notification preferences

### Phase 5 — Admin Enhancements (3–4 weeks)
- All 5 new admin tabs (Verifications, Consultants, Sessions, Analytics, Payouts)
- Moderation extensions
- Dispute handling tools

### Phase 6 — Growth & Optimisation (ongoing)
- AI-powered recommendations ("Connect users who reflect on X often book Yoga instructors")
- Subscription bundle integration (Pro/Enterprise credits)
- Featured listing system
- Multi-language bio AI translation
- Review fraud detection

**Total estimated timeline to Phase 3 (MVP): ~4–5 months**

---

## 13. Technology Decisions Summary

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Call infrastructure | Daily.co (initial) → LiveKit (scale) | Daily.co = zero ops to ship fast |
| Payments | Razorpay (India) + Stripe (global) | Existing Razorpay integration usable |
| ID document storage | Supabase Storage (private bucket) | Already in stack |
| Real-time presence | Supabase Realtime (PostgreSQL LISTEN/NOTIFY) | Already in stack |
| Notifications | Existing SMTP + Expo push | Already in stack |
| Analytics | Supabase + custom SQL aggregation | No new tools needed |
| Scheduling | PostgreSQL time zone functions | Native, no external dep |
| Translation | Existing i18n system + AI-assisted bio translation | Reuse existing |

---

## 14. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Consultant quality issues | High | Rigorous verification + ratings + three-strike system |
| Boundary violations (romantic overtures) | High | Strict CoC, report button, session review on flags |
| Child safety | High | Age gate in account settings, parental consent required |
| No-show (consultant or user) | Medium | Penalties in cancellation policy, auto-refund for user |
| WebRTC quality issues | Medium | LiveKit fallback, quality indicator, escalation to PSTN |
| Regulatory (clinical boundary) | High | Non-clinical disclaimer, no mental health condition targeting in marketing |
| Consultant data breach (ID docs) | Medium | Encrypted private bucket, signed URLs, minimal access |
| Payment fraud | Medium | Razorpay fraud detection + manual review above ₹10,000 |

---

*Document prepared for internal Imotara planning. Not for external distribution.*
