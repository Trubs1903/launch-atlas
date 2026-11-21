globalThis.AtlasValuation = Object.freeze({
  clamp(value, lower, upper) {
    return Math.max(lower, Math.min(upper, value));
  },
  factors(protocol, asOf, parameters = {}) {
    const clamp = this.clamp;
    const growthWeight = parameters.growthWeight ?? 0.25;
    const ageWeight = parameters.ageWeight ?? 0.25;
    const growth = protocol.change_7d === null ? 0 : clamp(protocol.change_7d, -50, 100);
    const days = protocol.listed_at === null ? null : Math.max(0,
      Math.floor((Date.parse(asOf + 'T00:00:00Z') - Date.parse(protocol.listed_at + 'T00:00:00Z')) / 86400000));
    const growthFactor = 1 + growthWeight * growth / 100;
    const ageFactor = days === null ? 1 - ageWeight / 2 : 1 - ageWeight + ageWeight * Math.min(days / 1095, 1);
    return { days, growth, growthFactor, ageFactor };
  },
  estimate(protocol, asOf, peerRatio, parameters = {}) {
    const factors = this.factors(protocol, asOf, parameters);
    const scale = parameters.scale ?? 1;
    return Math.round(this.clamp(protocol.tvl_usd * peerRatio * factors.growthFactor * factors.ageFactor * scale, 1, 100000000000000));
  }
});
