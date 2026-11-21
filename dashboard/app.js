(() => {
  'use strict';
  const data = globalThis.ATLAS_DATA;
  const model = globalThis.AtlasValuation;
  if (!data || !model) {
    document.body.textContent = 'Generate the dashboard first: node main.ts --input snapshot.json --output out --preview. Then open out/dashboard/index.html.';
    return;
  }
  const element = identifier => document.getElementById(identifier);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const money = value => {
    if (!Number.isFinite(value)) return 'Not reported';
    if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
    if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(value).toLocaleString('en-US');
  };
  const multiple = value => value.toFixed(2) + '×';
  const change = value => value === null ? 'Not reported' : (value > 0 ? '+' : '') + value.toFixed(1) + '%';
  const state = { page: 0, pageSize: 8, sort: 'rank', direction: 1, scope: 'all', selection: new Set(),
    scale: 1, growthWeight: 0.25, view: 'board' };
  let lastOpener = null;
  let toastTimer;
  const candidateBySlug = new Map(data.rows.map(protocol => [protocol.slug, protocol]));
  function scenarioValue(protocol) {
    if (!protocol.evidence) return protocol.mcap_usd;
    return model.estimate(protocol, data.as_of, protocol.evidence.peerRatio, { scale: state.scale, growthWeight: state.growthWeight });
  }
  function announce(message) {
    element('toast').textContent = message;
    element('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { element('toast').hidden = true; }, 3500);
  }
  function sourceRows() {
    const universe = element('universe').value;
    return universe === 'live' ? data.live : universe === 'excluded' ? data.excluded : data.rows;
  }
  function filteredRows() {
    const query = element('search').value.toLocaleLowerCase('en-US').trim();
    const category = element('category').value;
    const chain = element('chain').value;
    const rows = sourceRows().filter(protocol =>
      (!query || [protocol.name, protocol.slug, protocol.category, ...protocol.chains].join(' ').toLocaleLowerCase('en-US').includes(query)) &&
      (category === 'all' || protocol.category === category) &&
      (chain === 'all' || protocol.chains.includes(chain)) &&
      (element('universe').value !== 'candidates' || state.scope === 'all' ||
        (state.scope === 'watchlist' ? protocol.watchlist : !protocol.watchlist)));
    const compareValues = (left, right) => {
      if (state.sort === 'name') return left.name.localeCompare(right.name, 'en');
      const leftValue = state.sort === 'implied_value_usd' ? scenarioValue(left) : left[state.sort];
      const rightValue = state.sort === 'implied_value_usd' ? scenarioValue(right) : right[state.sort];
      if (leftValue === null || leftValue === undefined) return rightValue === null || rightValue === undefined ? 0 : 1;
      if (rightValue === null || rightValue === undefined) return -1;
      return (leftValue - rightValue) * state.direction;
    };
    rows.sort((left, right) => compareValues(left, right) || left.slug.localeCompare(right.slug, 'en'));
    return rows;
  }
  function renderRows() {
    const rows = filteredRows();
    const candidates = element('universe').value === 'candidates';
    const experimental = state.scale !== 1 || state.growthWeight !== 0.25;
    const maxPage = Math.max(0, Math.ceil(rows.length / state.pageSize) - 1);
    state.page = Math.min(state.page, maxPage);
    const visible = rows.slice(state.page * state.pageSize, (state.page + 1) * state.pageSize);
    element('visible-count').textContent = rows.length.toLocaleString('en-US');
    element('filter-status').textContent = rows.length + ' / ' + sourceRows().length + ' protocols' + (experimental && candidates ? ' · MODEL LAB ACTIVE' : '');
    element('value-heading').textContent = candidates ? (experimental ? 'SCENARIO MCAP' : 'IMPLIED MCAP') : 'REPORTED MCAP';
    element('rows').innerHTML = visible.map(protocol => {
      const value = scenarioValue(protocol);
      const ratio = candidates ? value / protocol.implied_value_usd : 1;
      const band = candidates ? money(Math.round(protocol.low_usd * ratio)) + ' – ' + money(Math.round(protocol.high_usd * ratio)) : 'Observed, not modeled';
      return `<tr>
        <td class="compare-cell">${candidates ? `<input type="checkbox" aria-label="Compare ${escape(protocol.name)}" data-compare="${escape(protocol.slug)}" ${state.selection.has(protocol.slug) ? 'checked' : ''}>` : ''}</td>
        <td class="rank">${candidates ? String(protocol.rank).padStart(2, '0') : '—'}</td>
        <td><div class="identity"><span class="monogram">${escape(protocol.name.slice(0, 2).toUpperCase())}</span><div><button class="protocol-name" data-detail="${escape(protocol.slug)}">${escape(protocol.name)}</button><span class="protocol-sub">${escape(protocol.category)} ${protocol.watchlist ? '<span class="tag">WATCHLIST</span>' : ''}</span></div></div></td>
        <td class="number-money">${money(protocol.tvl_usd)}</td>
        <td class="${protocol.change_7d === null ? 'muted' : protocol.change_7d >= 0 ? 'positive' : 'negative'}">${change(protocol.change_7d)}</td>
        <td><div class="value">${money(value)}</div><div class="band">${escape(band)}</div></td>
        <td>${candidates ? `<span class="evidence ${protocol.evidence.quality === 'Limited' ? 'limited' : ''}">${protocol.evidence.quality} inputs</span><span class="peer-count">${protocol.evidence.peerCount} category peers</span>` : `<span class="muted">${escape(protocol.reason ?? protocol.symbol ?? protocol.gecko_id ?? 'Token marker recorded')}</span>`}</td>
        <td><button class="row-open" data-detail="${escape(protocol.slug)}">${candidates ? 'Inspect ↗' : 'View record ↗'}</button></td>
      </tr>`;
    }).join('');
    element('empty-state').hidden = rows.length > 0;
    element('radar-table').hidden = rows.length === 0;
    element('page-status').textContent = rows.length ? `${state.page * state.pageSize + 1}–${Math.min((state.page + 1) * state.pageSize, rows.length)} of ${rows.length} · sealed ${data.as_of}` : '0 results';
    element('previous').disabled = state.page === 0;
    element('next').disabled = state.page === maxPage;
    for (const button of document.querySelectorAll('[data-sort]')) {
      button.parentElement.setAttribute('aria-sort', button.dataset.sort === state.sort ? (state.direction === 1 ? 'ascending' : 'descending') : 'none');
    }
    for (const [identifier, scope] of [['all-candidates', 'all'], ['watchlist-only', 'watchlist'], ['early-only', 'early']]) {
      element(identifier).classList.toggle('active', state.scope === scope);
      element(identifier).setAttribute('aria-pressed', String(state.scope === scope));
      element(identifier).disabled = !candidates;
    }
  }
  function resetFilters() {
    for (const identifier of ['category', 'chain']) element(identifier).value = 'all';
    element('search').value = '';
    element('universe').value = 'candidates';
    state.scope = 'all';
    state.sort = 'rank';
    state.direction = 1;
    state.page = 0;
    renderRows();
  }
  function selectView(view) {
    state.view = view;
    for (const name of ['board', 'method', 'compare']) element(name + '-view').hidden = name !== view;
    for (const button of document.querySelectorAll('.nav-button')) button.classList.toggle('active', button.dataset.view === view);
    if (view === 'compare') renderCompare();
    document.querySelector('.metrics').scrollIntoView({ block: 'start' });
  }
  function toggleCompare(slug) {
    if (state.selection.has(slug)) state.selection.delete(slug);
    else if (state.selection.size < 3) state.selection.add(slug);
    else announce('Compare up to three protocols. Remove one to add another.');
    element('compare-count').textContent = state.selection.size;
    renderRows();
    renderCompare();
  }
  function renderCompare() {
    element('compare-cards').innerHTML = state.selection.size ? [...state.selection].map(slug => {
      const protocol = candidateBySlug.get(slug);
      return `<article class="compare-card"><span class="eyebrow dark">BASELINE RANK ${protocol.rank}</span><h3>${escape(protocol.name)}</h3><span class="muted">${escape(protocol.category)}</span><div class="compare-value">${money(scenarioValue(protocol))}</div><span class="band">Baseline band ${money(protocol.low_usd)} – ${money(protocol.high_usd)}</span><dl><dt>TVL</dt><dd>${money(protocol.tvl_usd)}</dd><dt>7d growth</dt><dd>${change(protocol.change_7d)}</dd><dt>Tracking age</dt><dd>${protocol.evidence.days === null ? 'Missing' : protocol.evidence.days + ' days'}</dd><dt>Category peers</dt><dd>${protocol.evidence.peerCount}</dd><dt>Peer multiple</dt><dd>${multiple(protocol.evidence.peerRatio)}</dd><dt>Data quality</dt><dd>${protocol.evidence.quality}</dd></dl><p>${escape(protocol.farm.risk)}</p><p>Budget and cadence are unverified planning examples. No token reward assumed.</p><button class="button secondary" data-detail="${escape(slug)}">Research card ↗</button> <button class="text-button" data-remove="${escape(slug)}">Remove</button></article>`;
    }).join('') : '<article class="empty-state"><h3>Choose up to three candidates.</h3><p>Use the checkboxes on the radar to compare valuation inputs and participation risks.</p></article>';
  }
  function openDetail(slug, opener) {
    const protocol = candidateBySlug.get(slug) ?? data.live.find(record => record.slug === slug) ?? data.excluded.find(record => record.slug === slug);
    if (!protocol) return;
    lastOpener = opener ?? document.activeElement;
    element('detail-rank').textContent = protocol.rank ? String(protocol.rank).padStart(2, '0') : 'SOURCE RECORD';
    if (!protocol.evidence) {
      element('detail-content').innerHTML = `<div class="detail-intro"><div><h2 id="detail-name">${escape(protocol.name)}</h2><p>${escape(protocol.category)} · ${escape(protocol.chains.join(' / '))}</p></div><span class="detail-badge">${escape(protocol.reason ?? 'TOKEN DATA RECORDED')}</span></div><div class="source-card"><h3>Kept outside the launch ranking</h3><p>TVL ${money(protocol.tvl_usd)} · reported market cap ${money(protocol.mcap_usd)} · ticker ${escape(protocol.symbol ?? 'not reported')} · CoinGecko ID ${escape(protocol.gecko_id ?? 'not reported')}.</p><p>${escape(protocol.reason ?? 'A token marker is present. This is an observed record, not a candidate token valuation. A marker is not evidence of liquidity or executable price.')}</p></div>`;
    } else {
      const evidence = protocol.evidence;
      const cohort = data.calibration.categories[protocol.category];
      const scenario = scenarioValue(protocol);
      const factors = model.factors(protocol, data.as_of, { growthWeight: state.growthWeight });
      const base = Math.round(protocol.tvl_usd * evidence.peerRatio * state.scale);
      const grown = Math.round(base * factors.growthFactor);
      const caveats = [...evidence.caveats, 'No token recorded is an index observation, not proof that no token exists.', 'Ranges describe model scenarios; they do not predict launch, eligibility or realized returns.'];
      element('detail-content').innerHTML = `<div class="detail-intro"><div><h2 id="detail-name">${escape(protocol.name)}</h2><p>${escape(protocol.category)} · ${escape(protocol.chains.join(' / '))} · ${escape(protocol.slug)}</p></div><span class="detail-badge">${protocol.watchlist ? 'AUTHORITATIVE WATCHLIST' : 'BEYOND THE WATCHLIST FLOOR'}</span></div>
        <div class="detail-metrics"><div><small>IMPLIED MARKET CAP</small><strong>${money(scenario)}</strong><span>Conditional model value</span></div><div><small>BASELINE SCENARIO BAND</small><strong>${money(protocol.low_usd)}–${money(protocol.high_usd)}</strong><span>Not a confidence interval</span></div><div><small>SEALED TVL / 7D</small><strong>${money(protocol.tvl_usd)}</strong><span>${change(protocol.change_7d)} over 7 days</span></div><div><small>TRACKING AGE</small><strong>${evidence.days === null ? 'Unknown' : evidence.days.toLocaleString('en-US') + 'd'}</strong><span>${protocol.listed_at ? 'Tracked since ' + protocol.listed_at : 'Neutral age factor used'}</span></div></div>
        <div class="detail-grid"><section class="detail-panel"><h3>A valuation you can reconstruct</h3><div class="waterfall"><div><span>Observed TVL</span><b>${money(protocol.tvl_usd)}</b></div><div><span>Shrunk peer multiple${state.scale !== 1 ? ' × lab scale' : ''}</span><b>${multiple(evidence.peerRatio * state.scale)}</b></div><div><span>Comparable base</span><b>${money(base)}</b></div><div><span>Capped growth adjustment</span><b>${multiple(factors.growthFactor)} → ${money(grown)}</b></div><div><span>Tracking-age adjustment</span><b>${multiple(factors.ageFactor)}</b></div><div class="final"><span>Implied market cap</span><b>${money(scenario)}</b></div></div><div class="formula">${cohort.count} category peers · ${Math.round(cohort.weight * 100)}% category weight<br>Global median ${multiple(data.calibration.globalMedian)} · prior strength 4</div><h3>Observed comparables</h3><ul class="peer-list">${cohort.peers.length ? cohort.peers.map(peer => `<li><span>${escape(peer.name)}</span><span>${multiple(peer.rawRatio)} raw / ${multiple(peer.modelRatio)} capped</span></li>`).join('') : '<li>No category peers: global prior only.</li>'}</ul><div class="risk-box">${caveats.map(escape).join('<br>')}</div></section>
        <section class="detail-panel"><h3>A bounded participation plan</h3><div class="farm-meta"><b>Budget:</b> ${escape(protocol.farm.budget)}<br><b>Cadence:</b> ${escape(protocol.farm.timing)}</div><ol class="farm-steps">${protocol.farm_steps.map(step => '<li>' + escape(step) + '</li>').join('')}</ol><div class="risk-box"><b>Risk to review:</b> ${escape(protocol.farm.risk)}</div></section></div>
        <div class="detail-bottom"><span>SEALED ${data.as_of} · No live contract, fee or eligibility verification.</span><button class="button secondary" data-compare-detail="${escape(slug)}">${state.selection.has(slug) ? 'Remove from comparison' : '+ Add to comparison'}</button></div>`;
    }
    if (!element('detail').open) element('detail').showModal();
    element('detail').scrollTop = 0;
    element('close-detail').focus();
  }
  function closeDetail() {
    element('detail').close();
    if (lastOpener?.isConnected) lastOpener.focus();
  }
  function initialize() {
    element('snapshot-date').textContent = data.as_of;
    document.querySelectorAll('.as-of').forEach(node => { node.textContent = data.as_of; });
    element('metric-universe').textContent = data.counts.universe;
    element('metric-candidates').textContent = data.counts.candidates;
    element('metric-coverage').textContent = data.rows.filter(protocol => protocol.watchlist).length + ' / ' + data.counts.watchlist;
    element('metric-peers').textContent = data.counts.peers;
    const categories = [...new Set([...data.rows, ...data.live, ...data.excluded].map(protocol => protocol.category))].sort();
    const chains = [...new Set([...data.rows, ...data.live, ...data.excluded].flatMap(protocol => protocol.chains))].sort();
    for (const category of categories) element('category').add(new Option(category, category));
    for (const chain of chains) element('chain').add(new Option(chain, chain));
    const categoryTotals = new Map();
    for (const protocol of data.rows) categoryTotals.set(protocol.category, (categoryTotals.get(protocol.category) ?? 0) + protocol.tvl_usd);
    const total = data.rows.reduce((sum, protocol) => sum + protocol.tvl_usd, 0);
    const largest = [...categoryTotals].sort((left, right) => right[1] - left[1]).slice(0, 4);
    const rest = total - largest.reduce((sum, entry) => sum + entry[1], 0);
    largest.push(['Other categories', rest]);
    const palette = ['#cbe7b5', '#94b998', '#b4cfa8', '#de8d58', '#547263'];
    element('capital-map').innerHTML = largest.map(([category, amount], index) => `<div title="${escape(category)}: ${money(amount)} TVL" style="flex:${amount / total};background:${palette[index]}"><b>${amount / total > 0.09 ? Math.round(amount / total * 100) + '%' : ''}</b></div>`).join('');
    element('capital-legend').innerHTML = largest.map(([category], index) => `<span><i style="background:${palette[index]}"></i>${escape(category)}</span>`).join('');
    element('capital-total').textContent = money(total) + ' CANDIDATE TVL';
    element('peer-calibration').textContent = data.calibration.totalPeers + ' observed peers · global median ' + multiple(data.calibration.globalMedian);
    element('source-text').textContent = data.source + '. The dataset is fixed; figures are never presented as current.';
    element('assumptions').innerHTML = data.model.assumptions.map(assumption => '<li>' + escape(assumption) + '</li>').join('');
    element('category-ledger').innerHTML = Object.entries(data.calibration.categories).sort(([left], [right]) => left.localeCompare(right, 'en')).map(([category, cohort]) => `<tr><td>${escape(category)}</td><td>${cohort.count}</td><td>${cohort.observedMedian === null ? 'No observation' : multiple(cohort.observedMedian)}</td><td>${Math.round((1 - cohort.weight) * 100)}%</td><td>${multiple(cohort.ratio)}</td></tr>`).join('');
    renderRows();
  }
  document.addEventListener('click', event => {
    const view = event.target.closest('[data-view]');
    if (view) selectView(view.dataset.view);
    const detail = event.target.closest('[data-detail]');
    if (detail) openDetail(detail.dataset.detail, detail);
    const remove = event.target.closest('[data-remove]');
    if (remove) toggleCompare(remove.dataset.remove);
    const compareDetail = event.target.closest('[data-compare-detail]');
    if (compareDetail) {
      toggleCompare(compareDetail.dataset.compareDetail);
      compareDetail.textContent = state.selection.has(compareDetail.dataset.compareDetail) ? 'Remove from comparison' : '+ Add to comparison';
    }
    const sort = event.target.closest('[data-sort]');
    if (sort) {
      if (state.sort === sort.dataset.sort) state.direction *= -1;
      else { state.sort = sort.dataset.sort; state.direction = state.sort === 'rank' || state.sort === 'name' ? 1 : -1; }
      state.page = 0;
      renderRows();
    }
  });
  element('rows').addEventListener('change', event => {
    if (event.target.dataset.compare) toggleCompare(event.target.dataset.compare);
  });
  for (const identifier of ['search', 'category', 'chain', 'universe']) element(identifier).addEventListener(identifier === 'search' ? 'input' : 'change', () => { state.page = 0; renderRows(); });
  for (const [identifier, scope] of [['all-candidates', 'all'], ['watchlist-only', 'watchlist'], ['early-only', 'early']]) element(identifier).addEventListener('click', () => { state.scope = scope; state.page = 0; renderRows(); });
  element('previous').addEventListener('click', () => { state.page--; renderRows(); });
  element('next').addEventListener('click', () => { state.page++; renderRows(); });
  element('clear-filters').addEventListener('click', resetFilters);
  element('empty-reset').addEventListener('click', resetFilters);
  element('close-detail').addEventListener('click', closeDetail);
  element('detail').addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
  element('open-first').addEventListener('click', event => openDetail(data.rows[0].slug, event.target));
  element('toggle-sandbox').addEventListener('click', () => {
    element('sandbox').hidden = !element('sandbox').hidden;
    element('toggle-sandbox').setAttribute('aria-expanded', String(!element('sandbox').hidden));
  });
  function updateModel() {
    state.scale = Number(element('scale').value);
    state.growthWeight = Number(element('growth-weight').value);
    element('scale-value').textContent = state.scale.toFixed(2) + '×';
    element('growth-value').textContent = Math.round(state.growthWeight * 100) + '%';
    state.sort = 'implied_value_usd';
    state.direction = -1;
    state.page = 0;
    renderRows();
    renderCompare();
  }
  for (const identifier of ['scale', 'growth-weight']) element(identifier).addEventListener('input', updateModel);
  element('reset-model').addEventListener('click', () => { element('scale').value = '1'; element('growth-weight').value = '0.25'; updateModel(); });
  element('export').addEventListener('click', () => {
    const rows = filteredRows().map(protocol => ({ ...protocol, experimental_value_usd: scenarioValue(protocol) }));
    const blob = new Blob([JSON.stringify({ as_of: data.as_of, experimental: state.scale !== 1 || state.growthWeight !== 0.25, parameters: { scale: state.scale, growthWeight: state.growthWeight }, rows }, null, 2)], { type: 'application/json' });
    const address = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = address;
    anchor.download = 'launch-atlas-' + data.as_of + '.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(address), 1000);
    announce('Exported ' + rows.length + ' filtered records with sealed-date metadata.');
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !element('detail').open && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      if (state.view !== 'board') selectView('board');
      element('search').focus();
    }
  });
  initialize();
})();
