# Ivan on Tech data and prompt review

Reviewed on 26 September 2026. This is an audit of the saved corpus, not a claim
about the channel's complete history or investment performance.

## Assessment

The software is a useful research tool with good grounding and job recovery, but
the original extraction was too permissive to treat every score as a market
signal. Exact quotes prove that words occurred; they do not prove speaker
attribution, sincerity, or the interpretation of those words. Calibration can
normalize tone but cannot fix those errors.

The strongest existing features are strict structured output, exact source
validation, server-resolved passage references, bounded repair, versioned caches,
resumable jobs, next-day outcome entry, an always-bullish comparison on the same
sample, and historical baselines that exclude future observations.

## Data reviewed

The 2021-through-today selection contained 437 catalog entries, 434 downloaded
transcripts, and 160 videos eligible under the three-minute rule. There were 156
current v3 analyses: 152 relevant and four irrelevant. Three eligible transcripts
were still pending after quote-validation failures, and one was missing. Older
v1/v2 records were excluded. All 156 selected analyses passed current structural
and exact-quote validation; this is not semantic accuracy.

| Year | Catalog entries | Analyzed |
| --- | ---: | ---: |
| 2021 | 14 | 9 |
| 2022 | 0 | 0 |
| 2023 | 24 | 23 |
| 2024 | 9 | 7 |
| 2025 | 36 | 26 |
| 2026 | 354 | 91 |

Historical coverage is very uneven, with no saved 2022 videos in the selection.
The paused history import has not created a representative multi-cycle dataset.
Completing older coverage matters more than adding more decimal places to scores.

## Concrete extraction problems

These are manually inspected examples, not an estimated error rate:

| Saved analysis | Problem | Evaluation with the stricter prompt |
| --- | --- | --- |
| 92, Bitcoin BRC20 / Ordinals tutorial | BTC scored 6 using Bitcoin security as evidence | Relevant educational content; all market scores null |
| 103, DCA panel on consolidation | SOL scored 7 because developers have more opportunities | SOL null; a conditional BTC forecast retained |
| 21, Bitcoin: Getting Crazy | SOL scored 5 despite an explicit bearish price forecast, mixed with technology praise | SOL 3; price and technology views separated; ETH null without supported price direction |
| 31, Bitcoin: Countdown Starting | Stream contains a parody/quoted clip and exaggerated claims | Inspected output did not turn the parody into a sell signal or endorse the rejected 100%-in-a-week claim |

Other issues found in the saved data include a generic phrase about knowing when
to take profits extracted as an action (analysis 110), historical sales treated
as current actions, and panel guests' positions attributed to the channel.
These need deliberate reanalysis and continued human review.

## Humor and irony

The v4 prompt explicitly checks setup, punchline, correction, negation and later
reaffirmation. It must not treat sarcasm literally or mechanically reverse it into
the opposite trade. Ambiguous statements should produce no unsupported score,
call or action, with uncertainty explained in the summary. Sincere views elsewhere
in the transcript can still support an extraction. Guest comments, parody and
quoted third-party claims require creator endorsement.

This is a reduction in false-signal risk, not a guarantee. Text may omit vocal
tone, laughter and speaker identity. The model's confidence is extraction
confidence, not an empirically calibrated probability that a forecast will work.

## Actual calibration run

A SQLite snapshot was created before the write. Calibration v3 was saved and a
second run reused the same profile. Stored analysis records were unchanged by
checksum, and the BTC 30-day outcome statistics were identical before and after.

| Series | Scored videos in the preceding year | Current median baseline | Historical points with an automatic relative score |
| --- | ---: | ---: | ---: |
| Overall | 108 | 6 | 102 |
| BTC | 107 | 6 | 91 |
| ETH | 38 | 6 | 19 |
| SOL | 44 | 7 | 25 |

Each historical point uses its own preceding 365 days and needs 20 earlier scores
for that channel/asset. It does not use the current median retroactively. A raw
score of 7 with a historical baseline of 7 becomes relative tone 5.5; that says
"typical for this creator", not bearish. Baselines still reflect v3 extraction
limitations until older analyses are upgraded and calibration refreshed.

The calibration implementation now avoids redundant versions and detects profile
changes caused by observations aging out of the rolling year, even without new
analyses.

## Outcome interpretation

At the 30-day window, the original BTC sample matched direction on 34 of 64
videos (53.1%); always bullish matched 46 of those 64 (71.9%). This does not
establish predictive skill, especially because the existing calculation does not
match each forecast's stated horizon. It pools long-term and unspecified calls,
and nearby videos have overlapping outcomes. The 386 extracted calls included
223 with an exactly "unspecified" horizon, ignoring case.

The UI now says **Direction match** and explains the fixed-window limitation.
Raw return and outcome calculations are unchanged. A future accuracy metric
should represent explicit forecast deadlines, separate price targets from
direction, score only resolvable horizons, and use time-separated evaluation
blocks rather than treating every adjacent video as independent.

## Prompt evaluation and efficiency

The live comparison used eight authored challenge cases for each prompt:
technology-only content, conflicting price/technology sentiment, generic advice,
guest attribution, joke retraction, irony, a sincere view after a joke, and
sincere emphatic language. **Both prompts passed 8/8.** These clear cases do not
demonstrate an improvement on subtle real-world irony. They do guard against
obvious regressions and suppressing sincere forecasts merely because "joke"
appears in a transcript.

Four complete real transcripts were also run with the revised prompt and a
64,000-character budget. All completed in one request with valid source evidence.
Their manually inspected differences are above. The old full-video results came
from the existing cache, so this was not a controlled repeated A/B experiment.
Prompt rules and chunk sizing changed together; their separate effects were not
measured. No evaluation output replaced a saved analysis.

The run used 20 provider requests, 87,864 input tokens and 11,715 completion tokens.
OpenRouter reported a total cost of $0.014654345. Raw local results are in
`.local/crypto-evaluation.json`; calibration checks are in
`.local/crypto-calibration-check.json`.

At 36,000 characters, the 156 transcripts require at least 303 model calls under
the old chunk/synthesis structure. At 64,000 they require 168, a **44.6% reduction
in request count before retries**. This is not a measured 44.6% dollar or latency
saving: input tokens, output sizes and retries differ. Six transcripts still need
multiple chunks. The implementation also includes up to 1,200 characters of
neighboring context at each boundary to help retain a joke and its correction.

Provider routing now requires support for requested structured-output parameters.
The grounding validator remains in place. Normal analysis reuses cached v3
successes; a visible **Reanalyze older results** action explicitly upgrades them
and processes pending videos in the selection. New results use v4, and current
versions win over older records without deleting history.

## Validation and next priorities

Backend coverage includes exact references, bounded repair, large single-window
analysis, a joke/retraction crossing a chunk boundary, calibration expiration and
idempotence, unchanged scores, and explicit legacy upgrades with version preference.
The Crypto UI tests cover the reanalysis action and fixed-window label.

Validation completed: **51 backend tests and 8 Crypto UI/chart tests passed**.
The API was restarted with the changes. Browser verification confirmed the
156-result legacy notice, updated outcome labels and relative-tone chart. Clicking
Calibrate in the live app completed successfully and reused profile v3 without
creating a fourth profile. No browser console errors were observed in that check.

Next priorities are a larger human-reviewed set of real ambiguous/ironic passages
with surrounding context, speaker attribution checks for interviews, normalized
forecast horizons, and completing missing historical coverage. Keep some examples
held out from prompt editing. Track request count, usage, retries and failures per
analysis persistently; the evaluation records these now, but production still
lacks a historical per-analysis cost ledger.

This evaluation approach follows the principle of using production examples and
explicit criteria in [OpenAI's evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).
Requiring schema-capable provider routing follows
[OpenRouter's structured-output documentation](https://openrouter.ai/docs/guides/features/structured-outputs).
