# Product Requirements Document

**Product Name:** Note Sharer  
**Version:** 0.1 (working draft)  
**Date:** November 10, 2025

---

## 1) Overview

**Elevator pitch:** Note Sharer is a campus‑specific marketplace where students upload high‑quality notes, class overviews, Quizlet sets, syllabi, and other student-created study resources. Contributors earn credits from uploads and upvotes, then spend those credits to access others’ materials—solving the free‑rider problem and reducing reliance on paywalled platforms like Chegg or Brainly. Explicit academic-integrity guardrails ensure tests, quizzes, assignments, and answer keys are never allowed.
   
**Problem statement:** Students struggle to find consolidated, high‑quality, course‑specific study resources. Existing solutions (group chats, random Drive folders, or paywalled sites) are fragmented, low‑signal, and don’t reward contributors—creating a free‑rider dynamic and uneven quality. A campus‑scoped platform with aligned incentives is needed to increase the supply of high‑quality materials without charging cash. Finally, this application will reduce the unfair advantage held by members of some Greek life organizations that share study materials exclusively among their members.

**Primary goals:**
1. Centralize course‑specific study materials for a single university (MVP scope).
2. Implement a fair credit economy: earn credits via quality uploads; spend credits to unlock downloads.
3. Ensure quality via approval/rating system and verified course enrollment to prevent spam and low-quality content.
4. Protect academic integrity and IP via strict content policies and automated screening.
5. Make discovery simple (per‑course feeds, basic search) and onboarding low‑friction.
6. Enforce strict prohibitions on uploading tests, quizzes, assignments, or instructor-provided materials.
7. Provide anonymous identity (verification + random names) to protect privacy while maintaining accountability.

**Non-goals:** Hosting copyrighted textbooks or publisher PDFs; facilitating cheating (current exams, answer keys, graded solutions); multi‑university support in MVP; cash payouts or crypto tokens (credits are non‑monetary).

**Success metrics (North Star + guardrails):**  
North Star = monthly “two‑sided actives rate” (% of actives who both upload and download).  
Guardrails: D1/D7 activation (first upload within 7 days), average upvotes per upload, time to first download, upload:download ratio by course, moderation incidents per 100 uploads and time‑to‑takedown, 30‑day retention (contributors vs. consumers), % downloads funded by credits vs. free‑download vouchers, new‑upload discovery rate (≥1 view within 48h), duplicate‑detect rate & false‑positive rate, and AI quality‑reject rate.

**Target users & personas:** Primary: undergraduates at California Polytechnic State University, San Luis Obispo (Cal Poly SLO), focusing on high‑enrollment intro/intermediate courses. Secondary: graduate TAs and power contributors sharing structured notes. Supporting: course/community moderators (trusted students or staff).

**Market & competitive context (optional):** Alternatives: Chegg, Brainly, Course Hero, Quizlet, and informal channels (Discord/GroupMe/WeChat/Slack, Google Drive dumps). Differentiators: campus‑scoped, credit‑based incentives tied to quality (upvotes), lower reliance on cash paywalls.

---

## 2) Scope

### MVP Core Focus: Upload Notes & Find Notes

The MVP focuses exclusively on the two core user actions:
1. **Upload notes**: Users can upload study materials (notes, class overviews) to courses
2. **Find notes**: Users can browse and search for notes by course and download them

All other features (voting, comments, sharing, advanced search) are deferred to post-MVP.

- **MVP (must-haves) — confirmed:**
  - **User accounts & identity:**
    - calpoly.edu-only email verification (required for account creation)
    - **Anonymous identity system**: Upon verification, users receive a randomly generated name (e.g., "PurpleElephant42", "SwiftTiger89") in Kahoot style
    - Random names are unique, immutable for MVP, and provide identity without exposing PII
    - Real email/identity visible only to moderators for abuse handling
    - Profiles tied to Cal Poly SLO identity (no SSO in V1)
  
  - **Course spaces:**
    - Per‑course spaces (Dept + Course # + Term) with browse and basic search
    - Pre‑seeded catalog of ~50 top high‑enrollment courses for current term
    - Users can submit additional courses for moderator review
  
  - **Upload resources:**
    - PDF only in V1 (max 25 MB per file)
    - External links to Quizlet/Drive for student-generated content
    - Required metadata: course, title, resource type, week/topic (optional), tags (optional)
  
  - **Allowed Resource types:**
    - **Lecture Notes**: Student-created notes from lectures
    - **Study Guides**: Student-created study materials and summaries
    - **Class Overviews**: In-depth course descriptions including structure, content overview, difficulty assessment, workload expectations, and student opinions (complementary to PolyRatings but course-focused rather than professor-focused). These earn credits separately (see credit system below).
    - **Links**: External links to user/student-generated content (Quizlet study resources, etc.)
  
  - **Strictly Prohibited Resource Types:**
    - **Tests, quizzes, midterms, finals** (any evaluated assessments, even if provided by instructor)
    - **Assignments or graded problem sets** (any work that is or was graded)
    - **Answer keys or solution sets** for tests/assignments
    - **Instructor-provided materials** (unless explicitly student-created summaries/notes)
    - **Copyrighted textbooks or publisher PDFs**
  
  - **Credit economy & fairness system:**
    - **Signup bonus**: 2 free downloads (non‑transferable vouchers, separate from credits)
    - **Upload credits** (earned only after approval):
      - Lecture Notes: +3 credits upon approval
      - Study Guides: +3 credits upon approval
      - Class Overviews: +5 credits upon approval (higher value for comprehensive course information)
      - Links: +1 credit upon approval
    - **Download costs**: 3 credits per download
    - **Quality control to prevent spam**:
      - All uploads require **approval** before credits are awarded
      - New uploads enter a "pending" state visible only to moderators
      - Moderators review for: quality, relevance, academic integrity compliance, legibility
      - Approved uploads become visible and credits are awarded
      - Rejected uploads: user notified with reason, no credits awarded, no cooldown for first rejection
      - **Repeated rejections** (3+ within 30 days): 7-day upload cooldown, credits may be revoked if abuse detected
      - **Rating system** (post-approval): Users can rate downloads (1-5 stars), visible to others, influences future approval speed for trusted contributors
    - **Fairness mechanisms**:
      - Credits only awarded after human moderation approval (prevents spam)
      - Rejection reasons are transparent to users
      - Appeal process: users can request re-review if they believe rejection was incorrect
      - Trusted contributors (high approval rate, high ratings) get faster approval queue
  
  - **Teaser preview:**
    - Low‑res first page preview with "Unlock with 3 credits" overlay
    - No text copy/download until unlocked with credits
  
  - **AI pre‑screening (automated checks before moderation):**
    - Keyword detection: scan for prohibited terms ("exam", "midterm", "quiz", "assignment", "answer key", etc.) → flag for moderator review or auto-reject
    - Perceptual hash (pHash) duplicate detection → flag duplicates
    - OCR legibility checks (min text ratio, resolution, page count) → flag low-quality
    - Auto-reject only for obvious violations (e.g., detected answer keys); borderline cases go to moderation queue
  
  - **Reporting & moderation:**
    - Report categories: IP/cheating/abuse/low-quality/spam
    - **Moderators**: project developers + teachers/TAs (elevated permissions)
    - Moderators can: approve/reject uploads, takedown reported content, revoke credits, apply cooldowns
    - Basic moderation queue: pending uploads, reported content
  
  - **Download/access gating:**
    - Downloads require credits (or free download vouchers)
    - Signed URLs for secure file access (short TTL)
  
- **Deferred to post-MVP (not in initial release):**
  - **Voting system** (upvote/downvote) — moved to post-MVP
  - **Comments** — moved to post-MVP
  - **Sharing features** — moved to post-MVP
  - **Contributor badges/reputation** — moved to post-MVP
  - **Advanced search, filters, recommendations** — moved to post-MVP
  - **Contributor profile pages** — moved to post-MVP
  - Cal Poly SSO with Duo 2FA
  - JPG/PNG, PowerPoint, .docx upload support
  - Course‑enrollment verification
  - Admin analytics dashboards
- **Out of scope:**
  - Cash payouts; marketplace for money.
  - Hosting copyrighted textbooks/publisher PDFs; cheating content (e.g., current exams/answer keys).

---

## 3) User Journeys

- **Primary flows:**
  - Onboarding / Signup
  - Core task flow
  - Course discovery & selection (pre‑seeded list + submit‑for‑review)
  - Contributor discovery (browse by handle)
- **User stories (Given/When/Then) — samples:**
  - Given I have a calpoly.edu email, when I sign up and verify via code, then I receive a random anonymous name (e.g., "PurpleElephant42") and can browse courses.
  - Given I want to upload notes, when I select a PDF and fill in course/metadata, then my upload enters pending state and awaits moderator approval before I earn credits.
  - Given I uploaded a Class Overview, when it's approved by a moderator, then I earn 5 credits (higher than regular notes).
  - Given I browse a course, when I see available resources, then I can view teaser previews and download with 3 credits or a free voucher.
  - Given I try to upload a file containing "exam", "midterm", "quiz", etc., when the AI detects prohibited keywords, then my upload is auto-rejected or flagged for moderator review.
  - Given I upload irrelevant/unusable content, when moderators reject it 3+ times within 30 days, then I receive a 7-day upload cooldown.
  - Given my upload is rejected, when I view the rejection reason, then I can appeal if I believe the decision was incorrect.
  - Given I am a trusted contributor (high approval rate, high ratings), when I upload new content, then my uploads are prioritized in the moderation queue.
- **Edge cases:** Missing course → user submits course; moderator approves/denies with reason; dedupe/merge cross‑listed courses.

---

## 4) Requirements

### 4.1 Functional Requirements

**Core MVP Functions (Upload & Find):**

- **Account creation & identity:**
  - calpoly.edu-only email verification code flow
  - Upon successful verification, system automatically assigns a **random anonymous name** (e.g., "PurpleElephant42", "SwiftTiger89")
  - Random names are unique, immutable, and provide identity without exposing PII
  - Real email/identity visible only to moderators for abuse handling
  - Profile setup: select university (Cal Poly SLO) and enrolled courses (optional, for personalization)

- **Course spaces:**
  - **Hybrid catalog**: pre‑seed ~50 top high‑enrollment courses for current term
  - Users can submit additional courses **for moderator review**
  - Browse courses by department/course number
  - Basic search: search by course code, course name, or tags

- **Upload resources (core function #1):**
  - Files: **PDF only** in V1 (max 25 MB)
  - Links: External links to Quizlet/Drive for student-generated content
  - Required metadata: course, title, resource type (Lecture Notes/Study Guide/Class Overview/Link)
  - Optional metadata: week/topic, tags
  - Upload flow:
    1. User selects file/link and fills metadata
    2. AI pre-screening runs (keyword detection, duplicate check, quality check)
    3. Upload enters "pending" state (visible only to user and moderators)
    4. Moderator reviews and approves/rejects
    5. If approved: becomes visible to all users, credits awarded, user notified
    6. If rejected: user notified with reason, can appeal, no credits awarded

- **Find & download resources (core function #2):**
  - Browse resources within a course (sorted by Recent by default)
  - Basic search within course (by title, tags)
  - View teaser preview (blurred first page)
  - Download requires: 3 credits OR free download voucher
  - After download: file accessible via signed URL (short TTL)

- **Credit system (fairness-focused):**
  - **Signup bonus**: 2 free downloads (non‑transferable vouchers, separate from credits)
  - **Earn credits** (only after approval):
    - Lecture Notes: +3 credits
    - Study Guides: +3 credits
    - Class Overviews: +5 credits (higher value for comprehensive course information)
    - Links: +1 credit
  - **Spend credits**: 3 credits per download
  - **Quality control**: All uploads require moderator approval before credits are awarded
  - **Spam prevention**: 
    - Repeated rejections (3+ within 30 days) → 7-day upload cooldown
    - Abuse detection → credits may be revoked, account suspension possible
  - **Trusted contributors**: High approval rate + high ratings → faster approval queue

- **Teaser preview (pre‑unlock):**
  - Show blurred, low‑res first page with "Unlock with 3 credits" overlay
  - No text copy/download until unlocked with credits or voucher

- **AI pre‑screening pipeline:**
  - **Keyword detection**: Scan for prohibited terms ("exam", "midterm", "quiz", "assignment", "answer key", etc.) → flag for moderator review or auto-reject
  - **Duplicate detection**: Perceptual hash (pHash) to detect near‑duplicates (Hamming‑distance threshold) → flag duplicates
  - **Quality checks**: OCR legibility (text ratio, min resolution, page count, non‑blank pages) → flag low-quality
  - Auto-reject only for obvious violations; borderline cases go to moderation queue

- **Moderation & reporting:**
  - **Moderation queue**: All pending uploads visible to moderators
  - **Reporting**: Users can report content (categories: IP/cheating/abuse/low-quality/spam)
  - **Moderators**: project developers + teachers/TAs (elevated permissions)
  - Moderator actions: approve/reject uploads, takedown reported content, revoke credits, apply cooldowns
  - **Transparency**: Rejection reasons visible to users, appeal process available

- **Download/access control:**
  - Downloads gated by credits (3 credits) or free download vouchers
  - Signed URLs for secure file access (short TTL, e.g., 1 hour)

### 4.2 Non-Functional Requirements
- **Performance:** p95 page load < 2.5s; critical actions p95 < 300ms  
- **Reliability:** 99.9% uptime target; graceful degradation  
- **Security:** AuthN/AuthZ (session or token), least privilege, OWASP Top 10 mitigations  
- **Privacy & Compliance:** GDPR/CCPA-ready; **anonymous identity by default** (random names like "PurpleElephant42" assigned upon verification; no public emails/real names); student privacy considerations; content takedown & DMCA process; real identity visible only to moderators for abuse handling  
- **Accessibility:** WCAG 2.2 AA  
- **Storage & Limits:** PDF only in V1; max 25 MB per file; fast-follow to add JPG/PNG (≤10 MB each).  
- **Internationalization:** _If applicable_  
- **Analytics & Telemetry:** event list + dashboards  
- **Observability:** structured logs, traces, alerts  
- **Browser/Device Support:** Evergreen browsers + recent iOS/Android  
- **Identity Roadmap:** V1 email/password; V2 campus SSO with Duo MFA integration  

---

## 5) Data & System Design

**Data model (entities & relationships):**
- **University → Term → Course** { dept, number, title, canonical_id, status: seeded\|pending\|approved\|rejected }
- **Resource** { uploader_id, course_id, type: pdf\|link\|class_overview, title, tags, file_url, link_url, status: pending\|approved\|rejected, approval_date, rejection_reason, downloads, rating_avg, rating_count }
- **User** { email(@calpoly.edu), random_name (e.g., "PurpleElephant42"), profile, credits, vouchers, approval_rate, rejection_count, last_rejection_date, cooldown_until }
- **ModerationQueue** { resource_id, status: pending\|approved\|rejected, moderator_id, review_date, rejection_reason }
- **Report** { resource_id, reason, notes, status, reporter_id, created_at }
- **CourseSubmission** { proposed dept/number/title, submitter_id, review_status, moderator_id }
- **Rating** { user_id, resource_id, rating: 1-5, created_at } (post-MVP, but data model prepared)

**APIs & Integrations:** Email provider for verification (calpoly.edu domain enforcement); file storage (cloud object storage); future: Cal Poly SSO + Duo MFA; AI services for pre‑screening (OCR legibility scoring & perceptual hashing) and username moderation; optional: link unfurling for Quizlet/Drive.

**Notifications (email/in-app):** verification codes, moderation outcomes, upload upvote milestones, unlock confirmations.

**Feature flags & rollout plan:** gate teaser preview, downvotes, and pHash thresholds; gradual ramp for course submissions and mod tools.

**Risks & assumptions:** Academic integrity risks; copyright/IP takedowns; cold‑start for credit economy; abuse/spam without SSO; need course canonicalization (Dept/Course/Term).  
**AI screening risks:** false positives blocking legit uploads; adversarial evasion; privacy considerations for OCR.  
**Mitigations:** transparent rejection reasons, appeal flow, tunable thresholds, human‑in‑the‑loop review.

**Credit System Fairness & Quality Control:**

The credit system is designed to drive quality uploads while ensuring fairness and preventing spam:

**How it drives users:**
- Credits are the currency for accessing content (downloads cost 3 credits)
- Users must contribute quality content to earn credits
- Higher-value content (Class Overviews) earns more credits (+5 vs +3)
- Signup bonus (2 free downloads) allows new users to explore before contributing

**How it ensures fairness:**
- **Approval requirement**: Credits only awarded after human moderator approval (prevents spam/low-quality)
- **Transparent process**: Users see rejection reasons and can appeal
- **Spam prevention**: 
  - Repeated rejections (3+ in 30 days) → 7-day cooldown
  - Abuse detection → credits revoked, possible account suspension
- **Trusted contributor benefits**: High approval rate + high ratings → faster approval queue (incentivizes quality)
- **No gaming**: Credits tied to approved content, not just upload attempts

**Quality control mechanisms:**
1. **AI pre-screening**: Catches obvious violations (prohibited keywords, duplicates, low quality) before moderation
2. **Human moderation**: Final approval/rejection decision with context
3. **Rating system** (post-MVP): Users rate downloads (1-5 stars), influences future approval speed
4. **Appeal process**: Users can request re-review if they believe rejection was incorrect
5. **Cooldowns**: Prevent spam uploads from repeat offenders

**Open questions:**
1) Should Class Overviews have different download costs (e.g., 5 credits) given their higher value?  
2) Should trusted contributors earn bonus credits (e.g., +1 extra credit per upload after 10 approved uploads)?  
3) Course list source of truth updates between terms (automation vs. manual).

---

## 6) Release Plan

**Milestones:**
- **M0 (design):** finalize data model, moderation policy, course seeding list (~50 top courses), credit system fairness rules, approval workflow.
- **M1 (MVP - Core):** 
  - Auth with random anonymous names (Kahoot-style)
  - Hybrid course catalog + review flow
  - PDF upload with approval workflow
  - PDF download with credit gating
  - Credits & vouchers system
  - Teaser preview
  - AI pre‑screening (keyword detection, pHash, OCR)
  - Basic moderation queue (approve/reject uploads)
  - Reporting system
  - **Explicitly excluded**: voting, comments, sharing, advanced search, contributor profiles
- **M2 (post-MVP):** 
  - Voting system (upvote/downvote)
  - Comments
  - Contributor profiles & reputation
  - Advanced search, filters
  - JPG/PNG support
  - Rating system (1-5 stars)
- **M3 (beta):** 
  - Analytics dashboards
  - Enrollment verification
  - Trusted contributor fast-track
- **M4 (GA):** 
  - Duo SSO
  - Dynamic pricing
  - Advanced moderation tools
  - Recommendations

**Launch criteria & readiness checklist:** clearly documented content policy (Moderate), mod SLAs, takedown & appeals flow, storage quotas, abuse rate thresholds, basic analytics dashboards online.

**Pricing & monetization:** credits only; **no cash** in V1.

**Post-launch KPIs & experiments:** tune credit earn/spend, evaluate dynamic pricing, test teaser variants, measure new‑upload discovery and creator retention.

---
