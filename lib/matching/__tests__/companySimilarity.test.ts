import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  portfolioRelevanceScore,
  relevantPortfolioCompanies,
  type PortfolioCompany,
} from "../companySimilarity";

// Cosine similarity normalizes away magnitude, so a 1D vector can't encode an
// arbitrary similarity value (everything collapses to +/-1). Placing the target
// vector at angle theta from the startup's [1, 0] -- i.e. [cos(theta), sin(theta)]
// -- makes cosineSimilarity(STARTUP_EMBEDDING, vec(s)) equal exactly s, so tests
// can assert on precise scores without depending on the real embedding model.
const STARTUP_EMBEDDING = [1, 0];
function vec(similarity: number): number[] {
  const s = Math.max(-1, Math.min(1, similarity));
  return [s, Math.sqrt(1 - s * s)];
}

describe("relevantPortfolioCompanies", () => {
  it("drops companies below the threshold and keeps those at or above it", () => {
    const portfolio: PortfolioCompany[] = [
      { companyId: "below", relationship: "current" },
      { companyId: "at", relationship: "current" },
      { companyId: "above", relationship: "current" },
    ];
    const embeddings = new Map([
      ["below", vec(0.2)],
      ["at", vec(DEFAULT_SIMILARITY_THRESHOLD)],
      ["above", vec(0.9)],
    ]);

    const relevant = relevantPortfolioCompanies(STARTUP_EMBEDDING, portfolio, embeddings);
    const ids = relevant.map((r) => r.companyId);
    expect(ids).toContain("at");
    expect(ids).toContain("above");
    expect(ids).not.toContain("below");
  });

  it("sorts best-first", () => {
    const portfolio: PortfolioCompany[] = [
      { companyId: "mid", relationship: "current" },
      { companyId: "best", relationship: "current" },
      { companyId: "low", relationship: "current" },
    ];
    const embeddings = new Map([
      ["mid", vec(0.5)],
      ["best", vec(0.95)],
      ["low", vec(0.31)],
    ]);

    const relevant = relevantPortfolioCompanies(STARTUP_EMBEDDING, portfolio, embeddings);
    expect(relevant.map((r) => r.companyId)).toEqual(["best", "mid", "low"]);
  });

  it("skips portfolio entries with no companyId or no cached embedding", () => {
    const portfolio: PortfolioCompany[] = [
      { companyId: null, relationship: "current" },
      { companyId: "uncached", relationship: "current" },
    ];
    const relevant = relevantPortfolioCompanies(STARTUP_EMBEDDING, portfolio, new Map());
    expect(relevant).toEqual([]);
  });

  it("respects a custom threshold override", () => {
    const portfolio: PortfolioCompany[] = [{ companyId: "co", relationship: "current" }];
    const embeddings = new Map([["co", vec(0.5)]]);

    expect(relevantPortfolioCompanies(STARTUP_EMBEDDING, portfolio, embeddings, 0.6)).toEqual([]);
    expect(relevantPortfolioCompanies(STARTUP_EMBEDDING, portfolio, embeddings, 0.4)).toHaveLength(1);
  });

  // Regression test for the Alumni Ventures case: a multi-fund vehicle backing
  // 50-100+ relevant companies used to blow straight through the saturation
  // curve and pin every prolific investor's text score at 1.0 (see
  // portfolioRelevanceScore below). Capping the candidate pool up front is what
  // fixes that.
  it("caps the result at 10 companies even when far more clear the threshold", () => {
    const portfolio: PortfolioCompany[] = Array.from({ length: 50 }, (_, i) => ({
      companyId: `co-${i}`,
      relationship: "current",
    }));
    const embeddings = new Map(portfolio.map((p, i) => [p.companyId!, vec(0.31 + i * 0.001)]));

    const relevant = relevantPortfolioCompanies(STARTUP_EMBEDDING, portfolio, embeddings);
    expect(relevant).toHaveLength(10);
    // The 10 kept should be exactly the 10 highest-similarity companies.
    expect(relevant[0].companyId).toBe("co-49");
    expect(relevant[9].companyId).toBe("co-40");
  });
});

describe("portfolioRelevanceScore", () => {
  it("is 0 for an empty portfolio", () => {
    expect(portfolioRelevanceScore([])).toBe(0);
  });

  it("weights current investments double relative to previous ones", () => {
    const current = portfolioRelevanceScore([
      { companyId: "a", relationship: "current", score: 0.6 },
    ]);
    const previous = portfolioRelevanceScore([
      { companyId: "a", relationship: "previous", score: 0.6 },
    ]);
    // saturate is monotonic, so doubling the contributing sum must strictly increase the score.
    expect(current).toBeGreaterThan(previous);
  });

  it("rewards more relevant companies, not just the single best match", () => {
    const one = portfolioRelevanceScore([{ companyId: "a", relationship: "current", score: 0.9 }]);
    const three = portfolioRelevanceScore([
      { companyId: "a", relationship: "current", score: 0.9 },
      { companyId: "b", relationship: "current", score: 0.4 },
      { companyId: "c", relationship: "current", score: 0.4 },
    ]);
    expect(three).toBeGreaterThan(one);
  });

  it("folds a bio similarity into the same sum, weighted like a current investment", () => {
    const withoutBio = portfolioRelevanceScore([]);
    const withBio = portfolioRelevanceScore([], 0.5);
    const withCurrentCompanyInstead = portfolioRelevanceScore([
      { companyId: "a", relationship: "current", score: 0.5 },
    ]);
    expect(withBio).toBeGreaterThan(withoutBio);
    expect(withBio).toBeCloseTo(withCurrentCompanyInstead, 10);
  });

  it("ignores a null bio similarity (no bio, or bio below threshold)", () => {
    const relevant = [{ companyId: "a", relationship: "current", score: 0.5 }];
    expect(portfolioRelevanceScore(relevant, null)).toBeCloseTo(portfolioRelevanceScore(relevant), 10);
  });

  it("stays within (0, 1) even for a maxed-out 10-company pool", () => {
    const maxed = Array.from({ length: 10 }, (_, i) => ({
      companyId: `co-${i}`,
      relationship: "current",
      score: 1.0,
    }));
    const score = portfolioRelevanceScore(maxed);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
