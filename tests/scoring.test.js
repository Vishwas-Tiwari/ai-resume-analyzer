/**
 * tests/scoring.test.js
 *
 * Unit tests for the deterministic ATS scoring module.
 * Tests use mocked data only — no live Groq API key required.
 *
 * Run: npm test
 */

import { describe, it, expect } from "vitest";
import {
  clampScore,
  matchStatusToValue,
  validateRequirement,
  validateCategoryScore,
  calculateGeneralScore,
  calculateJobMatchScore,
  verifyGeneralWeights,
  verifyJobMatchWeights,
  GENERAL_WEIGHTS,
  JOB_MATCH_WEIGHTS,
} from "../api/scoring.js";

// validateCategoryScore is already imported above — no dynamic import needed

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a full set of category entries at a given score for all 5 categories */
function makeCategoryEntries(score) {
  return Object.keys(GENERAL_WEIGHTS).map((category) => ({
    category,
    score,
    details: "test",
    suggestions: "test",
    available: true,
  }));
}

/** Build a requirement object */
function makeReq(overrides = {}) {
  return {
    name: "Test Requirement",
    category: "required_skills",
    importance: "required",
    match_status: "matched",
    weight: 1.0,
    evidence: "Worked with React for 3 years",
    explanation: "Direct evidence found",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Weight integrity
// ---------------------------------------------------------------------------

describe("Weight integrity", () => {
  it("GENERAL_WEIGHTS sum to exactly 1.0", () => {
    expect(verifyGeneralWeights()).toBe(true);
  });

  it("JOB_MATCH_WEIGHTS sum to exactly 1.0", () => {
    expect(verifyJobMatchWeights()).toBe(true);
  });

  it("each GENERAL_WEIGHTS value is > 0", () => {
    for (const [k, v] of Object.entries(GENERAL_WEIGHTS)) {
      expect(v, `${k} weight`).toBeGreaterThan(0);
    }
  });

  it("each JOB_MATCH_WEIGHTS value is > 0", () => {
    for (const [k, v] of Object.entries(JOB_MATCH_WEIGHTS)) {
      expect(v, `${k} weight`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// clampScore
// ---------------------------------------------------------------------------

describe("clampScore", () => {
  it("returns 0 for negative input", () => expect(clampScore(-10)).toBe(0));
  it("returns 100 for value > 100", () => expect(clampScore(150)).toBe(100));
  it("rounds to nearest integer", () => expect(clampScore(74.6)).toBe(75));
  it("returns 0 for NaN", () => expect(clampScore(NaN)).toBe(0));
  it("passes through exact values", () => expect(clampScore(50)).toBe(50));
});

// ---------------------------------------------------------------------------
// matchStatusToValue
// ---------------------------------------------------------------------------

describe("matchStatusToValue", () => {
  it("matched → 1.0", () => expect(matchStatusToValue("matched")).toBe(1.0));
  it("partially_matched → 0.5", () => expect(matchStatusToValue("partially_matched")).toBe(0.5));
  it("missing → 0.0", () => expect(matchStatusToValue("missing")).toBe(0.0));
  it("unknown → 0.0 (conservative default)", () => expect(matchStatusToValue("unknown")).toBe(0.0));
});

// ---------------------------------------------------------------------------
// validateRequirement
// ---------------------------------------------------------------------------

describe("validateRequirement", () => {
  it("accepts a valid requirement", () => {
    const result = validateRequirement(makeReq());
    expect(result).not.toBeNull();
    expect(result.name).toBe("Test Requirement");
    expect(result.match_status).toBe("matched");
  });

  it("returns null for non-object input", () => {
    expect(validateRequirement(null)).toBeNull();
    expect(validateRequirement("string")).toBeNull();
    expect(validateRequirement(42)).toBeNull();
  });

  it("returns null when name is missing", () => {
    expect(validateRequirement(makeReq({ name: "" }))).toBeNull();
    expect(validateRequirement(makeReq({ name: undefined }))).toBeNull();
  });

  it("demotes 'matched' to 'partially_matched' when evidence is empty", () => {
    const result = validateRequirement(makeReq({ match_status: "matched", evidence: "" }));
    expect(result.match_status).toBe("partially_matched");
  });

  it("demotes 'matched' to 'partially_matched' when evidence is whitespace", () => {
    const result = validateRequirement(makeReq({ match_status: "matched", evidence: "   " }));
    expect(result.match_status).toBe("partially_matched");
  });

  it("keeps 'matched' when evidence is present", () => {
    const result = validateRequirement(makeReq({ match_status: "matched", evidence: "Has 5 years React experience" }));
    expect(result.match_status).toBe("matched");
  });

  it("normalises invalid category to 'preferred_skills'", () => {
    const result = validateRequirement(makeReq({ category: "invalid_cat" }));
    expect(result.category).toBe("preferred_skills");
  });

  it("normalises invalid importance to 'preferred'", () => {
    const result = validateRequirement(makeReq({ importance: "critical" }));
    expect(result.importance).toBe("preferred");
  });

  it("normalises invalid match_status to 'missing'", () => {
    const result = validateRequirement(makeReq({ match_status: "sort_of" }));
    expect(result.match_status).toBe("missing");
  });

  it("caps weight at 10 to prevent gaming", () => {
    const result = validateRequirement(makeReq({ weight: 999 }));
    expect(result.weight).toBe(10);
  });

  it("resets non-positive weight to 1.0", () => {
    const result = validateRequirement(makeReq({ weight: -1 }));
    expect(result.weight).toBe(1.0);
    const result2 = validateRequirement(makeReq({ weight: 0 }));
    expect(result2.weight).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Test 1: All categories receive full marks (score = 100)
// ---------------------------------------------------------------------------

describe("calculateGeneralScore — Test 1: All categories full marks", () => {
  it("produces overall_score = 100", () => {
    const { overall_score } = calculateGeneralScore(makeCategoryEntries(100));
    expect(overall_score).toBe(100);
  });

  it("all category contributions are correct", () => {
    const { score_breakdown } = calculateGeneralScore(makeCategoryEntries(100));
    for (const entry of score_breakdown) {
      expect(entry.contribution).toBeCloseTo(entry.weight * 100, 1);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2: All categories receive zero marks (score = 0)
// ---------------------------------------------------------------------------

describe("calculateGeneralScore — Test 2: All categories zero marks", () => {
  it("produces overall_score = 0", () => {
    const { overall_score } = calculateGeneralScore(makeCategoryEntries(0));
    expect(overall_score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Partially completed resume
// ---------------------------------------------------------------------------

describe("calculateGeneralScore — Test 3: Partially completed resume", () => {
  it("produces a score in range 30-70 for a partial resume", () => {
    const entries = [
      { category: "section_completeness", score: 70, details: "", suggestions: "", available: true },
      { category: "skills_keyword_coverage", score: 50, details: "", suggestions: "", available: true },
      { category: "experience_project", score: 40, details: "", suggestions: "", available: true },
      { category: "impact_achievement", score: 30, details: "", suggestions: "", available: true },
      { category: "formatting_extractability", score: 60, details: "", suggestions: "", available: true },
    ];
    // Expected: 0.20*70 + 0.25*50 + 0.25*40 + 0.15*30 + 0.15*60
    //         = 14 + 12.5 + 10 + 4.5 + 9 = 50
    const { overall_score } = calculateGeneralScore(entries);
    expect(overall_score).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Test 4: Student resume — projects but no full-time experience
// ---------------------------------------------------------------------------

describe("calculateGeneralScore — Test 4: Student resume", () => {
  it("does not artificially penalise experience category if projects exist", () => {
    const entries = [
      { category: "section_completeness", score: 80, details: "", suggestions: "", available: true },
      { category: "skills_keyword_coverage", score: 75, details: "", suggestions: "", available: true },
      { category: "experience_project", score: 65, details: "", suggestions: "", available: true }, // projects present
      { category: "impact_achievement", score: 60, details: "", suggestions: "", available: true },
      { category: "formatting_extractability", score: 80, details: "", suggestions: "", available: true },
    ];
    // Expected: 0.20*80 + 0.25*75 + 0.25*65 + 0.15*60 + 0.15*80
    //         = 16 + 18.75 + 16.25 + 9 + 12 = 72
    const { overall_score } = calculateGeneralScore(entries);
    expect(overall_score).toBe(72);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Resume matching all required job skills
// ---------------------------------------------------------------------------

describe("calculateJobMatchScore — Test 5: All requirements matched", () => {
  it("produces job_match_score = 100", () => {
    const requirements = [
      makeReq({ category: "required_skills", match_status: "matched", evidence: "Evidence A" }),
      makeReq({ name: "R2", category: "required_skills", match_status: "matched", evidence: "Evidence B" }),
      makeReq({ name: "E1", category: "experience", match_status: "matched", evidence: "Evidence C" }),
      makeReq({ name: "P1", category: "preferred_skills", match_status: "matched", evidence: "Evidence D" }),
    ];
    const { job_match_score } = calculateJobMatchScore(requirements);
    expect(job_match_score).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Resume matching some requirements, missing others
// ---------------------------------------------------------------------------

describe("calculateJobMatchScore — Test 6: Partial match", () => {
  it("produces a score between 30 and 80 for partial matches", () => {
    const requirements = [
      makeReq({ name: "R1", category: "required_skills", match_status: "matched", evidence: "Has skill", weight: 2 }),
      makeReq({ name: "R2", category: "required_skills", match_status: "missing", evidence: "", weight: 2 }),
      makeReq({ name: "E1", category: "experience", match_status: "partially_matched", evidence: "Some exp", weight: 1 }),
      makeReq({ name: "P1", category: "preferred_skills", match_status: "missing", evidence: "", weight: 1 }),
    ];
    const { job_match_score, category_scores } = calculateJobMatchScore(requirements);

    // required: (2*1 + 2*0) / 4 = 0.5 → score=50
    // experience: (1*0.5) / 1 = 0.5 → score=50
    // preferred: (1*0) / 1 = 0 → score=0
    // total = 0.50*50 + 0.30*50 + 0.20*0 = 25+15+0 = 40
    expect(job_match_score).toBe(40);
    expect(category_scores.required_skills.score).toBe(50);
    expect(category_scores.experience.score).toBe(50);
    expect(category_scores.preferred_skills.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Keyword stuffing — matched should be demoted without evidence
// ---------------------------------------------------------------------------

describe("validateRequirement — Test 7: Keyword stuffing guard", () => {
  it("demotes status of stuffed keywords to partially_matched when evidence is missing", () => {
    const stuffed = [
      makeReq({ name: "React", match_status: "matched", evidence: "" }),
      makeReq({ name: "TypeScript", match_status: "matched", evidence: "   " }),
      makeReq({ name: "Kubernetes", match_status: "matched", evidence: "" }),
    ];
    for (const req of stuffed) {
      const validated = validateRequirement(req);
      expect(validated.match_status).toBe("partially_matched");
    }
  });
});

// ---------------------------------------------------------------------------
// Test 8: Empty or unreadable resume
// ---------------------------------------------------------------------------

describe("calculateGeneralScore — Test 8: Empty/unavailable data", () => {
  it("returns score=0 for empty array", () => {
    const { overall_score } = calculateGeneralScore([]);
    expect(overall_score).toBe(0);
  });

  it("returns 0 for all-unavailable categories", () => {
    const unavailable = Object.keys(GENERAL_WEIGHTS).map((category) => ({
      category,
      score: 0,
      details: "",
      suggestions: "",
      available: false,
    }));
    const { overall_score } = calculateGeneralScore(unavailable);
    expect(overall_score).toBe(0);
  });

  it("marks categories as unavailable in the breakdown when data is missing", () => {
    const partial = [
      { category: "section_completeness", score: 70, details: "", suggestions: "", available: true },
      // four others missing
    ];
    const { score_breakdown } = calculateGeneralScore(partial);
    const unavailableCount = score_breakdown.filter((b) => !b.available).length;
    expect(unavailableCount).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Test 9: Job description with no extractable requirements
// ---------------------------------------------------------------------------

describe("calculateJobMatchScore — Test 9: No requirements", () => {
  it("returns job_match_score=0 for empty requirements array", () => {
    const { job_match_score } = calculateJobMatchScore([]);
    expect(job_match_score).toBe(0);
  });

  it("includes a meaningful scoring_note", () => {
    const { scoring_note } = calculateJobMatchScore([]);
    expect(scoring_note.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 10: Malformed LLM JSON — requirements with bad structure
// ---------------------------------------------------------------------------

describe("validateRequirement — Test 10: Malformed LLM data", () => {
  it("returns null for completely invalid entries", () => {
    expect(validateRequirement(null)).toBeNull();
    expect(validateRequirement("bad string")).toBeNull();
    expect(validateRequirement([])).toBeNull();
    expect(validateRequirement({ name: 123 })).toBeNull(); // name is not a string
  });

  it("filters out null entries in calculateJobMatchScore", () => {
    const mixedRequirements = [
      makeReq({ name: "R1", category: "required_skills", evidence: "Evidence" }),
      null,
      "garbage",
      undefined,
      { name: "", category: "required_skills" }, // empty name
      makeReq({ name: "P1", category: "preferred_skills", evidence: "Evidence P" }),
    ];
    // Should not throw; should process only valid entries
    expect(() => calculateJobMatchScore(mixedRequirements)).not.toThrow();
    const { job_match_score } = calculateJobMatchScore(mixedRequirements);
    expect(job_match_score).toBeGreaterThanOrEqual(0);
    expect(job_match_score).toBeLessThanOrEqual(100);
  });

  it("clamps out-of-range scores from LLM", () => {
    const badEntries = [
      { category: "section_completeness", score: 200, details: "", suggestions: "", available: true },
      { category: "skills_keyword_coverage", score: -50, details: "", suggestions: "", available: true },
      { category: "experience_project", score: 50, details: "", suggestions: "", available: true },
      { category: "impact_achievement", score: 50, details: "", suggestions: "", available: true },
      { category: "formatting_extractability", score: 50, details: "", suggestions: "", available: true },
    ];
    const { overall_score, score_breakdown } = calculateGeneralScore(badEntries);
    expect(overall_score).toBeGreaterThanOrEqual(0);
    expect(overall_score).toBeLessThanOrEqual(100);
    const section = score_breakdown.find((b) => b.category === "section_completeness");
    expect(section.score).toBe(100); // clamped from 200
    const skills = score_breakdown.find((b) => b.category === "skills_keyword_coverage");
    expect(skills.score).toBe(0); // clamped from -50
  });
});

// ---------------------------------------------------------------------------
// Test 11: Unavailable/failing Groq API — simulate with mocked response
// ---------------------------------------------------------------------------

describe("Test 11: API failure simulation", () => {
  // The scoring functions are pure and don't call the API.
  // This test verifies that scoring falls back gracefully when given empty data,
  // simulating the state after an API failure where no LLM data is available.
  it("calculateGeneralScore returns safe defaults on empty input (API failure simulation)", () => {
    const { overall_score, scoring_note } = calculateGeneralScore([]);
    expect(overall_score).toBe(0);
    expect(typeof scoring_note).toBe("string");
  });

  it("calculateJobMatchScore returns safe defaults on empty input", () => {
    const { job_match_score, scoring_note } = calculateJobMatchScore([]);
    expect(job_match_score).toBe(0);
    expect(typeof scoring_note).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Test 12: Missing or invalid input fields
// ---------------------------------------------------------------------------

describe("Test 12: Invalid input validation", () => {
  it("calculateGeneralScore handles non-array input gracefully", () => {
    expect(() => calculateGeneralScore(null)).not.toThrow();
    expect(() => calculateGeneralScore(undefined)).not.toThrow();
    expect(() => calculateGeneralScore("string")).not.toThrow();
  });

  it("calculateJobMatchScore handles non-array input gracefully", () => {
    expect(() => calculateJobMatchScore(null)).not.toThrow();
    expect(() => calculateJobMatchScore(undefined)).not.toThrow();
    expect(() => calculateJobMatchScore("string")).not.toThrow();
  });

  it("validateCategoryScore returns null for unknown category names", () => {
    const result = validateCategoryScore({ category: "unknown_cat", score: 80, details: "", suggestions: "" });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 13: Category scores and weights produce correct, in-range results
// ---------------------------------------------------------------------------

describe("Test 13: Weighted formula correctness", () => {
  it("calculates the exact weighted sum correctly", () => {
    const entries = [
      { category: "section_completeness", score: 80, details: "", suggestions: "", available: true },
      { category: "skills_keyword_coverage", score: 60, details: "", suggestions: "", available: true },
      { category: "experience_project", score: 70, details: "", suggestions: "", available: true },
      { category: "impact_achievement", score: 50, details: "", suggestions: "", available: true },
      { category: "formatting_extractability", score: 90, details: "", suggestions: "", available: true },
    ];
    // Expected: 0.20*80 + 0.25*60 + 0.25*70 + 0.15*50 + 0.15*90
    //         = 16 + 15 + 17.5 + 7.5 + 13.5 = 69.5 → rounds to 70
    const { overall_score } = calculateGeneralScore(entries);
    expect(overall_score).toBe(70); // Math.round(69.5) = 70
  });

  it("overall_score is always in [0, 100]", () => {
    for (let s = 0; s <= 100; s += 10) {
      const { overall_score } = calculateGeneralScore(makeCategoryEntries(s));
      expect(overall_score).toBeGreaterThanOrEqual(0);
      expect(overall_score).toBeLessThanOrEqual(100);
    }
  });

  it("job_match_score is always in [0, 100]", () => {
    const allMatched = [
      makeReq({ name: "R1", category: "required_skills", match_status: "matched", evidence: "React experience" }),
      makeReq({ name: "E1", category: "experience", match_status: "matched", evidence: "5 years experience" }),
      makeReq({ name: "P1", category: "preferred_skills", match_status: "matched", evidence: "Kubernetes knowledge" }),
    ];
    const allMissing = allMatched.map((r) => ({ ...r, match_status: "missing", evidence: "" }));
    const { job_match_score: maxScore } = calculateJobMatchScore(allMatched);
    const { job_match_score: minScore } = calculateJobMatchScore(allMissing);
    expect(maxScore).toBe(100);
    expect(minScore).toBe(0);
  });

  it("contribution field equals score × weight", () => {
    const entries = makeCategoryEntries(75);
    const { score_breakdown } = calculateGeneralScore(entries);
    for (const entry of score_breakdown) {
      const expected = Math.round(75 * entry.weight * 100) / 100;
      expect(entry.contribution).toBeCloseTo(expected, 2);
    }
  });

  it("points_possible equals weight × 100", () => {
    const { score_breakdown } = calculateGeneralScore(makeCategoryEntries(50));
    for (const entry of score_breakdown) {
      expect(entry.points_possible).toBeCloseTo(entry.weight * 100, 2);
    }
  });

  it("same inputs always produce same scores (deterministic)", () => {
    const entries = makeCategoryEntries(55);
    const result1 = calculateGeneralScore(entries);
    const result2 = calculateGeneralScore(entries);
    expect(result1.overall_score).toBe(result2.overall_score);
    for (let i = 0; i < result1.score_breakdown.length; i++) {
      expect(result1.score_breakdown[i].score).toBe(result2.score_breakdown[i].score);
    }
  });

  it("does not divide by zero when all categories are unavailable", () => {
    const unavailable = Object.keys(GENERAL_WEIGHTS).map((category) => ({
      category,
      score: 0,
      details: "",
      suggestions: "",
      available: false,
    }));
    // Should not throw; totalWeight would be 0
    expect(() => calculateGeneralScore(unavailable)).not.toThrow();
    const { overall_score } = calculateGeneralScore(unavailable);
    expect(overall_score).toBe(0);
  });

  it("does not divide by zero when no requirements are provided for job match", () => {
    expect(() => calculateJobMatchScore([])).not.toThrow();
  });
});
