# Cadence

A personal speaking coach that lives on your phone.

Tap to start when you begin speaking — a meeting, a presentation, a practice run. Tap to stop. Cadence handles the rest: transcribes the audio, analyzes it across seven dimensions of communication quality, and sends a short, specific email every weekday morning with patterns from your own voice.

Over time, it builds a longitudinal picture of how you communicate — not from a single session, but across weeks of data.

## Why this exists

I want **objective data on my speaking, not feelings.** English is my second language, and in high-stakes situations I've felt my speaking patterns hold me back. The goal is a coach that answers two questions existing tools answer poorly:

1. *Am I actually getting better?*
2. *Exactly where do I need to focus this week?*

## What makes Cadence different

Most existing speaking-analysis tools (Yoodli, Poised, Orai) optimize for the easy-to-measure dimensions and mask their limits behind composite scores. Cadence is built on a different premise:

> **Calibrated honesty.** Cadence tells you not just what it measured, but how confident it is in each measurement. Where the underlying tech can't deliver a reliable signal, it says so — and skips the dimension rather than guessing.

This shows up in three concrete product decisions:

1. **Per-dimension confidence labels.** Every score is paired with how reliably it was measured.
2. **N/A is a feature.** Dimensions that aren't measurable for a given session are marked N/A, not smoothed into the average.
3. **Trends over points.** Individual scores can be noisy; multi-week trends are what you can trust.

## The rubric at a glance

Seven dimensions, scored 1–5 each:

| # | Dimension | What it asks | Tool reliability |
|---|---|---|:---:|
| 1 | **Clarity** | Could a listener restate your main point in one sentence? | High |
| 2 | **Conciseness** | Did you use roughly the right number of words for the idea? | High |
| 3 | **Confidence** | Did your language commit to a position? | High |
| 4 | **Word precision** | Did you reach for the specific word, or settle for a vague one? | High |
| 5 | **Tone fit** | Did your register match the context? | Medium |
| 6 | **Composure** | Did you stay steady under pressure? | Low — N/A for solo sessions |
| 7 | **Intelligibility** | Could the listener catch every word without effort? | Low — deferred to v2 |

See [`docs/foundation.md`](docs/foundation.md) for the full scale anchors, the technical reasoning behind each reliability rating, and the product design implications that fall out of both.

## Status

Day zero. The rubric and product values are defined; architecture, stack choices, and the first end-to-end slice come next.
