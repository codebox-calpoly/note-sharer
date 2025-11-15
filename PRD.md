# Product Requirements Document

**Product Name:** Note Sharer  
**Version:** 0.1 (working draft)  
**Date:** November 10, 2025

---

## 1) Overview

**Elevator pitch:** Note Sharer is a campus‑specific marketplace where students upload high‑quality notes, Quizlet sets, syllabi, and other course resources. Contributors earn credits from uploads and upvotes, then spend those credits to access others’ materials—solving the free‑rider problem and reducing reliance on paywalled platforms like Chegg or Brainly.

**Problem statement:** Students struggle to find consolidated, high‑quality, course‑specific study resources. Existing solutions (group chats, random Drive folders, or paywalled sites) are fragmented, low‑signal, and don’t reward contributors—creating a free‑rider dynamic and uneven quality. A campus‑scoped platform with aligned incentives is needed to increase the supply of high‑quality materials without charging cash. Finally, this application will reduce the unfair advantage held by members of some Greek life organizations that share study materials exclusively among their members.

**Primary goals:**
1. Centralize course‑specific study materials for a single university (MVP scope).
2. Implement a credit economy: earn credits via uploads and upvotes; spend credits to unlock downloads.
3. Ensure quality via upvotes, contributor reputation, and verified course enrollment.
4. Protect academic integrity and IP via moderation tools and clear content policies.
5. Make discovery simple (per‑course feeds, search, tags) and onboarding low‑friction.

**Non-goals:** Hosting copyrighted textbooks or publisher PDFs; facilitating cheating (current exams, answer keys, graded solutions); multi‑university support in MVP; cash payouts or crypto tokens (credits are non‑monetary).

**Success metrics (North Star + guardrails):**  
North Star = monthly “two‑sided actives rate” (% of actives who both upload and download).  
Guardrails: D1/D7 activation (first upload within 7 days), average upvotes per upload, time to first download, upload:download ratio by course, moderation incidents per 100 uploads and time‑to‑takedown, 30‑day retention (contributors vs. consumers), % downloads funded by credits vs. free‑download vouchers, new‑upload discovery rate (≥1 view within 48h), duplicate‑detect rate & false‑positive rate, and AI quality‑reject rate.

**Target users & personas:** Primary: undergraduates at California Polytechnic State University, San Luis Obispo (Cal Poly SLO), focusing on high‑enrollment intro/intermediate courses. Secondary: graduate TAs and power contributors sharing structured notes. Supporting: course/community moderators (trusted students or staff).

**Market & competitive context (optional):** Alternatives: Chegg, Brainly, Course Hero, Quizlet, and informal channels (Discord/GroupMe/WeChat/Slack, Google Drive dumps). Differentiators: campus‑scoped, credit‑based incentives tied to quality (upvotes), lower reliance on cash paywalls.

---

## 2) Scope

- **MVP (must-haves) — confirmed:**
  - User accounts (calpoly.edu-only email/password) with emailed verification code; profiles tied to a Cal Poly SLO identity (no SSO in V1).
  - Per‑course spaces (Dept + Course # + Term) with browse and basic search.
  - Upload resources (PDF only in V1; external links like Quizlet/Drive) with metadata (course, week/topic, tags).
  - **Credit economy:** Upload +5 credits; per‑upvote +1 (cap +10 per item); download costs 3; **signup bonus = 2 free downloads** (non‑transferable vouchers separate from credits. that way, even if we later change the download costs to b a function of rating, new users will receive the same number of free downloads).
  - **Teaser preview:** low‑res first page with “Unlock with 3 credits” overlay (no copy/download until unlocked).
  - **Voting:** upvote/downvote system to promote high-quality uploads.
  - **Reporting & moderation:** categories include IP/cheating/abuse; **moderators = project developers + teachers/TAs** (elevated report weight, takedown ability).
  - **AI pre‑screening:** perceptual‑hash duplicate detection + OCR legibility checks.
  - Download/access gating using credits.
- **Nice-to-haves (post-MVP):**
  - Cal Poly SSO with Duo 2FA.
  - JPG/PNG, PowerPoint, .docx upload support.
  - Comments and contributor badges.
  - Advanced search, filters, and recommendations.
  - Course‑enrollment verification to reduce spam.
  - Admin analytics dashboards and abuse tooling.
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
  - Given I have a calpoly.edu email, when I sign up and verify via code, then I can create a pseudonymous handle and pick my courses.
  - Given I uploaded a PDF to a course, when others upvote it, then I earn credits (up to +10 per item) that I can spend to unlock other resources.
  - Given I browse a course, when I toggle “Recent” or “Top,” then the list reorders and remembers my choice next time.
  - Given I see a suspicious upload, when I report it for IP/cheating, then moderators are notified and can takedown quickly.
- **Edge cases:** Missing course → user submits course; moderator approves/denies with reason; dedupe/merge cross‑listed courses.

---

## 4) Requirements

### 4.1 Functional Requirements
- Account creation, login, logout; calpoly.edu-only email verification code flow.
- Profile setup; select university (Cal Poly SLO) and enrolled courses; choose a unique **pseudonymous handle** (campus‑verified; no PII shown publicly). Public contributions display handle only; mods can see the real account if needed for abuse handling.
- Create course spaces and sections using a **hybrid catalog**: pre‑seed ~50 top high‑enrollment courses for the current term; allow users to submit additional courses **for moderator review**.
- Upload resources (files: **PDF only** in V1; links: Quizlet/Drive) with tagging.
- Browse/search within a course; **Sort toggle:** Recent (default) or Top (time‑decay); remember last choice per user; **filter by contributor handle**; contributor profile pages list public uploads & reputation.
- **Credit system (V1):** Upload +5 credits; per‑upvote +1 credit (cap +10 per item); download costs 3 credits; **signup bonus = 2 free downloads** (non‑transferable vouchers separate from credits).
- **Teaser preview (pre‑unlock):** show blurred, low‑res first page with “Unlock with 3 credits” overlay; no text copy/download until unlocked.
- **AI pre‑screening pipeline:** On upload, compute a perceptual hash (pHash) to detect near‑duplicates (Hamming‑distance threshold), run legibility/quality checks (OCR text ratio, min resolution/page count, non‑blank pages), and auto‑reject or flag borderline items for moderator review.
- **Voting (upvote/downvote), reporting** (categories incl. IP/cheating/abuse), and **basic moderation queue** (mods see reporter notes + audit trail). **Moderators at launch:** mixed model — project developers + teachers/TAs; teachers/TAs have elevated report weight and takedown ability.
- Download/access control behind credit spend.

### 4.2 Non-Functional Requirements
- **Performance:** p95 page load < 2.5s; critical actions p95 < 300ms  
- **Reliability:** 99.9% uptime target; graceful degradation  
- **Security:** AuthN/AuthZ (session or token), least privilege, OWASP Top 10 mitigations  
- **Privacy & Compliance:** GDPR/CCPA-ready; **pseudonymous by default** (no public emails/real names); student privacy considerations; content takedown & DMCA process  
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
- **Resource** { uploader_id, course_id, type: pdf\|link, title, tags, file_url, link_url, upvotes, downvotes, downloads }
- **User** { email(@calpoly.edu), handle, profile, credits, vouchers }
- **Vote** { user_id, resource_id, value: +1\|-1 }
- **Report** { resource_id, reason, notes, status, reporter_id }
- **CourseSubmission** { proposed dept/number/title, submitter_id, review_status, moderator_id }

**APIs & Integrations:** Email provider for verification (calpoly.edu domain enforcement); file storage (cloud object storage); future: Cal Poly SSO + Duo MFA; AI services for pre‑screening (OCR legibility scoring & perceptual hashing) and username moderation; optional: link unfurling for Quizlet/Drive.

**Notifications (email/in-app):** verification codes, moderation outcomes, upload upvote milestones, unlock confirmations.

**Feature flags & rollout plan:** gate teaser preview, downvotes, and pHash thresholds; gradual ramp for course submissions and mod tools.

**Risks & assumptions:** Academic integrity risks; copyright/IP takedowns; cold‑start for credit economy; abuse/spam without SSO; need course canonicalization (Dept/Course/Term).  
**AI screening risks:** false positives blocking legit uploads; adversarial evasion; privacy considerations for OCR.  
**Mitigations:** transparent rejection reasons, appeal flow, tunable thresholds, human‑in‑the‑loop review.

**Open questions:**
1) Dynamic pricing: should high‑quality (high‑upvote) resources cost more (with per‑course floor/ceiling)?  
2) Exact Top ranking time‑decay function.  
3) Course list source of truth updates between terms (automation vs. manual).

---

## 6) Release Plan

**Milestones:**
- **M0 (design):** finalize data model, moderation policy, course seeding list (~50 top courses).
- **M1 (MVP):** auth, hybrid course catalog + review flow, PDF upload/download, credits & vouchers, teaser preview, voting (up/down), reporting & basic mod queue, AI pre‑screen (pHash + OCR).
- **M2 (beta):** JPG/PNG support, analytics dashboards, search filters, enrollment verification.
- **M3 (GA):** Duo SSO, dynamic pricing, advanced moderation tools, recommendations.

**Launch criteria & readiness checklist:** clearly documented content policy (Moderate), mod SLAs, takedown & appeals flow, storage quotas, abuse rate thresholds, basic analytics dashboards online.

**Pricing & monetization:** credits only; **no cash** in V1.

**Post-launch KPIs & experiments:** tune credit earn/spend, evaluate dynamic pricing, test teaser variants, measure new‑upload discovery and creator retention.

---