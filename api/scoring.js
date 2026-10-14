/**
 * scoring.js
 * -----------
 * Deterministic ATS scoring functions.
 *
 * PRINCIPLE: The LLM extracts facts and proposes classifications.
 * All numeric score calculations are performed here using validated input.
 *
 * General Resume Score weights (must sum to 1.00):
 *   section_completeness      0.20
 *   skills_keyword_coverage   0.25
 *   experience_project        0.25
 *   impact_achievement        0.15
 *   formatting_extractability 0.15
 *
 * Job Match Score weights (must sum to 1.00):
 *   required_score   0.50
 *   experience_score 0.30
 *   preferred_score  0.20
 *
 * Match values:
 *   fully matched    1.0
 *   partially matched 0.5
 *   missing          0.0
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GENERAL_WEIGHTS = {
  section_completeness: 0.20,
  skills_keyword_coverage: 0.25,
  experience_project: 0.25,
  impact_achievement: 0.15,
  formatting_extractability: 0.15,
};

export const JOB_MATCH_WEIGHTS = {
  required: 0.50,
  experience: 0.30,
  preferred: 0.20,
};

/** Valid match_status values from LLM */
const VALID_MATCH_STATUSES = new Set(["matched", "partially_matched", "missing"]);

/** Valid importance values from LLM */
const VALID_IMPORTANCE = new Set(["required", "preferred"]);

/** Valid categories for requirements */
const VALID_CATEGORIES = new Set([
  "required_skills",
  "experience",
  "preferred_skills",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a number between min and max, then round to nearest integer.
 */
export function clampScore(value, min = 0, max = 100) {
  return Math.round(Math.min(max, Math.max(min, Number(value) || 0)));
}

/**
 * Convert a match_status string into a numeric match value (0, 0.5, 1).
 */
export function matchStatusToValue(status) {
  switch (status) {
    case "matched": return 1.0;
    case "partially_matched": return 0.5;
    case "missing": return 0.0;
    default: return 0.0;
  }
}

/**
 * Validate and sanitize a single requirement object from the LLM.
 * Returns null if the object is fundamentally invalid.
 */
export function validateRequirement(req) {
  if (!req || typeof req !== "object") return null;

  const name = typeof req.name === "string" ? req.name.trim().substring(0, 200) : null;
  if (!name) return null;

  const category = VALID_CATEGORIES.has(req.category) ? req.category : "preferred_skills";
  const importance = VALID_IMPORTANCE.has(req.importance) ? req.importance : "preferred";
  const match_status = VALID_MATCH_STATUSES.has(req.match_status) ? req.match_status : "missing";

  let weight = typeof req.weight === "number" ? req.weight : 1.0;
  if (!Number.isFinite(weight) || weight <= 0) weight = 1.0;
  if (weight > 10) weight = 10;

  const evidence = typeof req.evidence === "string" ? req.evidence.substring(0, 500) : "";
  const explanation = typeof req.explanation === "string" ? req.explanation.substring(0, 300) : "";

  // Guard: demote "matched" to "partially_matched" when evidence is absent.
  // Prevents LLM from falsely claiming a match with no supporting text.
  let safe_status = match_status;
  if (match_status === "matched" && (!evidence || evidence.trim().length < 5)) {
    safe_status = "partially_matched";
  }

  return {
    name,
    category,
    importance,
    match_status: safe_status,
    weight,
    evidence,
    explanation,
  };
}

/**
 * Validate and sanitize a score_breakdown entry from the LLM.
 * The LLM proposes category scores (0-100); we clamp them and compute contributions.
 */
export function validateCategoryScore(entry) {
  if (!entry || typeof entry !== "object") return null;

  const validKeys = Object.keys(GENERAL_WEIGHTS);
  const category = validKeys.includes(entry.category) ? entry.category : null;
  if (!category) return null;

  const raw_score = clampScore(entry.score, 0, 100);
  const weight = GENERAL_WEIGHTS[category];
  const contribution = Math.round(raw_score * weight * 100) / 100;
  const points_possible = Math.round(weight * 100 * 100) / 100;

  return {
    category,
    weight,
    score: raw_score,
    contribution,
    points_possible,
    details: typeof entry.details === "string" ? entry.details.substring(0, 500) : "",
    suggestions: typeof entry.suggestions === "string" ? entry.suggestions.substring(0, 300) : "",
    available: entry.available !== false,
  };
}

// ---------------------------------------------------------------------------
// General Resume Score
// ---------------------------------------------------------------------------

/**
 * Calculate the overall General Resume Score from validated category entries.
 *
 * Formula:
 *   score = Σ (category.score × category.weight) / Σ available weights
 *
 * Unavailable categories are excluded from the denominator.
 * If no categories are available, score = 0.
 */
export function calculateGeneralScore(categoryEntries) {
  if (!Array.isArray(categoryEntries) || categoryEntries.length === 0) {
    return {
      overall_score: 0,
      score_breakdown: [],
      scoring_note: "No category data available to compute score.",
    };
  }

  const validEntries = categoryEntries.map(validateCategoryScore).filter(Boolean);

  const entryMap = {};
  for (const e of validEntries) {
    entryMap[e.category] = e;
  }

  const allCategories = Object.keys(GENERAL_WEIGHTS);
  const breakdown = allCategories.map((cat) => {
    if (entryMap[cat]) return entryMap[cat];
    return {
      category: cat,
      weight: GENERAL_WEIGHTS[cat],
      score: 0,
      contribution: 0,
      points_possible: Math.round(GENERAL_WEIGHTS[cat] * 100 * 100) / 100,
      details: "Category data not available.",
      suggestions: "",
      available: false,
    };
  });

  const available = breakdown.filter((e) => e.available);
  const totalWeight = available.reduce((sum, e) => sum + e.weight, 0);

  let weightedSum = 0;
  for (const e of available) {
    weightedSum += e.score * e.weight;
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const overall_score = clampScore(rawScore, 0, 100);

  const scoring_note =
    totalWeight < 1.0
      ? `Score computed from ${available.length} of ${allCategories.length} available categories (total weight: ${Math.round(totalWeight * 100)}%). Missing categories excluded from denominator.`
      : "Score computed from all 5 categories using deterministic weighted formula.";

  return { overall_score, score_breakdown: breakdown, scoring_note };
}

// ---------------------------------------------------------------------------
// Job Match Score
// ---------------------------------------------------------------------------

/**
 * Calculate the Job Match Score from validated requirement objects.
 *
 * Categories and weights:
 *   required_skills  → 0.50
 *   experience       → 0.30
 *   preferred_skills → 0.20
 *
 * Category score = 100 × Σ(req.weight × match_value) / Σ(req.weight)
 *
 * Empty categories are excluded and weights re-normalised.
 * Dividing by zero is explicitly guarded.
 */
export function calculateJobMatchScore(requirements) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return {
      job_match_score: 0,
      category_scores: {},
      scoring_note: "No requirements extracted from job description.",
    };
  }

  const validReqs = requirements.map(validateRequirement).filter(Boolean);

  const groups = {
    required_skills: [],
    experience: [],
    preferred_skills: [],
  };
  for (const req of validReqs) {
    const cat = req.category in groups ? req.category : "preferred_skills";
    groups[cat].push(req);
  }

  const categoryWeightMap = {
    required_skills: JOB_MATCH_WEIGHTS.required,
    experience: JOB_MATCH_WEIGHTS.experience,
    preferred_skills: JOB_MATCH_WEIGHTS.preferred,
  };

  const category_scores = {};
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [cat, reqs] of Object.entries(groups)) {
    if (reqs.length === 0) {
      category_scores[cat] = {
        score: null,
        available: false,
        requirement_count: 0,
        matched: 0,
        partially_matched: 0,
        missing: 0,
      };
      continue;
    }

    let numerator = 0;
    let denominator = 0;
    let matched = 0, partially_matched = 0, missing = 0;

    for (const req of reqs) {
      const mv = matchStatusToValue(req.match_status);
      numerator += req.weight * mv;
      denominator += req.weight;
      if (req.match_status === "matched") matched++;
      else if (req.match_status === "partially_matched") partially_matched++;
      else missing++;
    }

    const score = denominator > 0 ? clampScore((numerator / denominator) * 100) : 0;
    category_scores[cat] = {
      score,
      available: true,
      requirement_count: reqs.length,
      matched,
      partially_matched,
      missing,
    };

    const catWeight = categoryWeightMap[cat];
    totalWeight += catWeight;
    weightedSum += score * catWeight;
  }

  const job_match_score = totalWeight > 0 ? clampScore(weightedSum / totalWeight) : 0;

  const availableCount = Object.values(category_scores).filter((c) => c.available).length;
  const scoring_note =
    availableCount < 3
      ? `Job match score computed from ${availableCount} of 3 requirement categories. Missing categories excluded and weights re-normalised.`
      : "Job match score computed from all 3 requirement categories using deterministic weighted formula.";

  return { job_match_score, category_scores, scoring_note };
}

// ---------------------------------------------------------------------------
// Verification helpers (used in tests)
// ---------------------------------------------------------------------------

export function verifyGeneralWeights() {
  const sum = Object.values(GENERAL_WEIGHTS).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) < 1e-9;
}

export function verifyJobMatchWeights() {
  const sum = Object.values(JOB_MATCH_WEIGHTS).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) < 1e-9;
}
