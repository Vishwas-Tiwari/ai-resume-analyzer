interface CategoryBreakdown {
  category: string;
  weight: number;
  score: number;
  contribution: number;
  points_possible: number;
  details: string;
  suggestions: string;
  available: boolean;
}

interface ScoreBreakdownProps {
  breakdown: CategoryBreakdown[];
  scoringNote?: string;
  title?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  section_completeness: "Section Completeness",
  skills_keyword_coverage: "Skills & Keyword Coverage",
  experience_project: "Experience & Project Evidence",
  impact_achievement: "Impact & Achievement Quality",
  formatting_extractability: "Formatting & Extractability",
};

const CATEGORY_ICONS: Record<string, string> = {
  section_completeness: "📋",
  skills_keyword_coverage: "💡",
  experience_project: "🏗️",
  impact_achievement: "🎯",
  formatting_extractability: "📄",
};

function getScoreColor(score: number): { bar: string; text: string; bg: string } {
  if (score >= 80) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" };
  if (score >= 60) return { bar: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50" };
  if (score >= 40) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
  return { bar: "bg-red-500", text: "text-red-700", bg: "bg-red-50" };
}

export function ScoreBreakdown({ breakdown, scoringNote, title = "Resume Quality Score Breakdown" }: ScoreBreakdownProps) {
  if (!breakdown || breakdown.length === 0) return null;

  const totalContribution = breakdown
    .filter((b) => b.available)
    .reduce((sum, b) => sum + b.contribution, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
        📊 {title}
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Each category is evaluated independently. The weighted formula is shown transparently below.
      </p>

      {/* Formula Summary */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-5 font-mono text-xs text-gray-600 leading-relaxed overflow-x-auto">
        <p className="font-semibold text-gray-700 mb-1.5 font-sans text-xs not-italic">Formula</p>
        {breakdown.map((b) => (
          <div key={b.category} className={b.available ? "" : "opacity-40"}>
            <span>{(b.weight * 100).toFixed(0)}% × {b.score.toFixed(0)} </span>
            <span className="text-gray-400">({CATEGORY_LABELS[b.category] || b.category})</span>
            {!b.available && <span className="text-gray-400 ml-1">[unavailable]</span>}
          </div>
        ))}
        <div className="border-t border-gray-200 mt-2 pt-2 font-semibold text-gray-800">
          = {Math.round(totalContribution)} / 100 points
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {breakdown.map((item) => {
          const label = CATEGORY_LABELS[item.category] || item.category;
          const icon = CATEGORY_ICONS[item.category] || "📊";
          const colors = getScoreColor(item.score);

          return (
            <div key={item.category} className={`rounded-xl border p-4 ${item.available ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-60"}`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
                    <p className="text-xs text-gray-500">Weight: {(item.weight * 100).toFixed(0)}% of total score</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {item.available ? (
                    <>
                      <span className={`text-lg font-bold ${colors.text}`}>{item.score}</span>
                      <span className="text-gray-400 text-sm">/100</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">N/A</span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {item.available && (
                <div className="w-full h-2 bg-gray-100 rounded-full mb-3">
                  <div
                    className={`h-2 rounded-full ${colors.bar} transition-all duration-700`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              )}

              {/* Contribution */}
              {item.available && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} mb-3`}>
                  Contribution: {item.contribution.toFixed(1)} / {item.points_possible.toFixed(1)} pts
                  <span className="opacity-60">({(item.weight * 100).toFixed(0)}% × {item.score}/100)</span>
                </div>
              )}

              {/* Details */}
              {item.details && (
                <p className="text-sm text-gray-600 mb-2 leading-relaxed">{item.details}</p>
              )}

              {/* Suggestion */}
              {item.suggestions && item.available && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    <span className="font-semibold">💡 Suggestion: </span>{item.suggestions}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scoring Note */}
      {scoringNote && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
          <span className="text-amber-600 flex-shrink-0">ℹ️</span>
          <p className="text-xs text-amber-800 leading-relaxed">{scoringNote}</p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-3 text-center">
        This is an estimated resume quality score, not an actual ATS score. It does not guarantee ATS acceptance, an interview, or a hiring decision.
      </p>
    </div>
  );
}
