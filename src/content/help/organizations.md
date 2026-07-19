# Organizations on Imotara

A guide for schools, NGOs, companies, and government bodies: creating an organization, inviting and managing members, licensing, teams, analytics, and everything in between.

## What is an organization account?

An organization (org) account lets an institution provide Imotara to its people — students, staff, beneficiaries, or employees — under one umbrella. As an org you get:

- A number of **seats** for your members.
- An **org dashboard** on the web for managing members, licenses, teams, and settings.
- **Aggregate-only wellbeing analytics** (more on the privacy promise below).
- Discounted per-seat pricing for **NGOs** and **educational institutions**.

There are four organization types, chosen at creation: **Company**, **NGO / NPO**, **Educational**, and **Government**. Your org is attached to your personal Imotara account — there's no separate "org login."

## Creating an organization

1. Sign in to your Imotara account (the person who creates the org becomes the **owner** — keep note of which email you use, because invites and admin actions key off it).
2. Go to **imotara.com/org/new**. The page is titled **"Set up your organisation."** (If you see "Sign in required," sign in first.)
3. Fill in the form:
   - **Organisation name** (required, up to 80 characters) — e.g. "Hope Foundation".
   - **Organisation type** (required) — pick one of the four tiles: **🏢 Company**, **🤝 NGO / NPO**, **🎓 Educational**, **🏛️ Government**.
   - **Billing / contact email** (optional) — only if different from your account email.
   - **Brief description** (optional, up to 500 characters) — a sentence about who you serve helps us size your setup, e.g. "NGO supporting 500 rural students in West Bengal."
   - A grey box confirms **"Submitting as [your email]. You'll be set as the organisation owner."**
4. Click **"Submit organisation request."**
5. You'll see **"Request submitted!"** — Imotara reviews your request and emails you, **typically within 24–48 hours**, once your org is activated with its plan tier and seat count.
6. Until activation, your org is pending and you can't invite members yet — that's normal. Once you receive the activation email, your dashboard at **imotara.com/org/dashboard** is fully open for business.

> One org per account: if you already own an org and need another, contact **info@imotara.com**.

## Member roles

- **Owner** — one per org. Full control, including deleting the org.
- **Admin** — can manage members, licenses, teams, and settings. Cannot delete the org or change the owner's role.
- **Member** — a regular user whose plan is provided by the org.

### Making someone an admin
Admins are made by **role change** — the person must be in the org first.

1. Invite them (see below) — the invite form's role dropdown offers **member** or **admin**, so you can invite someone straight in as an admin.
2. Or promote an existing member: open **Org dashboard → Members**, find the person, and change their role to **admin**.
3. Both the owner and existing admins can change roles. Nobody can change the owner's role or remove the owner.

## Inviting members

All invite paths respect your seat limit, and a person can only occupy one org seat at a time (joining a new org releases their old membership automatically).

### Invite one person by email
1. Open **Org dashboard → Members** → the **"Invite a member"** form.
2. Enter their email, pick a role (member or admin), and click **"Send invite."**
3. They receive an email with an **"Accept invitation →"** link. **Invites expire after 7 days** (re-inviting the same email refreshes the link).
4. The invite is **tied to the invited email** — they must sign in with that exact email to accept. Once accepted, they appear in your members list.

### Bulk invite via CSV
1. Open **Org dashboard → Members** → the **CSV bulk import** area.
2. Prepare a CSV with rows of **`email,role`** (a header row is fine; role defaults to member). Up to **500 rows per batch**.
3. Upload the file — the page shows the parsed rows — then click send.
4. You get a per-row summary: **invited / skipped / errors**. Already-members and already-pending invites are skipped, invalid emails are flagged, and if seats run out, remaining rows report "No seats available."
5. Bulk import still sends each person an invite email they must accept — it doesn't silently add anyone.

### Members without a Google account
Imotara sign-in is normally Google-only, so the invite paths above assume the person can sign in with Google. If some of your members don't have (or can't use) a Google account — common for younger students, for example — contact **info@imotara.com**: we can set up their account directly and email them a link to choose their own password instead, which they then use to sign in at **imotara.com/login**. This isn't self-service from your org dashboard yet — it's arranged with Imotara support on request.

### Domain auto-join (NGO and EDU orgs only)
Ideal for "everyone with a school/organization email can join" setups.

1. In **Org dashboard → Settings**, open the domain section (shown for NGO and EDU orgs). Add your allowed email domains (e.g. `hopefoundation.org`), toggle auto-join on, and save. Your org must be active.
2. Share your durable join link: **imotara.com/org/join/your-org-name** (the link uses your org's web name, which comes from your organisation name).
3. Anyone whose email domain matches can open the link, sign in, and click **"Join [org]"** — the page shows the qualifying domains so people can check they match first.
4. The link is **reusable** — any number of eligible people can use it, unlike a one-person invite. People joining this way always join as regular members.

### When seats run out
Every path is capped by your seat count. If you see **"No seats available"**, your org needs more seats — contact **info@imotara.com** and we'll raise your seat limit. Org owners and admins can't change their own seat count.

## Giving members the right plan

A member's effective plan is worked out like this, from highest priority to lowest:

1. **A license assigned from a pool** — beats everything.
2. **A per-member override** — a plan you set for one specific person.
3. **The higher of the org's default plan vs the member's own personal plan.** If your org's plan outranks their personal subscription, they get the org plan; if their personal plan is higher, they keep it. The better one always wins — nobody is downgraded by joining.
4. **Free** — if none of the above apply.

In plain terms:

- **Org default plan:** every member automatically gets your org's plan just by being a member — nothing for them to activate. (Your org's plan and seat count are set by Imotara at activation; to change them, contact **info@imotara.com**.)
- **Per-member override:** in **Org dashboard → Members**, you can give one person a different plan than the org default (say, one higher-tier seat inside your org). Clearing the override returns them to the default.
- **License pools:** a pool is a batch of licenses of a specific plan that Imotara issues to your org (e.g. "50 Pro licenses"). Your admins then hand out individual licenses from the pool on the **Org dashboard → Pool** page, and can withdraw them again. When a member leaves, their pool license is freed up automatically.
- **Checking someone's plan:** the **Org dashboard → Licenses** page shows seat counts (purchased / used / available), each member's effective plan, and recent activity.

## Cohorts / Teams

Group your members — a class, a department, a beneficiary group — and set the AI companion's tone per group. EDU orgs see these as **Classrooms**; enterprises see **Teams/Departments** (same feature).

1. Open **Org dashboard → Teams** ("Teams & Groups").
2. **Create a cohort:** give it a name (e.g. "Class 10A" or "Sales Team"), an optional description, an optional seat limit, and a **tone policy**: **🤝 Close Friend**, **🌿 Calm Companion**, **🎯 Coach**, or **📚 Mentor** (defaults to Close Friend).
3. **Add members:** expand the cohort and use the **"Add members"** picker. Only active org members can be added; if the cohort has a seat limit and it's full, you'll be told.
4. Edit or delete cohorts, and remove members from them, from the same page.

## Analytics — and the privacy promise to your members

- **Org dashboard → Analytics** shows **aggregate** engagement only: active users, total activity, average session length, active days.
- **You can never see any individual member's conversations, moods, or private data — by design.** This is a hard boundary, not a setting. Members are told the same thing, which is what makes org-provided Imotara feel safe to actually use.
- **Org dashboard → Audit** keeps a record of org actions — invites, role changes, removals, plan changes — with who did what and when.

## What your members see

- A **"Managed by [Your Org]" badge** in their app (**Settings → Your plan**), with your org type's icon and their role.
- **No personal upgrade prompts** — their plan comes from you, so they're never nudged to buy one.
- Their individual chats and history remain completely private to them.

## Removing a member

1. Open **Org dashboard → Members** and use the remove control next to their name.
2. Their seat is freed immediately, and their account returns to Free (or to their own personal subscription, if they have one). If they held a pool license, that pool capacity is freed too.
3. You can't remove yourself, and nobody can remove the owner.

## NGO verification (optional)

NGO and EDU orgs can submit a verification document — for an NGO, a public link to your 80G / FCRA / registration certificate; for EDU, an affiliation letter — in **Org dashboard → Settings**, under the verification section. Imotara reviews it and emails you the decision.

**Important:** verification is **optional** and is **not required** to receive discounted NGO/EDU pricing — the discount applies regardless. Verification is simply a record-keeping step.

NGO and EDU orgs that are active with at least 10 members for 30+ days can also fetch a printable **"Emotional Wellness Champion" certificate**, and org admins can pull an **impact report** (a grant-friendly summary of engagement, delivered as a web page you can print).

## Deleting your organization (owner only)

1. Only the **org owner** can do this — admins and members see a support-contact link instead. Imotara support cannot delete your org for you; it's deliberately the owner's own informed choice.
2. Go to **Org dashboard → Settings → Danger zone**.
3. Type your organization's **exact name** into the confirmation box (the **"Permanently delete organisation"** button stays disabled until it matches), click it, and confirm the browser dialog.
4. Everything org-related is removed — members, invites, pools, teams, and the audit history — and **every member's plan reverts to Free** (or their own personal subscription). This is **irreversible**.

## Honest status: what's coming soon

We'd rather tell you plainly:

- **LMS / website embed** — the embed section in Settings is marked **"Coming soon"** and isn't functional yet.
- **Referral commissions (NGO)** — you can create referral codes today, but commission tracking and payouts aren't live yet. Please don't count on referral revenue until we announce it.
- **SSO / SAML sign-in (EDU/Enterprise)** — you can save your identity-provider details in Settings, then contact us to activate it; it isn't fully self-service yet.
- **Custom branding (EDU/Enterprise)** — this one works today: set your logo, accent color, and a brand name that appears in your members' app header.

Questions at any point? **info@imotara.com** — we love helping orgs get set up.
