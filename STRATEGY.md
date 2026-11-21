# Launch Atlas: competition strategy and evidence

This is an original offline research dashboard for token-radar-01. It is not
a trading bot and never signs transactions, contacts a model, connects a wallet,
or fetches live market data. All financial values originate from the public,
sealed snapshot; all valuation and farm assumptions are labeled.

The judge's priorities, in published order:

1. **Working radar.** Every watchlist slug is present; the board, screenshots
   and browser share one generated data object. The UI exposes the full candidate
   set with search, pagination, category and chain filters, sorting, JSON export,
   three-way comparison and keyboard-accessible protocol dialogs.
2. **Value model.** Use positive observed token market-cap / TVL peers from
   the snapshot rather than a hardcoded ranking. Winsorize ratios, calculate
   category medians, and shrink sparse categories toward the global median.
   Apply capped seven-day growth and tracking age. The same estimator runs in
   Node and the browser. Show raw peer observations and every multiplier.
3. **Concrete farm plans.** Category-specific conditional participation routes
   with example capital/fee ceilings, time budgets, exit checks and stop rules.
   Public access, exact contracts, gas prices and incentives are not in the
   snapshot, so these are explicitly unverified planning suggestions. A plan
   for a curator or RWA product may correctly stop at research-only.
4. **Usable page.** Show recorded-token and excluded-product universes separately,
   missing inputs, sparse cohorts, raw peer ratios and baseline scenario bands.
   The model lab changes displayed valuations and sort order without altering
   the generated official board. Comparison ranks stay labeled as baseline.
5. **Visual design.** Original editorial terminal layout, forest/cream palette,
   mint/orange capital map, restrained typography, readable financial tables,
   responsive layout and a two-column research card. No external font or UI kit.

The observations are not a predictive model validation. The conditional market
capitalization is neither FDV nor an estimate of a user's airdrop. The scenario
band is not a confidence interval. Tracking age is not founding age. Peers
suffer survivorship bias and their snapshot prices may not be executable.
TVL can be double counted. Category labels are coarse. Outside the authoritative
watchlist, parent-protocol independence cannot be reconstructed from the ten
available fields. The snapshot date is fixed and visible everywhere.

No competitor code, dashboard or screenshot was imported. The sole vendored
library is the kit's unchanged makefun-board.ts, required for dossier generation.
The snapshot and public requirements are copied as fixtures/specification, not
presented as authored work. All three submitted screenshots show this entry's
actual browser rendering, not the starter.

Local tests can establish structural validity and consistent behavior. They
cannot reproduce the sealed server scorer, house dashboards, stochastic judge
verdicts, final screening, Swiss heat, racing or playoff. No local score is
represented as a win. A real accepted submission and server grade are necessary.
