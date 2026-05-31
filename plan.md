# Cadence Build Plan

A milestone-sequenced plan for shipping Cadence v1. The principle is **end-to-end thin slice first** — get the full loop working with one dimension, then thicken each layer in turn.

## Operating principles

1. **Ship end-to-end before thickening any layer.** M1 produces a working single-dimension analyzer. Don't add the second dimension until the loop works.
2. **Introduce each primitive when its absence hurts, not before.** No queue until analyses time out. No vector DB until trends require it. The point is to learn *why* each primitive exists by feeling its absence first.
3. **Boring stack, deliberate.** Weekend time goes into the rubric prompt and the analyzer, not into infrastructure exotica.
4. **Calibrated honesty stays at the front.** Every UI surface that shows a score also shows its confidence label. This is a design constraint, not a feature.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend (PWA) | Next.js (App Router) | Ecosystem fit, easy PWA via manifest |
| Backend | Same Next.js app — API routes / server actions | One repo, one deploy unit |
| Hosting | Vercel | Best Next.js host, built-in cron, has blob storage |
| Database | Postgres on Supabase | You already use Supabase on Tripsmith — same auth, same client, pgvector available at M5 |
| Audio storage | Supabase Storage | Same product as the DB; one fewer dashboard and SDK to wrangle |
| Transcription | OpenAI Whisper API | ~$0.006/min, no infra to run |
| LLM analysis | Claude API | Strong on rubric/structured judgment |
| Email | Resend | Modern, simple, free tier sufficient |
| Queue | Deferred | Synchronous analysis in M1; introduce when timeouts force it |
| Vector DB | Deferred | Introduce at M5 via the pgvector extension on the existing Supabase Postgres |

## Milestones

### M1 — Single-session loop ✅ Shipped

**Deliverable:** A working PWA that records audio, uploads it, transcribes it, runs Word Precision analysis, and displays the result.

**Components:**
- PWA shell: Next.js app, manifest, install-to-home-screen, minimal styling
- Recording UI: tap-start / tap-stop button, Wake Lock active during recording, elapsed timer
- Audio upload to Supabase Storage via signed URL
- Transcription: server-side Whisper API call; store transcript text
- Analysis: server-side Claude call with the Word Precision rubric; return structured JSON (score 1–5, reasoning, 2–3 quoted examples)
- Result view: score + confidence label + reasoning + quoted examples

**Success criteria:**
- Record a 60-second clip on your phone, hit stop, see a Word Precision score with examples within ~30 seconds
- When you self-score the same clip blind against the rubric, you agree with Cadence's score (±1 point)

**Estimated effort:** 2 weekends.

**Key risks:**
- Whisper API latency on long clips → cap M1 recordings at 5 minutes
- Wake Lock unavailable on older iOS → degrade gracefully with a "keep your screen on" warning

### M2 — Four high-confidence dimensions ✅ Shipped

**Deliverable:** Same loop, but analysis covers Clarity, Conciseness, Confidence, and Word Precision. Result view shows all four with confidence labels.

**Components:**
- One analyzer prompt that returns all four dimensions as structured JSON (not four separate calls)
- Per-dimension UI cards (score, confidence label, reasoning, examples)
- "High-confidence headline" component: one prominent callout for the weakest dimension, marked as the focus for the day

**Success criteria:**
- Full four-dimension analysis runs reliably within ~45 seconds
- Self-scoring agreement: you agree with Cadence on 3 out of 4 dimensions for most sessions

**Estimated effort:** 1 weekend.

**Key risks:**
- Prompt drift across dimensions → enforce a single shared rubric schema, not per-dimension prompts

### M3 — Persistence and history ✅ Shipped

**Deliverable:** Sessions persist. You can see a list of past sessions and revisit any of them.

**Components:**
- Supabase Postgres with the typed `@supabase/supabase-js` client (matches your Tripsmith pattern — no new ORM to learn)
- Schema: `users`, `sessions`, `transcripts`, `analyses`
- Session list view (latest first) + session detail view
- Single-user hardcoded — no login flow yet

**Success criteria:**
- 10+ sessions stored without data loss
- Session list loads in <500ms
- Any past session re-openable with its full analysis

**Estimated effort:** 1 weekend.

### M4 — Daily digest email ✅ Shipped

**Deliverable:** Every weekday morning, you get an email summarizing yesterday's recordings with the best/worst dimension callouts.

**Components:**
- Vercel Cron Job at 7am ET, Mon–Fri
- Digest generator: pulls yesterday's sessions, picks best + worst dimension across them, generates email body via Claude
- Resend for delivery
- Empty-day handling: skip the email if no recordings yesterday (don't shame the user)

**Success criteria:**
- Email arrives within 5 minutes of 7am ET on 5 consecutive weekdays
- "Best" and "worst" callouts feel sensible relative to the underlying analyses
- The email is readable in under 60 seconds

**Estimated effort:** 1 weekend.

**Key risks:**
- Silent cron failure → add a self-ping (e.g., POST to a healthcheck service) inside the cron handler so you find out the same day if it stops firing

### M5 — Open to friends (multi-user + custom domain) ✅ Shipped

**Deliverable:** Other people can sign up, record their own sessions, and receive their own daily digest at their own email. Cadence stops being a personal project and becomes shareable.

**Components:**
- **Auth:** Supabase Auth (email magic link is cheapest UX) or similar — replace the hardcoded single user
- **User-scoped data model:** add `user_id` to `sessions`, enforce RLS so users only see their own sessions
- **Per-user digest recipient:** the cron pulls each user's sessions independently and emails them at their own address (replaces the single `CADENCE_DIGEST_RECIPIENT` env var)
- **Custom domain in Resend:** verify a real domain (e.g., a subdomain of something Paahul owns), set up SPF/DKIM, swap `onboarding@resend.dev` → `coach@<domain>`. ~10 min of DNS work in the Resend dashboard
- **Invite flow:** simple — share a sign-up link; whoever clicks creates an account

**Why this milestone was pulled forward (ahead of trends, now M13):** Trends need weeks of data to be useful, so they don't lose value by waiting. Multi-user, on the other hand, gates real-world feedback from friends — pulling it forward maximizes the time Cadence is being used by more than one person.

**Why this milestone exists at all:** Resend's `onboarding@resend.dev` only delivers to the account owner. Moving to a verified domain is the prerequisite for sending email to anyone other than Paahul, which is the prerequisite for inviting friends.

**Paired Tripsmith work:** Tripsmith has a related email bug (share-button sends to Paahul instead of the dynamic recipient — likely the same `from`-address constraint). When the Cadence M5 domain work lands, pair it with a Tripsmith pass to verify a domain, swap Tripsmith's `from`, and confirm dynamic recipients work end-to-end. See `~/.claude/projects/-Users-paahulsikand-projects-tripsmith/memory/tripsmith_email_bug.md` for context.

**Estimated effort:** 2–3 weekends — auth alone is a chunk, and the RLS/data-model migration deserves care.

### M6 — Whisper-derived audio signals (Pace + Pronunciation Clarity) ✅ Shipped

**Deliverable:** Two new dimensions that finally let Cadence analyze the *speech*, not just the transcript. Addresses real friend feedback that v1 only reads what was said, not how it was said.

**Why this is next:** Friend feedback (verbatim): *"ye speech padta hai bas, thoda intonation and voice pe bi feedback deni chaiye and pronunciation. it analyses transcript, it should analyse the speech too."* Fair critique. Lowest-cost path to addressing it is to use signals we're already paying for and currently discarding — Whisper's `verbose_json` response includes per-word timestamps and per-word log-probabilities. No new service, no new infra. Just a different `response_format` parameter and some downstream computation.

**Components:**
- Change Whisper call to `response_format=verbose_json` (same model, same cost, richer output)
- Extract from the response:
  - Per-word timestamps → words-per-minute, pause distribution, sentence-end durations
  - Per-word `logprob` → confidence-of-recognition per word as a pronunciation-clarity proxy
  - Filler-word counts and disfluencies (false starts, repeated words) via regex on the transcript
- Add two new rubric dimensions, both at **high tool reliability**:
  - **Pace** — WPM ranges with anchors (150–180 is the standard speaking range; below 130 reads as draggy; above 200 reads as rushed). Also surfaces pause patterns.
  - **Pronunciation Clarity** — flags specific words a listener would have to work to catch. Framed as *intelligibility*, never as accent. Explicitly does NOT compare against native-speaker references.
- Result UI: each new dimension gets the same card pattern as the existing four; pronunciation examples link back to the specific word in the transcript

**Success criteria:**
- A clip you self-record at 240 WPM scores significantly worse on Pace than the same content at 170 WPM
- Words you deliberately mumble are flagged in Pronunciation Clarity examples
- The rubric still discriminates across all six dimensions (the prompt doesn't collapse into noise)

**Estimated effort:** ~3–4 hours. The Whisper response shape changes; the rubric prompt grows by two dimensions; the schema gains two more `dimensionResult` keys. No infrastructure work.

**Why this comes before M7 (queue):** The queue is invisible to the user; the new audio dimensions are immediately visible. Friend feedback was about the *product*, not the constraint. Ship product value first.

### M7 — Background analysis queue (remove the 2-min cap) ✅ Shipped

**Deliverable:** Recordings can be any length. The 2-minute cap in the Recorder goes away. Analyses run in the background after stop.

**Why this exists:** Vercel hobby's 60-second function timeout caps the synchronous `/api/analyze` path. A real meeting recording (5–15 min) blows through that. Today's band-aid is a client-side 2:00 cap with a visible "Max 2:00 per session" hint and an auto-stop. That hint is a promise to the user that the constraint is temporary.

**Components:**
- `analysis_status` enum + `analysis_error` text column on the `sessions` table (or a separate `analysis_jobs` table — TBD). Values: `pending` / `processing` / `completed` / `failed`.
- `/api/analyze` becomes a two-phase endpoint:
  - Phase 1 (synchronous, fast): create the session row with `analysis_status = 'pending'`, return `{ sessionId }` immediately
  - Phase 2 (background): a worker picks up the pending row and runs Whisper + Claude, then writes the transcript + analysis + flips status to `completed`
- **Worker runtime** — pick one:
  - **Inngest** (recommended) — dedicated job queue with retries, observability, generous free tier, clean Next.js SDK
  - Trigger.dev — similar shape, alternative if Inngest's pricing changes
  - Vercel Cron tick every minute that drains the queue — simplest but adds up-to-60s latency to every analysis
  - A Fly.io / Render worker polling the queue table — overkill for this scale
- Client changes:
  - `/sessions/[id]` becomes status-aware. If `pending`/`processing`, render a "Working" state mirroring the current recorder checklist
  - Subscribe to Supabase Realtime on the session row for live updates, or fall back to polling every 2s
  - Recorder removes the 2:00 cap, the timer-format change, the progress bar's urgent state, and the "Max 2:00 per session" hint
- Failure UX: when `status = 'failed'`, show the error on the session page with a "Re-run analysis" button that re-enqueues

**Success criteria:**
- A 10-minute recording analyzes successfully end-to-end without any client-side cap
- Median analysis turnaround is under 90 seconds wall-clock for a 5-minute clip
- A failed analysis is visible (not silently lost) and recoverable via re-enqueue

**Estimated effort:** 3–4 hours of focused work. The Inngest setup is mostly boilerplate; the schema migration + Realtime subscription pattern is the real work.

**Trigger to pull this in:** Either (a) you find a real friend repeatedly bumping into the 2-min cap, or (b) you're about to ship Cadence beyond friends-and-family. Whichever comes first.

**Gotchas learned shipping this:**
- **The Vercel-Inngest integration's auto-sync uses per-deploy URLs**, not the canonical custom domain. Per-deploy URLs (e.g. `cadence-abc123-paahul-s-projects.vercel.app`) have Vercel Deployment Protection on by default, which 401s Inngest's sync `PUT`. The failed syncs show up in Inngest's dashboard under "Unattached syncs" with the misleading message "could not reach your URL" — but the URL is fine, the protection layer is the problem.
- **Fix: manually sync the app from the Inngest dashboard pointing at the canonical URL** (`https://cadence.paahulhq.com/api/inngest`). The custom domain doesn't have deployment protection. Manual sync becomes the source of truth.
- **Inngest's `serve()` handler returns `{"message": "Unauthorized"}` on unauthenticated GET requests in production mode.** This is correct/expected behavior, not a bug. Don't waste 15 minutes thinking the handler is broken because a browser visit returns Unauthorized — it's locked down by design.
- **The `inngest` npm package's `createFunction` signature changed**: the trigger now lives inside the first config argument as a `triggers` array, not as a separate second argument. Old docs showing `createFunction(config, { event: "..." }, handler)` are stale; the current signature is `createFunction({ id, triggers: [{ event: "..." }], ... }, handler)`.

### M8 — Session-type tag at capture

**Deliverable:** An optional one-tap session-type selector at record time. The tag is stored on the session and passed into the rubric prompt as context, so analysis stops being context-blind.

**Why this is first in the pending queue:** Pulled forward out of M11 on the back of live user feedback. Today every session is graded against the same implicit bar, so a casual debrief reads as harshly as a board update. The tag makes *every* dimension's judgment context-aware — not just Tone Fit and Composure, which strictly require it (see `docs/foundation.md` §2.4, §2.6). It's the cheapest item left in the backlog and improves perceived fairness immediately, so it leads.

**Components:**
- `session_type` column on `sessions` — nullable, default `'general'`. Suggested values: `general` / `1:1` / `meeting` / `interview` / `presentation` / `practice` / `casual`
- Capture UI: a small chip row / segmented control on `/new`, pre-set to the default. **Skippable — never blocks the tap-and-talk gesture** (resolved UX decision: optional with default, not required, not a blocking modal)
- Editable after the fact on the session detail page (so a misremembered tag is one tap to fix)
- Rubric prompt: pass the session type as context so anchors flex by setting (e.g. the conciseness bar for a casual debrief differs from an exec update)

**Success criteria:**
- Tagging adds at most one tap and is fully skippable — recording still starts in one gesture
- The same transcript tagged `casual` vs `presentation` yields appropriately different context-sensitive feedback
- Existing sessions (pre-migration) default cleanly to `general` with no breakage

**Estimated effort:** ~half a weekend. One column + migration, a capture-UI control, an edit affordance, and a prompt context line. No infra.

**Unblocks:** M11 (Tone Fit + Composure both consume this tag).

### M9 — Rubric evals (regression detection)

**Deliverable:** A small, runnable eval harness that catches rubric regressions across all six dimensions. Sits alongside the existing Tripsmith eval pattern but tuned to Cadence's needs.

**Why this exists:** The Claude rubric prompt is the entire product. Six dimensions × scoring anchors × example-extraction rules × structured output schema all in one call. Without evals, prompt drift is invisible until a real user notices a regression — which on a coaching product means broken trust. Evals are how we hold the calibrated-honesty line as the rubric grows.

**Why this comes second (right after M8, before M10):** The next milestone (M10) rewrites the coaching prompt and may re-tune scoring — exactly the kind of change that needs regression detection in place first. Evals are also the instrument that tells M10's two failure modes apart (harsh *delivery* vs. miscalibrated *scores*). Lock evals in before that prompt work; the harness then gets re-run as the later milestones that expand the rubric land (M11's two dimensions, M12's three audio dimensions).

**Trigger to pull this in:** Either (a) you've accumulated 15+ real recordings to ground-truth against, (b) you're about to ship a meaningful prompt change and want regression detection, or (c) Anthropic releases a new model and you want to compare swap-out impact. Don't build before any of these are true — you'd be locking in an unverified baseline.

> **Now triggered (May 2026).** Live user feedback that the analysis reads as *harsh* satisfies trigger (b): the fix involves a coaching-prompt rewrite (M10), and we need evals to first determine whether the harshness is *delivery* (prose tone) or *calibration* (the model scoring systematically below a fair human). M9 is the instrument that tells those two apart, so it leads M10.

**Components:**
- **Eval set on cached production data.** Pull 15–25 real `transcripts` + `audio_metrics` rows from the Supabase DB. *Skip re-running Whisper* — already paid for, deterministic, makes evals ~10× cheaper. Ground truth lives in a JSON sidecar file (per-session per-dimension scores hand-labeled by Paahul, with brief notes).
- **Re-runner script.** Reads the cached transcript + audio metrics for each eval session, runs the *current* rubric prompt through Claude, captures the output.
- **Agreement metric.** For each dimension, computes whether the model's score is within ±1 of the ground-truth score. Roll up to per-dimension accuracy and overall accuracy.
- **Output:** a single agreement number + per-dimension breakdown. Watch it drift downward over commits.
- **Cost guardrail.** ~20 sessions × ~$0.03 Claude = ~$0.60 per run. Trivial. But cap iterations during prompt tuning to avoid runaway costs.

**The Tripsmith pattern transfers, with two adaptations:**
1. Pull from DB instead of fixture files — real production data, not fabricated samples.
2. Score against Paahul's own judgments, not Sonnet-as-judge. Sonnet-as-judge is fine for *mechanical* checks (is every quote verbatim?) but not for "is the Clarity score right" — that requires taste.

**Success criteria:**
- Eval runs in under 90 seconds end-to-end
- A deliberately-bad prompt change drops the agreement metric by at least 5%
- A no-op refactor of the prompt produces zero metric movement
- The harness is one `npm run eval` command, no manual setup

**Estimated effort:** ~1 weekend total. The harness is small; the time sink is hand-labeling 15–25 sessions (the only step Paahul can do himself — figure ~30 min of focused scoring).

### M10 — Coaching tone + feedback calibration

**Deliverable:** Two related changes that address feedback reading as *harsh* — kept as separate axes so the calibrated-honesty positioning stays intact.

1. **Coaching tone** — a global `Direct ↔ Encouraging` setting (default `balanced`) that changes only the *prose register* of the coaching paragraphs and the digest's "one thing to focus on" framing. **Scores never move.**
2. **Calibration check** — use the M9 eval harness to verify the model isn't systematically scoring *below* a fair human baseline. If it is, that's a calibration bug fixed in the rubric anchors — a different problem from delivery tone.

**The governing principle** (codified in `docs/foundation.md` §4, value #6): the score is calibrated and never softened to be likable; only the delivery voice is tunable. Softening scores to be nice is the exact trap the product exists to avoid.

**Why this exists:** Live feedback that the analysis is harsh enough to potentially demotivate some users. "Harsh" decomposes into two fixable-but-different problems — cold *delivery* (a prose issue) and scores that are too *low* (a calibration issue) — and the user wasn't sure which it is. This milestone tackles both without collapsing them into "just be nicer."

**Why this comes third (right after M9):** It depends on the eval harness. The diagnosis step below can't run without M9, and the calibration half is meaningless without it — so M9 must land first.

**Components:**
- **Diagnosis first.** Hand-label 3–4 recent real sessions, run them through M9's evals, and see whether the disagreement lives in the *scores* or only in the *framing*. This decides how much of part 2 is actually needed. (This is why M9 leads this milestone.)
- `coaching_tone` user preference (`direct` / `balanced` / `encouraging`), default `balanced`
- Coaching prompt: a tone directive that shapes only the explanatory prose — explicitly instructed **not** to alter scores, invent praise, or hide a weak dimension
- If calibration drift is found: adjust rubric anchors, re-validate via evals

**Success criteria:**
- Switching `Direct → Encouraging` changes wording while leaving every dimension score *identical* on the same transcript
- Evals confirm score agreement with Paahul's own labels is within ±1 across dimensions (i.e. the model is honest, not just harsh)
- `Encouraging` mode never invents praise and still names the weakest dimension plainly

**Depends on:** M9 (eval harness) for both halves. The tone-setting half can ship quickly once M9 exists.

**Priority:** High — addresses live user feedback. Sits right behind M9 so it ships as soon as the harness lands.

### M11 — Lower-confidence dimensions (Tone Fit + Composure)

**Deliverable:** Tone Fit, Composure, plus the N/A logic. Each ships with explicit calibrated-honesty UI.

**Components:**
- Consumes the session-type tag from **M8** (no longer defines it here — the tag was pulled forward because it improves every dimension's read, not just these two)
- Tone Fit scorer with explicit "limited by context" framing in the UI
- Composure scorer with N/A logic: only scores sessions tagged `meeting` or `presentation` *and* with a detected pressure moment
- Pressure-moment detection: LLM-judged on transcript (interruptions, hard questions, pushback)
- "N/A — this session didn't test this dimension" UI treatment

**Success criteria:**
- Composure correctly N/A's solo sessions
- Tone Fit scores feel sensible across at least three different session types

**Depends on:** M8 (session-type tag). After M11 lands, re-run the M9 evals to cover the two new dimensions.

**Estimated effort:** 1–2 weekends.

### M12 — Audio signal processing (Intonation, Vocal Energy, Expressive Range)

**Deliverable:** Three dimensions that come from the audio waveform itself, not from text. The half of the friend feedback that Whisper signals can't reach.

**Why this exists:** Pace and pronunciation are *language-level* signals — they live in what Whisper returns. Intonation, energy, and expressive range live in the *waveform*. A speaker can be perfectly paced and clear-spoken and still deliver everything in a flat monotone or trail off at every sentence-end. Cadence should catch that.

**Why this sits this late:** It's the most infra-heavy item left (a separate Python worker on Fly.io) and addresses a single friend's critique rather than the broad live feedback that pulled M8/M10 forward. It's high-value but not urgent, so it slots behind the cheap context + honesty work.

**Components:**
- A Python audio-processing worker, running outside Vercel (Fly.io is the cheapest credible host, ~$5/mo) — Vercel's serverless runtime doesn't fit Python signal-processing libs well
- The worker exposes an HTTP endpoint that takes a Supabase storage path and returns:
  - Pitch contour stats: F0 range, variability, sentence-end pitch movement (extracted via `pyworld` or `parselmouth`)
  - Energy/RMS curve: sentence-end energy drop, overall stability
  - Voice activity detection: speaking-time ratio vs. pauses
- `/api/analyze` (running on the background queue from M7) calls the Python worker before Claude. The waveform-derived stats become inputs to the rubric prompt.
- Three new rubric dimensions, all at **medium tool reliability**:
  - **Intonation** — was the delivery expressive, or monotone?
  - **Vocal Energy** — did your voice stay steady, or trail off at sentence-ends?
  - **Expressive Range** — did the pitch and energy work together to signal emphasis, or was the whole recording uniform?
- Result UI: each gets its own card, same calibrated-honesty confidence label pattern as the existing dimensions

**Why this comes after M7 (queue):** Adding 10–15s of audio processing per session to the synchronous request path would push the 60s timeout even harder. M7 makes processing time invisible to the user; this milestone uses that runway.

**Success criteria:**
- A deliberately-monotone recording scores meaningfully worse on Intonation than the same content delivered with normal variance
- Sentence-end trail-off is flagged in Vocal Energy
- The Python worker's median per-file processing time is under 12 seconds

**Estimated effort:** 1–2 weekends. The Fly.io worker setup is the most novel piece; pitch/energy extraction is well-trodden territory in the audio-processing ecosystem.

**After it lands:** Re-run the M9 evals over the now-nine-dimension prompt to catch any regression the three new dimensions introduce.

**Explicitly NOT in this milestone — and not planned at all:**
- Phoneme-level pronunciation analysis comparing the speaker to native references. That goes against the calibrated-honesty positioning (Cadence is not about sounding native), and pulls the product into research territory. The Pronunciation Clarity dimension from M6 covers what's defensibly measurable; we stop there.

### M13 — Trends and cross-session recall

**Deliverable:** A weekly view shows your dimension scores over time. The digest can reference trends ("Your conciseness improved 0.6 points over the last three weeks").

**Why this is last:** Trends are only meaningful after weeks of accumulated data, so they lose nothing by waiting — and by shipping last, they get to chart all nine dimensions (the full set after M11 + M12) rather than a partial picture.

**Components:**
- `pgvector` extension enabled on the existing Supabase Postgres
- Per-session embedding stored for semantic recall ("sessions where you hedged a lot")
- Trend computation: rolling average per dimension over a configurable window
- Weekly view: sparklines per dimension
- Digest prompt updated to reference trends when meaningful data exists

**Success criteria:**
- Trends only surface after 5+ sessions in a dimension (avoids noisy early signal)
- "Show me sessions where I was confident" returns semantically relevant results

**Estimated effort:** 1–2 weekends.

## Explicitly NOT in v1

- Authentication / multi-user (single hardcoded user) — *moved to M5, not cut*
- App Store deployment / native shell
- Real-time live analysis during a call
- Audio-level prosodic analysis beyond Whisper confidence
- Social or sharing features
- Multi-language support (English only)
- Live transcription (post-hoc only)
- Custom-trained models (off-the-shelf APIs only)

## Open decisions before starting M1

1. **API accounts:**
   - OpenAI (Whisper) — *new*
   - Anthropic (Claude) — already in use on Tripsmith
   - Vercel (hosting + cron) — create a new project for Cadence
   - Supabase (Postgres + Storage) — already in use on Tripsmith; create a new project for Cadence
   - Resend (email, deferrable until M4) — already in use on Tripsmith
2. **Domain** — start with `cadence-<something>.vercel.app`; custom domain is optional and can come later
3. **Spending budget** — set a monthly cap. Personal usage of Whisper + Claude should be well under $10/month at expected volume
4. **Repo structure** — single Next.js app at repo root for now; refactor only if there's a clear reason

## The very next thing to do

Create the API accounts, set up `.env.local`, and scaffold the Next.js app skeleton in this repo. Get a "hello world" PWA installable to your phone's home screen. That's the start of M1.
