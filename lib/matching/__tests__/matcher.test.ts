import { describe, expect, it } from "vitest";
import { checkSizeFit, DEFAULT_WEIGHTS, resolveWeights } from "../matcher";

describe("resolveWeights", () => {
  it("returns the defaults, already normalized, with no overrides", () => {
    const weights = resolveWeights();
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(weights).toEqual(DEFAULT_WEIGHTS);
  });

  it("renormalizes so the total always sums to 1 regardless of raw override values", () => {
    const weights = resolveWeights({ vertical: 1, stage: 1, check_size: 1, text: 1 });
    expect(weights.vertical).toBeCloseTo(0.25, 10);
    expect(weights.stage).toBeCloseTo(0.25, 10);
    expect(weights.check_size).toBeCloseTo(0.25, 10);
    expect(weights.text).toBeCloseTo(0.25, 10);
  });

  it("ignores null/undefined overrides and keeps the default for that key", () => {
    const weights = resolveWeights({ vertical: null, stage: undefined });
    expect(weights).toEqual(DEFAULT_WEIGHTS);
  });

  it("falls back to the defaults if every override is zero", () => {
    const weights = resolveWeights({ vertical: 0, stage: 0, check_size: 0, text: 0 });
    expect(weights).toEqual(DEFAULT_WEIGHTS);
  });

  it("lets a single dominant weight crowd out the others after renormalization", () => {
    const weights = resolveWeights({ vertical: 100 });
    expect(weights.vertical).toBeGreaterThan(0.9);
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("checkSizeFit", () => {
  it("returns the neutral score when either side is missing", () => {
    expect(checkSizeFit(null, 5_000_000)).toBe(0.5);
    expect(checkSizeFit(5_000_000, null)).toBe(0.5);
    expect(checkSizeFit(0, 5_000_000)).toBe(0.5);
  });

  it("is 1.0 for an exact match", () => {
    expect(checkSizeFit(5_000_000, 5_000_000)).toBe(1.0);
  });

  it("decays with the log10 of the ratio and floors at 0", () => {
    // 10x apart -> log10(10) = 1 -> fit = 0
    expect(checkSizeFit(1_000_000, 10_000_000)).toBeCloseTo(0, 10);
    // 100x apart would go negative -- must clamp, not go below 0
    expect(checkSizeFit(1_000_000, 100_000_000)).toBe(0);
  });

  it("is symmetric in which side is larger", () => {
    expect(checkSizeFit(2_000_000, 8_000_000)).toBeCloseTo(checkSizeFit(8_000_000, 2_000_000), 10);
  });
});
