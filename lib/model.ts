import '../dashboard/valuation.js';

const valuation = globalThis.AtlasValuation;
const excludedCategories = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

export function quantile(values, proportion) {
  if (values.length === 0) throw new Error('Cannot calculate a quantile without observations');
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * proportion;
  const lower = Math.floor(position);
  return ordered[lower] + (ordered[Math.ceil(position)] - ordered[lower]) * (position - lower);
}

export function parseSnapshot(value) {
  if (!value || !Array.isArray(value.protocols) || !Array.isArray(value.watchlist) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.as_of) || !Number.isFinite(Date.parse(value.as_of))) {
    throw new Error('Snapshot must contain protocols, watchlist and a valid sealed as_of date');
  }
  const seen = new Set();
  for (const protocol of value.protocols) {
    if (!protocol.slug || seen.has(protocol.slug) || !protocol.name || !Array.isArray(protocol.chains) ||
        !Number.isFinite(protocol.tvl_usd) || protocol.tvl_usd <= 0 ||
        !(protocol.change_7d === null || Number.isFinite(protocol.change_7d)) ||
        !(protocol.mcap_usd === null || Number.isFinite(protocol.mcap_usd)) ||
        !(protocol.listed_at === null || (/^\d{4}-\d{2}-\d{2}$/.test(protocol.listed_at) && Number.isFinite(Date.parse(protocol.listed_at)))) ||
        !('symbol' in protocol) || !('gecko_id' in protocol)) {
      throw new Error('Invalid or duplicate snapshot protocol: ' + protocol.slug);
    }
    seen.add(protocol.slug);
  }
  if (new Set(value.watchlist).size !== value.watchlist.length || value.watchlist.some(slug => !seen.has(slug))) {
    throw new Error('Watchlist contains a duplicate or unknown protocol');
  }
  return value;
}

export function exclusionReason(protocol) {
  if (protocol.gecko_id !== null || protocol.symbol !== null) return 'Token marker recorded';
  if (protocol.mcap_usd !== null && protocol.mcap_usd > 0) return 'Market capitalization recorded';
  if (excludedCategories.has(protocol.category)) return 'Wrapped, staking, bridge or exchange category';
  if (/\b(wrapped|staked|staking)\b/i.test(protocol.name)) return 'Wrapped or staking product name';
  if (/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i.test(protocol.name)) return 'Exchange product name';
  if (/\s(?:v\d+(?:\.\d+)?|\d+\.\d+)$/i.test(protocol.name)) return 'Versioned product name';
  return null;
}

export function calibrate(protocols) {
  const peers = protocols.filter(protocol =>
    (protocol.gecko_id !== null || protocol.symbol !== null) && protocol.mcap_usd > 0 && protocol.tvl_usd > 0);
  if (peers.length === 0) throw new Error('No positive live-token market-cap / TVL peers in snapshot');
  const ratio = protocol => valuation.clamp(protocol.mcap_usd / protocol.tvl_usd, 0.05, 20);
  const globalMedian = quantile(peers.map(ratio), 0.5);
  const groups = new Map();
  for (const peer of peers) {
    const category = peer.category ?? 'Uncategorized';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(peer);
  }
  const categories = {};
  for (const category of new Set(protocols.map(protocol => protocol.category ?? 'Uncategorized'))) {
    const cohort = groups.get(category) ?? [];
    const values = cohort.map(ratio);
    const weight = values.length / (values.length + 4);
    const blend = observed => Math.exp(weight * Math.log(observed) + (1 - weight) * Math.log(globalMedian));
    const median = values.length ? quantile(values, 0.5) : globalMedian;
    const center = blend(median);
    categories[category] = {
      count: values.length,
      weight,
      observedMedian: values.length ? median : null,
      ratio: center,
      lowRatio: Math.min(center * 0.65, blend(values.length ? quantile(values, 0.25) : globalMedian * 0.4)),
      highRatio: Math.max(center * 1.5, blend(values.length ? quantile(values, 0.75) : globalMedian * 2.5)),
      peers: cohort.map(protocol => ({ slug: protocol.slug, name: protocol.name,
        tvl_usd: protocol.tvl_usd, mcap_usd: protocol.mcap_usd,
        rawRatio: protocol.mcap_usd / protocol.tvl_usd, modelRatio: ratio(protocol) }))
    };
  }
  return { totalPeers: peers.length, globalMedian, categories, ratioBounds: [0.05, 20], shrinkage: 4 };
}

function interaction(category) {
  if (/Lending|CDP|Collateral/.test(category)) return {
    action: 'If public deposits are supported, supply a small amount of a liquid asset; do not borrow or enable leverage.',
    review: 'Record the lending position and utilization. Check withdrawal liquidity and any liquidation exposure before continuing.',
    risk: 'Smart-contract, oracle and withdrawal-liquidity risk; borrowing adds liquidation risk.'
  };
  if (/Dexs|Liquidity|Derivatives|Options|Synthetics/.test(category)) return {
    action: 'If a spot route is available, make one small swap after reviewing price impact; avoid leverage and blind LP deposits.',
    review: 'Keep the quote, actual fees and received amount. If the product only offers leveraged trading, stop rather than simulate farming volume.',
    risk: 'Slippage, inventory and contract risk; derivatives can liquidate collateral.'
  };
  if (/RWA|OTC|CeDeFi|Card|Payments/.test(category)) return {
    action: 'Check jurisdiction, identity requirements and minimum deposit on the official product; do not deposit if access or redemption is unclear.',
    review: 'Compare redemption terms, custody and counterparty exposure. An inaccessible or permissioned product belongs on a research list only.',
    risk: 'Issuer, custody, redemption and access restrictions; public farming may not exist.'
  };
  if (/Chain|BTC|Staking|Restaking/.test(category)) return {
    action: 'Verify a public native application or documented participation route; avoid bridging, validator lockups or restaking without reviewing exits.',
    review: 'Record lock duration, fees and exit conditions. If participation requires infrastructure or locked stake, keep this as research only.',
    risk: 'Bridge, validator, slashing or lockup risk, depending on the verified route.'
  };
  return {
    action: 'Check for an open, documented deposit or vault route. If one exists, inspect its strategy and try only the smallest reversible position.',
    review: 'Record strategy exposure, withdrawal queue and manager permissions. A curator or allocator may have no direct public farming route.',
    risk: 'Strategy, manager, contract and withdrawal risk; participation may be permissioned.'
  };
}

export function farmPlan(protocol) {
  const route = interaction(protocol.category ?? 'Uncategorized');
  const chains = protocol.chains.slice(0, 3).join(', ') || 'the chain named by its official product';
  return {
    budget: 'Planning example: $25–$100 reversible capital; $1–$20 total fees. These are unverified user budgets, not current network quotes.',
    timing: 'Research 15–30 min; initial check 10–20 min; one weekly review for 2–4 weeks. A planning cadence, not a reward schedule.',
    risk: route.risk,
    steps: [
      `Find ${protocol.name}'s official documentation independently; verify contracts and access for ${chains}. This snapshot supplies no verified website or contract.`,
      route.action,
      'Set a personal ceiling before signing: for example $25–$100 capital and $1–$20 total fees. Obtain a live fee quote; if the smallest action exceeds the budget, skip it.',
      route.review,
      'Review once a week for 2–4 weeks, not repetitive volume. Keep receipts, revoke unused approvals and test an exit. Stop if costs or access rules change.',
      'No token launch, points, eligibility or airdrop is verified here. Use the protocol only if its utility justifies the cost with zero token reward.'
    ]
  };
}

export function buildAtlas(snapshot) {
  const calibration = calibrate(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const rows = [];
  const excluded = [];
  const live = [];
  for (const protocol of snapshot.protocols) {
    const reason = exclusionReason(protocol);
    if (protocol.gecko_id !== null || protocol.symbol !== null || protocol.mcap_usd > 0) {
      live.push({ ...protocol, status: 'Token data recorded' });
      continue;
    }
    if (reason && !watchlist.has(protocol.slug)) {
      excluded.push({ ...protocol, reason });
      continue;
    }
    const category = protocol.category ?? 'Uncategorized';
    const cohort = calibration.categories[category];
    const factors = valuation.factors(protocol, snapshot.as_of);
    const farm = farmPlan(protocol);
    const missing = Number(protocol.change_7d === null) + Number(protocol.listed_at === null);
    const widening = 1 + missing * 0.25 + (cohort.count < 4 ? 0.25 : 0);
    const implied = valuation.estimate(protocol, snapshot.as_of, cohort.ratio);
    rows.push({
      ...protocol,
      category,
      rank: 0,
      implied_value_usd: implied,
      low_usd: Math.max(1, Math.min(implied, Math.round(valuation.estimate(protocol, snapshot.as_of, cohort.lowRatio) / widening))),
      high_usd: Math.min(100000000000000, Math.max(implied, Math.round(valuation.estimate(protocol, snapshot.as_of, cohort.highRatio) * widening))),
      watchlist: watchlist.has(protocol.slug),
      status: 'No token recorded',
      evidence: { ...factors, peerRatio: cohort.ratio, peerCount: cohort.count, shrinkWeight: cohort.weight,
        quality: missing > 0 || cohort.count < 4 ? 'Limited' : 'Broader', missingInputs: missing,
        caveats: [...(protocol.listed_at === null ? ['Tracking date missing: neutral age treatment'] : []),
          ...(protocol.change_7d === null ? ['Seven-day growth missing: zero-growth treatment'] : []),
          ...(cohort.count < 4 ? ['Sparse category peers: substantial global shrinkage'] : []),
          ...(!watchlist.has(protocol.slug) ? ['Parent-protocol field unavailable: independence unverified'] : [])] },
      farm_steps: farm.steps,
      farm
    });
  }
  const compare = (left, right) => right.implied_value_usd - left.implied_value_usd || (left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0);
  rows.sort(compare).forEach((row, index) => { row.rank = index + 1; });
  const slugs = new Set(rows.map(row => row.slug));
  if (rows.length < 100 || rows.length > 4000 || snapshot.watchlist.some(slug => !slugs.has(slug))) {
    throw new Error('Candidate coverage cannot meet the official 100-row / full-watchlist gate');
  }
  return { as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd,
    title: 'Launch Atlas', rows, live, excluded, calibration,
    counts: { universe: snapshot.protocols.length, candidates: rows.length, live: live.length,
      excluded: excluded.length, watchlist: snapshot.watchlist.length, peers: calibration.totalPeers },
    model: { version: '1.0', growthWeight: 0.25, ageWeight: 0.25, horizonDays: 1095,
      formula: 'TVL × shrunk category MCap/TVL × (1 + 0.25 × clamped 7d growth) × (0.75 + 0.25 × min(tracking days / 1095, 1))',
      assumptions: ['Market-cap analog, not FDV, a launch forecast or an airdrop estimate.',
        'Peer ratios winsorized to 0.05–20×; category medians shrink in log space with weight n/(n+4).',
        'Growth clipped to −50%…+100%; missing growth uses 0%. Missing age factor is 0.875.',
        'Tracking age measures DefiLlama coverage, not time since protocol founding.',
        'Ranges are peer/model scenarios, not statistical confidence intervals or executable prices.',
        'No fees, revenue, supply, points, official sites or eligibility are present in the snapshot.',
        'Parent-protocol status is unavailable outside the authoritative watchlist.'] }
  };
}
