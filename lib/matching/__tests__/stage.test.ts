import { describe, expect, it } from "vitest";
import { distributionStageFit, normalizeStage, recencyWeight, stageCloseness } from "../stage";

describe("normalizeStage", () => {
  it("maps known aliases case-insensitively", () => {
    expect(normalizeStage("Seed")).toBe("Seed");
    expect(normalizeStage("SERIES A")).toBe("Series A");
    expect(normalizeStage("series-b")).toBe("Series B");
    expect(normalizeStage("late stage")).toBe("Growth");
  });

  it("collapses Sequoia's 'Early' bucket into Series A", () => {
    expect(normalizeStage("Early")).toBe("Series A");
  });

  it("tolerates surrounding whitespace and repeated spaces", () => {
    expect(normalizeStage("  seed  ")).toBe("Seed");
  });

  it("returns null for unrecognized or missing input", () => {
    expect(normalizeStage("Series A/B")).toBeNull();
    expect(normalizeStage(null)).toBeNull();
    expect(normalizeStage(undefined)).toBeNull();
    expect(normalizeStage("")).toBeNull();
  });
});

describe("stageCloseness", () => {
  it("is 1.0 for an exact match", () => {
    expect(stageCloseness("Series A", "Series A")).toBe(1.0);
  });

  it("decays with vocabulary distance and floors at 0", () => {
    // Pre-Seed and Series A are 2 apart in STAGE_VOCABULARY -> 1 - 0.34*2 = 0.32
    expect(stageCloseness("Pre-Seed", "Series A")).toBeCloseTo(0.32, 5);
    expect(stageCloseness("Pre-Seed", "Growth")).toBe(0);
  });

  it("is symmetric", () => {
    expect(stageCloseness("Seed", "Series B")).toBe(stageCloseness("Series B", "Seed"));
  });

  it("returns the neutral 0.5 when either side is unknown", () => {
    expect(stageCloseness(null, "Seed")).toBe(0.5);
    expect(stageCloseness("Seed", null)).toBe(0.5);
  });
});

describe("distributionStageFit", () => {
  it("returns neutral for an empty distribution or missing target", () => {
    expect(distributionStageFit({}, "Seed")).toBe(0.5);
    expect(distributionStageFit({ Seed: 1 }, null)).toBe(0.5);
  });

  it("is the weighted average of closeness across the distribution", () => {
    const fit = distributionStageFit({ Seed: 0.5, "Series A": 0.5 }, "Seed");
    // Seed vs Seed = 1.0, Series A vs Seed = 0.66 -> avg = 0.83
    expect(fit).toBeCloseTo(0.83, 2);
  });
});

describe("recencyWeight", () => {
  const thisYear = new Date().getFullYear();

  it("is 1.0 for the current year and for missing years", () => {
    expect(recencyWeight(thisYear)).toBeCloseTo(1.0, 5);
    expect(recencyWeight(null)).toBe(1.0);
    expect(recencyWeight(undefined)).toBe(1.0);
  });

  it("halves every RECENCY_HALF_LIFE_YEARS (5)", () => {
    expect(recencyWeight(thisYear - 5)).toBeCloseTo(0.5, 5);
    expect(recencyWeight(thisYear - 10)).toBeCloseTo(0.25, 5);
  });

  it("never treats a future year as negative age", () => {
    expect(recencyWeight(thisYear + 5)).toBeCloseTo(1.0, 5);
  });
});
