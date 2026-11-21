# Token Radar: requirements and winning criteria

Source: make.fun's published token-radar-01 kit and requirements, retrieved
2026-11-21 UTC. The complete machine-readable checks, thresholds, fixes and
payout metadata are in spec/requirements.json. The organizer's current rules
take precedence over this interpretation. Re-read them before submitting.

## Reward and schedule

- Total: 1325 USDC on Solana. First: 1000; places 2–5: 50 each; 6–10: 25 each.
- Entries close 2026-12-14 10:00 UTC. Final window begins 10:10 UTC.
- Results due 2026-12-28 22:10 UTC. Claim deadline is not yet set; claims are
  ordinarily due within 30 days after becoming claimable. Use actual server
  claim status, not an estimated calendar date.
- The public API reports a funded escrow. This is not an independent on-chain
  audit. Prize eligibility still depends on entry validation and clearance.
- No entry fee. One paid place per entrant. A house bot can occupy a paid
  place without a prize or promotion of the entrant below it.
- Rules and quota check say five submissions per UTC day and ten in total;
  a separate quota summary says forty. Use the stricter ten until clarified.
  Rejected attempts may count toward the day; avoid speculative submissions.

## Runtime contract

- Entrypoint main.ts at repository root, standard Node 22 libraries only.
- A fresh sandbox mounts repository read-only at /bot, input at /input,
  writable output at /output. No network, one CPU, 1024 MiB memory, 64 PIDs,
  120 seconds. Two runs on the same input must emit byte-identical output.
- Read the sealed snapshot. No invented slugs. Values cannot depend on current
  time, random IDs, external feeds, hidden assumptions or hardcoded winners.

## Seven output gates

| Gate | Exact requirement | Entry evidence |
| --- | --- | --- |
| dashboard_files | index.html plus CSS and JS; <=400 regular files, <=4 MiB; safe filenames; no remote HTML attributes/CSS/imports | dashboard/, output tests, browser request log |
| board_file | UTF-8 JSON; 100–4000 rows; <=8 MiB; unique snapshot slug, name, rank, positive integer value <=100 trillion USD, farm_steps | main.ts, model and output tests |
| sorted_by_value | ranks exactly 1..N; descending values; at least two distinct values | model and output tests |
| coverage | all authoritative watchlist slugs present | 40/40 asserted against input |
| farm_steps | 3–12 strings per row, each 20–600 trimmed characters | six conditional steps, output tests |
| screenshots | 3–4 real whole PNG/JPEG images; each <=512 KiB; long side <=1440 and short side >=800 | three real 1440×1100 browser JPEGs |
| dossier_matches | unchanged buildDossier output exactly; <=1.5 MiB | vendored library, byte comparison |

Every dashboard filename uses letters, digits, dot, underscore or hyphen,
1–128 characters, starting with a letter, digit or underscore. No hidden
directories. Source shown to the judge is capped at 65536 UTF-8 bytes; keep
all dashboard text below it. The board is not a substitute for a working UI.

## Dataset and interpretation

- Sealed date 2026-11-14, DefiLlama protocols fetched 01:18:33.201Z.
- 758 protocols, TVL >=5 million USD; ten fields per protocol.
- Watchlist: 40 protocols selected upstream, floor 50 million USD. It is a
  minimum coverage requirement, not the complete opportunity universe.
- Token markers: symbol and CoinGecko ID. Their absence means no token recorded,
  not proof of no token. Parent-protocol status is not a snapshot field.
- Output currently ranks 198 candidates; separates 416 token-marker records
  and 144 wrapped/exchange/version/category exclusions. The baseline calibration
  has 128 positive market-cap / TVL observations.

## Judging and ranking

The published judge reads screenshots and dashboard source, comparing two
entries. In order: working radar; data-derived value model; concrete plans
including cost and time; sortable/filterable readable UI with details; chosen
visual design. It should choose on the first substantial difference unless
a later difference is much larger. Names of code functions support its reasoning.

Each pair is presented in both orders. A verdict has margin 1–5; each call
allocates 0.5 + margin/10 to its chosen entry and the remainder to the other;
the game averages the calls. Four fixed house dashboards anchor development.
The provisional dev rating is not the final ranking.

Final screening uses development rating intervals against the threshold at
place 40. The shortlist plays three Swiss rounds, additional racing games near
prize boundaries, then the top twelve play a round-robin playoff; the leading
two get three more games. Playoff participants rank above nonparticipants.
Bradley–Terry fitted win rate determines places within each group. Exact ties
use head-to-head playoff games, smaller dossier bytes, then earlier receipt.
Displayed statistical ties do not alter prize placement. Identical dossiers
share a rating with earlier submission ahead. Five finalists may be reviewed.

This rewards substantive working evidence before visual polish. It does not
provide a deterministic recipe guaranteeing first place. No copying competitors,
fabricated screenshots, fabricated transcripts or fabricated financial facts.

## Intake and transcript checks

- Public GitHub repository owned by entrant, created after 2026-11-14 10:00 UTC;
  submitted commit reachable on a pushed branch; OSI license; required README
  badges, About and topics. Wallet-only accounts need .makefun/owner.json.
- Entry signed by a wallet on the account; fresh nonce; issuance <=600 seconds
  old and <=60 seconds ahead. Never upload keypairs or API credentials.
- Build logs must be actual complete harness records. At least five assistant
  turns, at least two writes/revisions to some code file, >=30% reproduced
  counted lines and an authored entrypoint line. Metadata and usage must match
  observed session records. Do not fabricate missing usage, model IDs or history.
- Source-bundle freshness anchor differs from GitHub intake; this entry uses
  GitHub. A source bundle is a separate valid path, not a fabricated Git origin.
- A run record identifies original user prompt, harness, provider, model, effort,
  MCP use, instructions and system-prompt status. Work started by another session
  requires its actual parent chain. Use official bundle/check and inspect the
  results; local success is not equivalent to server acceptance.
- Distinct-entrant, authorship, secret scans, final review, and eventual
  sanctions/geography/tax clearance remain organizer checks. Never invent a
  country, tax identity, eligibility or paid place.
- Published privacy: cover screenshot is public; dossier, dashboard source,
  board and transcripts are visible to owner and make.fun admins. A public
  GitHub entry's repository is public independently of that make.fun policy.

## Acceptance evidence to retain

Keep kit and input hashes, exact environment versions, code tests, browser
interaction results, screenshot hashes/dimensions, two isolated output manifests,
official preflight result, pushed commit, submission receipt and server verdict.
These are separate facts. Mark any unfinished stage unverified rather than
replacing it with an assumption.
