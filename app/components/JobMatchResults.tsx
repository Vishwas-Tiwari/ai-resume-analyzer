interface Requirement {
  name: string;
  category: string;
  importance: string;
  match_status: "matched" | "partially_matched" | "missing";
  weight: number;
  evidence: string;
  explanation: string;
}

interface CategoryScore {
  score: number | null;
  available: boolean;
  requirement_count: number;
  matched: number;
  partially_matched: number;
  missing: number;
}

interface JobMatchResultsProps {
  requirements: Requirement[];
  jobMatchBreakdown?: Record<string, CategoryScore>;
  jobMatchScore: number;
  matchedSkills?: string[];
  partiallyMatchedSkills?: string[];
  missingSkills?: string[];
  scoringNote?: string;
}

const CAT_LABELS: Record<string, string> = {
  required_skills: "Required Skills",
  experience: "Experience",
  preferred_skills: "Preferred Skills",
};

const CAT_WEIGHTS: Record<string, number> = {
  required_skills: 50,
  experience: 30,
  preferred_skills: 20,
};

function MatchBadge({ status }: { status: string }) {
  switch (status) {
    case "matched":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Matched
        </span>
      );
    case "partially_matched":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
          Partial
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          Missing
        </span>
      );
  }
}

function ImportanceBadge({ importance }: { importance: string }) {
  return importance === "required" ? (
    <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium border border-red-100">Required</span>
  ) : (
    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium border border-blue-100">Preferred</span>
  );
}

export function JobMatchResults({
  requirements,
  jobMatchBreakdown,
  jobMatchScore,
  matchedSkills = [],
  partiallyMatchedSkills = [],
  missingSkills = [],
  scoringNote,
}: JobMatchResultsProps) {
  const categories = ["required_skills", "experience", "preferred_skills"];

  const groupedReqs = categories.reduce<Record<string, Requirement[]>>((acc, cat) => {
    acc[cat] = requirements.filter((r) => r.category === cat);
    return acc;
  }, {});

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-5">
      {/* Job Match Score Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
          🎯 Job Match Score
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Measures how well your resume matches this specific job description. Separate from the Resume Quality Score.
        </p>

        {/* Score display */}
        <div className="flex items-center gap-5 mb-5">
          <div className="relative flex-shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100" />
              <circle
                cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
                className={jobMatchScore >= 80 ? "stroke-emerald-500" : jobMatchScore >= 60 ? "stroke-blue-500" : jobMatchScore >= 40 ? "stroke-amber-500" : "stroke-red-500"}
                style={{
                  strokeDasharray: 2 * Math.PI * 42,
                  strokeDashoffset: 2 * Math.PI * 42 * (1 - jobMatchScore / 100),
                  transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${getScoreColor(jobMatchScore)}`}>{jobMatchScore}</span>
              <span className="text-xs text-gray-400">/100</span>
            </div>
          </div>

          {/* Category breakdown summary */}
          {jobMatchBreakdown && (
            <div className="flex-1 space-y-2">
              {categories.map((cat) => {
                const cs = jobMatchBreakdown[cat];
                if (!cs) return null;
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-32 flex-shrink-0">{CAT_LABELS[cat]}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      {cs.available && cs.score !== null ? (
                        <div
                          className={`h-1.5 rounded-full transition-all duration-700 ${cs.score >= 80 ? "bg-emerald-500" : cs.score >= 60 ? "bg-blue-500" : cs.score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${cs.score}%` }}
                        />
                      ) : (
                        <div className="h-1.5 bg-gray-200 rounded-full w-full" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-12 text-right">
                      {cs.available && cs.score !== null ? `${cs.score}/100` : "N/A"}
                    </span>
                    <span className="text-xs text-gray-400">({CAT_WEIGHTS[cat]}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category detail cards */}
        {jobMatchBreakdown && (
          <div className="grid gap-3 sm:grid-cols-3">
            {categories.map((cat) => {
              const cs = jobMatchBreakdown[cat];
              if (!cs) return null;
              return (
                <div key={cat} className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                  <p className="text-xs text-gray-500 font-medium mb-1">{CAT_LABELS[cat]}</p>
                  <p className={`text-xl font-bold ${cs.available && cs.score !== null ? getScoreColor(cs.score) : "text-gray-400"}`}>
                    {cs.available && cs.score !== null ? cs.score : "N/A"}
                  </p>
                  {cs.available && (
                    <div className="flex justify-center gap-2 mt-1.5 text-xs">
                      <span className="text-emerald-600">✓{cs.matched}</span>
                      <span className="text-amber-600">~{cs.partially_matched}</span>
                      <span className="text-red-600">✗{cs.missing}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Weight: {CAT_WEIGHTS[cat]}%</p>
                </div>
              );
            })}
          </div>
        )}

        {scoringNote && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <span className="text-amber-600 flex-shrink-0 text-sm">ℹ️</span>
            <p className="text-xs text-amber-800 leading-relaxed">{scoringNote}</p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-3 text-center">
          This is an estimated compatibility score. It does not represent an actual ATS decision or guarantee an interview.
        </p>
      </div>

      {/* Skills Summary */}
      {(matchedSkills.length > 0 || partiallyMatchedSkills.length > 0 || missingSkills.length > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">🔑 Skills Match Summary</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {matchedSkills.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                  <span>✓ Matched ({matchedSkills.length})</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchedSkills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 font-medium">{skill}</span>
                  ))}
                </div>
              </div>
            )}
            {partiallyMatchedSkills.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-2">~ Partial ({partiallyMatchedSkills.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {partiallyMatchedSkills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">{skill}</span>
                  ))}
                </div>
              </div>
            )}
            {missingSkills.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-2">✗ Missing ({missingSkills.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingSkills.map((skill, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs rounded-full bg-red-100 text-red-700 font-medium">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Requirement Analysis */}
      {requirements.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">📋 Requirement Analysis</h3>
          <p className="text-xs text-gray-500 mb-4">Each job requirement is evaluated individually with supporting evidence from your resume.</p>

          <div className="space-y-5">
            {categories.map((cat) => {
              const reqs = groupedReqs[cat];
              if (!reqs || reqs.length === 0) return null;
              return (
                <div key={cat}>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    {CAT_LABELS[cat]}
                    <span className="text-xs text-gray-400 font-normal">({reqs.length} requirements · {CAT_WEIGHTS[cat]}% weight)</span>
                  </h4>
                  <div className="space-y-2.5">
                    {reqs.map((req, i) => (
                      <div
                        key={i}
                        className={`p-4 rounded-xl border ${
                          req.match_status === "matched"
                            ? "bg-emerald-50/60 border-emerald-100"
                            : req.match_status === "partially_matched"
                            ? "bg-amber-50/60 border-amber-100"
                            : "bg-red-50/40 border-red-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{req.name}</span>
                            <ImportanceBadge importance={req.importance} />
                            <MatchBadge status={req.match_status} />
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">wt: {req.weight.toFixed(1)}</span>
                        </div>
                        {req.evidence && (
                          <p className="text-xs text-gray-600 bg-white/70 px-3 py-1.5 rounded-lg border border-gray-100 italic mb-2">
                            Evidence: "{req.evidence}"
                          </p>
                        )}
                        {req.explanation && (
                          <p className="text-xs text-gray-500">{req.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
