import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildAtlas, calibrate, exclusionReason, farmPlan, parseSnapshot, quantile } from '../lib/model.ts';

const snapshot = parseSnapshot(JSON.parse(readFileSync(new URL('../fixtures/snapshot.json', import.meta.url), 'utf8')));
const atlas = buildAtlas(snapshot);

test('ranks every authoritative watchlist entry and accounts for the entire universe', () => {
  assert.equal(atlas.rows.length, 198);
  assert.equal(atlas.live.length + atlas.excluded.length + atlas.rows.length, snapshot.protocols.length);
  const slugs = new Set(atlas.rows.map(protocol => protocol.slug));
  assert.equal(slugs.size, atlas.rows.length);
  for (const slug of snapshot.watchlist) assert.ok(slugs.has(slug), slug);
  for (const [index, protocol] of atlas.rows.entries()) {
    assert.equal(protocol.rank, index + 1);
    assert.ok(Number.isSafeInteger(protocol.implied_value_usd));
    assert.ok(protocol.implied_value_usd > 0 && protocol.implied_value_usd <= 1e14);
    if (index > 0) assert.ok(atlas.rows[index - 1].implied_value_usd >= protocol.implied_value_usd);
    assert.ok(protocol.low_usd <= protocol.implied_value_usd && protocol.high_usd >= protocol.implied_value_usd);
  }
  assert.ok(new Set(atlas.rows.map(protocol => protocol.implied_value_usd)).size > 1);
});

test('every candidate has a bounded plan with concrete action and exit conditions', () => {
  for (const protocol of atlas.rows) {
    assert.ok(protocol.farm_steps.length >= 3 && protocol.farm_steps.length <= 12);
    for (const step of protocol.farm_steps) assert.ok(step.trim().length >= 20 && step.trim().length <= 600, step);
    assert.match(protocol.farm.budget, /unverified/);
    assert.match(protocol.farm.timing, /planning cadence/);
    assert.ok(protocol.farm.risk.length > 20);
  }
});

test('model is deterministic and independent of the input order', () => {
  assert.deepEqual(buildAtlas(snapshot), atlas);
  const shuffled = structuredClone(snapshot);
  shuffled.protocols.reverse();
  const rerun = buildAtlas(shuffled);
  assert.deepEqual(rerun.rows.map(protocol => [protocol.slug, protocol.implied_value_usd]), atlas.rows.map(protocol => [protocol.slug, protocol.implied_value_usd]));
});

test('names cannot change a non-filtered protocol valuation', () => {
  const renamed = structuredClone(snapshot);
  const candidate = renamed.protocols.find(protocol => protocol.slug === atlas.rows[0].slug);
  candidate.name = 'Unrelated Research Label';
  const rebuilt = buildAtlas(renamed);
  assert.equal(rebuilt.rows.find(protocol => protocol.slug === candidate.slug).implied_value_usd, atlas.rows[0].implied_value_usd);
});

test('category calibration uses observed positive token peers and shrinkage', () => {
  const base = { slug: 'sample', name: 'Sample', category: 'Dexs', chains: ['Test'], tvl_usd: 100,
    mcap_usd: 200, symbol: 'SAMPLE', gecko_id: 'sample', change_7d: 0, listed_at: '2025-01-01' };
  const calibration = calibrate([base, { ...base, slug: 'second', category: 'Lending', mcap_usd: 800 },
    { ...base, slug: 'no-token', symbol: null, gecko_id: null, mcap_usd: 9999 }]);
  assert.equal(calibration.totalPeers, 2);
  assert.equal(calibration.globalMedian, 5);
  assert.equal(calibration.categories.Dexs.weight, 0.2);
  assert.ok(Math.abs(calibration.categories.Dexs.ratio - Math.exp(0.2 * Math.log(2) + 0.8 * Math.log(5))) < 1e-10);
  assert.equal(calibration.categories.Dexs.peers[0].rawRatio, 2);
});

test('outlier ratios are capped while the raw evidence is retained', () => {
  const base = atlas.live.find(protocol => protocol.mcap_usd > 0);
  const calibration = calibrate([{ ...base, mcap_usd: base.tvl_usd * 1000 }]);
  const peer = calibration.categories[base.category].peers[0];
  assert.equal(calibration.globalMedian, 20);
  assert.equal(peer.rawRatio, 1000);
  assert.equal(peer.modelRatio, 20);
});

test('empty categories use the global peer prior and disclose sparse evidence', () => {
  const sparse = atlas.rows.find(protocol => protocol.evidence.peerCount === 0);
  assert.ok(sparse);
  assert.equal(sparse.evidence.peerRatio, atlas.calibration.globalMedian);
  assert.equal(sparse.evidence.quality, 'Limited');
  assert.ok(sparse.evidence.caveats.some(caveat => caveat.includes('Sparse')));
});

test('missing inputs are explicit and sealed-date based', () => {
  const missing = atlas.rows.find(protocol => protocol.slug === 'lightning-network');
  assert.equal(missing.evidence.days, null);
  assert.equal(missing.evidence.ageFactor, 0.875);
  assert.ok(missing.evidence.missingInputs >= 1);
  const model = globalThis.AtlasValuation;
  assert.equal(model.factors({ change_7d: 1e6, listed_at: '2026-11-13' }, '2026-11-14').growthFactor, 1.25);
  assert.equal(model.factors({ change_7d: -1e6, listed_at: null }, '2026-11-14').growthFactor, 0.875);
  assert.equal(model.factors({ change_7d: null, listed_at: '2026-11-13' }, '2026-11-14').days, 1);
  assert.equal(model.factors({ change_7d: null, listed_at: '2020-01-01' }, '2026-11-14').ageFactor, 1);
});

test('classification separates markers and specified product exclusions', () => {
  const protocol = { ...atlas.rows[0], symbol: null, gecko_id: null, mcap_usd: null };
  assert.equal(exclusionReason({ ...protocol, symbol: 'LIVE' }), 'Token marker recorded');
  assert.equal(exclusionReason({ ...protocol, category: 'Bridge' }), 'Wrapped, staking, bridge or exchange category');
  assert.equal(exclusionReason({ ...protocol, name: 'New Protocol V2' }), 'Versioned product name');
  assert.equal(exclusionReason({ ...protocol, name: 'Wrapped Bitcoin' }), 'Wrapped or staking product name');
  assert.ok(atlas.live.every(row => row.symbol !== null || row.gecko_id !== null || row.mcap_usd > 0));
  assert.ok(atlas.rows.every(row => row.symbol === null && row.gecko_id === null && !(row.mcap_usd > 0)));
});

test('parser rejects missing schemas, duplicate slugs and invalid watchlist entries', () => {
  assert.throws(() => parseSnapshot({}), /Snapshot/);
  const duplicate = structuredClone(snapshot);
  duplicate.protocols.push(duplicate.protocols[0]);
  assert.throws(() => parseSnapshot(duplicate), /duplicate/);
  const unknown = structuredClone(snapshot);
  unknown.watchlist.push('not-in-snapshot');
  assert.throws(() => parseSnapshot(unknown), /Watchlist/);
  const badDate = structuredClone(snapshot);
  badDate.protocols[0].listed_at = 'not-a-date';
  assert.throws(() => parseSnapshot(badDate), /Invalid/);
  assert.throws(() => calibrate([]), /No positive/);
});

test('farm plans vary by product type without inventing verified routes', () => {
  const lending = farmPlan({ ...atlas.rows[0], category: 'Lending' });
  const permissioned = farmPlan({ ...atlas.rows[0], category: 'RWA' });
  assert.match(lending.steps[1], /do not borrow/);
  assert.match(permissioned.steps[1], /jurisdiction/);
  assert.notDeepEqual(lending.steps, permissioned.steps);
});

test('quantiles and the browser estimator preserve numeric bounds', () => {
  assert.equal(quantile([9, 1, 5], 0.5), 5);
  assert.equal(quantile([1, 3], 0.5), 2);
  assert.throws(() => quantile([], 0.5));
  const protocol = atlas.rows[0];
  assert.equal(globalThis.AtlasValuation.estimate(protocol, atlas.as_of, protocol.evidence.peerRatio), protocol.implied_value_usd);
  assert.equal(globalThis.AtlasValuation.estimate({ ...protocol, tvl_usd: 1e20 }, atlas.as_of, 20), 1e14);
});
