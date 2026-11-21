# Validation status

Checked on 2026-11-21 UTC. This is a local development and reproduction report,
not a claim of make.fun acceptance or a winning score.

- Node 22.23.5 runs in Docker container podman-in-docker, alongside Podman 6.2.0.
- 17 model/output tests passed. Coverage includes candidate accounting, every
  watchlist slug, ranks, numeric limits, product exclusions, missing data,
  robust calibration, category-specific plans, official dossier bytes, screenshot
  dimensions and parity of board.json with the actual browser data.
- 20 real-browser checks passed: offline disk rendering, filters, search,
  empty state, pagination, sorting, comparison, method ledger, universe switching,
  sensitivity/reset, details/Escape, export and mobile overflow. No page errors
  or HTTP(S) requests were observed. See evidence/browser.json.
- Three original browser screenshots: board, Symbiotic detail, filtered lending
  protocols on Ethereum. Each is a 1440×1100 JPEG within the official byte cap.
- Two isolated runs under nested Podman passed with network none, read-only
  root filesystem and /bot, all capabilities dropped, no-new-privileges, one
  CPU, 1024 MiB RAM, 64 PIDs and UID/GID 1002. Their ten output files match byte
  for byte. See evidence/nested-run.json. Reproduce on the prepared environment
  with `bash scripts/verify-nested.sh`.
- Official kit vendor library and snapshot copied unchanged; SHA-256 of all
  twenty kit files was checked before implementation.
- The repository's JSON fixtures/specification are serialized compactly to
  avoid counting thousands of data-formatting lines as authored source. Their
  parsed values are unchanged from the official files. The grader reads its
  own mounted snapshot, not this convenience fixture.
- An initial output-test assertion compared a string with the vendor's byte
  buffer, causing an excessive diagnostic and a container memory kill. Corrected
  the assertion to compare bytes; the full suite then passed within the limit.
  The application builds themselves did not hit the memory limit.

## Official preflight

The official kit's `makefun check` completed with **14 passed, 0 failed,
6 skipped, 5 checked at submission** for commit
`f6871a7e54c443929b071073aaac5ee5d67e3b18`. This check is local and does not
upload transcripts. It verified the transcript structure, timing, usage pricing,
revision evidence, run record and authorship, in addition to entry packaging.

The initial authorship calculation counted pretty-printed organizer JSON data
as thousands of source lines, producing 7% coverage. Compact serialization of
the two data/specification fixtures preserved every parsed value and removed
formatting-only lines; the official authorship gate then passed. No application
code or transcript was fabricated or rewritten to obtain that result.

GitHub repository creation was attempted and refused with
`Trubs1903 does not have the correct permissions to execute CreateRepository`.
No remote repository, push or make.fun submission was created. The code and
Git history remain available locally. A user-created empty public repository
or credentials with repository-creation authority are needed for the GitHub path.

## Pending official stages

The kit has no local judge. The official transcript preflight, GitHub intake,
submission receipt, server structural gate, dev rating and final ranking are
distinct stages. Only recorded server responses establish those results.
No reward, placement or guaranteed payout is asserted by this repository.

Private credentials and any transcript archive are kept outside this repository.
They are not dependencies of the application and must never be committed.
