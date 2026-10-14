import { useState, useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { ScoreGauge } from "~/components/ScoreGauge";
import { WeakPoints } from "~/components/WeakPoints";
import { SectionAnalysis } from "~/components/SectionAnalysis";
import { ImprovementCards } from "~/components/ImprovementCards";
import { KeywordsAnalysis } from "~/components/KeywordsAnalysis";
import { AnalysisSkeleton } from "~/components/AnalysisSkeleton";
import { ScoreBreakdown } from "~/components/ScoreBreakdown";
import { JobMatchResults } from "~/components/JobMatchResults";

export function meta() {
  return [
    { title: "Analyze Resume - AI Resume Analyzer" },
    {
      name: "description",
      content:
        "Upload your resume (PDF or DOCX) and get AI-powered ATS analysis with deterministic scoring, weak points, and actionable suggestions. Optionally match against a job description.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface Requirement {
  name: string;
  category: string;
  importance: string;
  match_status: "matched" | "partially_matched" | "missing";
  weight: number;
  evidence: string;
  explanation: string;
}

interface CategoryMatchScore {
  score: number | null;
  available: boolean;
  requirement_count: number;
  matched: number;
  partially_matched: number;
  missing: number;
}

interface AnalysisResult {
  analysis_mode: "general" | "job_match";
  overall_score: number;
  job_match_score?: number;
  scoring_note?: string;
  job_match_scoring_note?: string;
  score_breakdown?: CategoryBreakdown[];
  job_match_breakdown?: Record<string, CategoryMatchScore>;
  requirement_analysis?: Requirement[];
  matched_skills?: string[];
  partially_matched_skills?: string[];
  missing_skills?: string[];
  summary?: string;
  section_analysis?: { section: string; score: number; found: boolean; details: string; fix: string }[];
  weak_points?: { point: string; quote: string; impact: string }[];
  missing_skills_or_sections?: string[];
  formatting_issues?: string[];
  improvements?: { area: string; current: string; suggested: string; why: string }[];
  keywords_analysis?: { found: string[]; missing: string[] };
}

type AnalysisMode = "general" | "job_match";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalyzeResume() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<AnalysisMode>("general");
  const [jobDescription, setJobDescription] = useState("");
  const [jdError, setJdError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ACCEPTED_TYPES = {
    "application/pdf": [".pdf"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  };

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === "file-too-large") {
        setError("File size exceeds 5MB limit. Please upload a smaller file.");
      } else if (rejection.errors[0]?.code === "file-invalid-type") {
        setError("Invalid file type. Only PDF and DOCX files are accepted.");
      } else {
        setError("Invalid file. Please upload a PDF or DOCX file (max 5MB).");
      }
      return;
    }
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    disabled: status === "uploading" || status === "analyzing",
  });

  const handleModeChange = (newMode: AnalysisMode) => {
    setMode(newMode);
    setJdError(null);
    setError(null);
  };

  const validateJobDescription = () => {
    if (mode === "job_match") {
      if (!jobDescription.trim()) {
        setJdError("Please paste a job description to use job-match analysis.");
        return false;
      }
      if (jobDescription.trim().length < 50) {
        setJdError("Job description is too short. Please include at least 50 characters describing the role.");
        return false;
      }
      if (jobDescription.length > 8000) {
        setJdError("Job description is too long. Please limit it to 8,000 characters.");
        return false;
      }
    }
    setJdError(null);
    return true;
  };

  const handleAnalyze = async () => {
    if (!file) return;
    if (!validateJobDescription()) return;

    setStatus("uploading");
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("mode", mode);
      if (mode === "job_match") {
        formData.append("job_description", jobDescription);
      }

      setStatus("analyzing");

      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Analysis failed (HTTP ${response.status})`);
      }

      const data = await response.json();
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
      setStatus("error");
    }
  };

  const handleReset = () => {
    setFile(null);
    setStatus("idle");
    setError(null);
    setResult(null);
    setJdError(null);
  };

  const isJobMatch = result?.analysis_mode === "job_match";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Page Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Powered by Groq AI · Deterministic Scoring
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Analyze Your Resume
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto text-base sm:text-lg">
            Upload your resume for an AI-powered analysis with transparent ATS scoring.
            Optionally match against a specific job description.
          </p>
        </div>

        {/* Upload & Config Section */}
        {status !== "done" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-6">

            {/* Mode Selector */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Analysis Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="mode-general"
                  type="button"
                  onClick={() => handleModeChange("general")}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                    mode === "general"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-2xl">📄</span>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900">General Analysis</p>
                    <p className="text-xs text-gray-500 mt-0.5">Overall resume quality score</p>
                  </div>
                  {mode === "general" && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>

                <button
                  id="mode-job-match"
                  type="button"
                  onClick={() => handleModeChange("job_match")}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                    mode === "job_match"
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-2xl">🎯</span>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-900">Job Description Match</p>
                    <p className="text-xs text-gray-500 mt-0.5">Compare against a specific role</p>
                  </div>
                  {mode === "job_match" && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Job Description Textarea */}
            {mode === "job_match" && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <label htmlFor="job-description" className="block text-sm font-semibold text-gray-700 mb-2">
                  Job Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="job-description"
                  rows={6}
                  value={jobDescription}
                  onChange={(e) => {
                    setJobDescription(e.target.value);
                    if (jdError) setJdError(null);
                  }}
                  placeholder="Paste the full job description here — including responsibilities, required skills, preferred qualifications, and experience requirements..."
                  className={`w-full px-4 py-3 rounded-xl border text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all resize-none ${
                    jdError
                      ? "border-red-300 focus:ring-red-300 bg-red-50"
                      : "border-gray-300 focus:ring-blue-300 focus:border-blue-400"
                  }`}
                  disabled={status === "analyzing" || status === "uploading"}
                />
                <div className="flex items-center justify-between mt-1.5">
                  {jdError ? (
                    <p className="text-xs text-red-600">{jdError}</p>
                  ) : (
                    <p className="text-xs text-gray-400">Min 50 chars · Max 8,000 chars</p>
                  )}
                  <p className={`text-xs ${jobDescription.length > 7500 ? "text-amber-600" : "text-gray-400"}`}>
                    {jobDescription.length}/8,000
                  </p>
                </div>
              </div>
            )}

            {/* Drop Zone */}
            <div
              {...getRootProps()}
              className={`
                relative border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer
                transition-all duration-300 ease-out
                ${isDragActive
                  ? "border-blue-500 bg-blue-50 scale-[1.01] shadow-lg shadow-blue-100"
                  : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/30"
                }
                ${status === "uploading" || status === "analyzing" ? "opacity-50 pointer-events-none" : ""}
              `}
            >
              <input {...getInputProps()} id="resume-upload" />
              <div className="flex flex-col items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${isDragActive ? "bg-blue-200 scale-110" : "bg-blue-100"}`}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`w-7 h-7 transition-colors duration-300 ${isDragActive ? "text-blue-700" : "text-blue-500"}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                {isDragActive ? (
                  <div>
                    <p className="text-blue-700 font-semibold">Drop your resume here</p>
                    <p className="text-blue-500 text-sm mt-1">Release to upload</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-800 font-semibold">Drag & drop your resume here</p>
                    <p className="text-gray-500 text-sm mt-1">
                      or <span className="text-blue-600 font-medium underline underline-offset-2">click to browse</span>
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-3 text-xs text-gray-400">
                      <span>PDF or DOCX</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span>Max 5MB</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selected File */}
            {file && status !== "analyzing" && status !== "uploading" && (
              <div className="mt-4 flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  aria-label="Remove file"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl animate-in fade-in duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">{error}</p>
                  <button onClick={handleReset} className="text-xs text-red-600 hover:text-red-800 underline mt-1">
                    Try again
                  </button>
                </div>
              </div>
            )}

            {/* Analyze Button */}
            {file && status !== "analyzing" && status !== "uploading" && (
              <button
                id="analyze-btn"
                onClick={handleAnalyze}
                disabled={!file}
                className={`mt-5 w-full py-3.5 px-6 text-white font-semibold rounded-xl shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  mode === "job_match"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:from-indigo-700 hover:to-purple-700"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-700 hover:to-indigo-700"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {mode === "job_match" ? "Analyze vs. Job Description" : "Analyze with AI"}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Loading State */}
        {(status === "uploading" || status === "analyzing") && (
          <AnalysisSkeleton status={status} />
        )}

        {/* Results */}
        {status === "done" && result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Score Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Resume Quality Score */}
                <div className="flex flex-col items-center gap-2">
                  <ScoreGauge score={result.overall_score} />
                  <p className="text-xs text-gray-500 font-medium">Resume Quality Score</p>
                </div>

                {/* Job Match Score (job_match mode only) */}
                {isJobMatch && result.job_match_score !== undefined && (
                  <>
                    <div className="hidden sm:block w-px h-20 bg-gray-100" />
                    <div className="flex flex-col items-center gap-2">
                      <ScoreGauge score={result.job_match_score} />
                      <p className="text-xs text-gray-500 font-medium">Job Match Score</p>
                    </div>
                  </>
                )}

                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                    <h2 className="text-xl font-bold text-gray-900">
                      {isJobMatch ? "Job Match Analysis Complete" : "Resume Analysis Complete"}
                    </h2>
                  </div>
                  {result.summary && (
                    <p className="text-gray-600 text-sm mb-3 leading-relaxed">{result.summary}</p>
                  )}
                  {isJobMatch && (
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start text-xs">
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        📊 Quality: <strong>{result.overall_score}/100</strong>
                      </span>
                      <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                        🎯 Match: <strong>{result.job_match_score}/100</strong>
                      </span>
                    </div>
                  )}
                </div>

                <button
                  id="analyze-another-btn"
                  onClick={handleReset}
                  className="px-5 py-2.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors flex-shrink-0"
                >
                  Analyze Another
                </button>
              </div>
            </div>

            {/* Scores are separate — explain the difference */}
            {isJobMatch && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <span className="text-blue-500 flex-shrink-0">ℹ️</span>
                <p className="text-xs text-blue-700 leading-relaxed">
                  <strong>Resume Quality Score</strong> measures overall resume effectiveness across 5 categories (section completeness, skills, experience, impact, formatting).{" "}
                  <strong>Job Match Score</strong> measures compatibility with this specific job description (required skills 50%, experience 30%, preferred skills 20%).
                  These are kept separate to give you a more accurate picture.
                </p>
              </div>
            )}

            {/* Score Breakdown (deterministic, transparent) */}
            {result.score_breakdown && result.score_breakdown.length > 0 && (
              <ScoreBreakdown
                breakdown={result.score_breakdown}
                scoringNote={result.scoring_note}
                title="Resume Quality Score Breakdown"
              />
            )}

            {/* Job Match Results */}
            {isJobMatch && result.requirement_analysis && (
              <JobMatchResults
                requirements={result.requirement_analysis}
                jobMatchBreakdown={result.job_match_breakdown}
                jobMatchScore={result.job_match_score ?? 0}
                matchedSkills={result.matched_skills}
                partiallyMatchedSkills={result.partially_matched_skills}
                missingSkills={result.missing_skills}
                scoringNote={result.job_match_scoring_note}
              />
            )}

            {/* Section Analysis */}
            {result.section_analysis && result.section_analysis.length > 0 && (
              <SectionAnalysis sections={result.section_analysis} />
            )}

            {/* Weak Points */}
            {result.weak_points && result.weak_points.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">⚠️ Weak Points</h3>
                <div className="space-y-3">
                  {result.weak_points.map((wp, i) => (
                    <div key={i} className="p-4 rounded-xl bg-red-50/50 border border-red-100">
                      <p className="text-sm font-medium text-red-900 mb-1">{wp.point}</p>
                      {wp.quote && (
                        <p className="text-xs text-red-700 bg-red-100/50 px-3 py-1.5 rounded-lg italic mb-1.5">
                          From resume: "{wp.quote}"
                        </p>
                      )}
                      {wp.impact && <p className="text-xs text-red-600">⚡ {wp.impact}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Improvements */}
            {result.improvements && result.improvements.length > 0 && (
              <ImprovementCards improvements={result.improvements} />
            )}

            {/* Keywords */}
            {result.keywords_analysis &&
              (result.keywords_analysis.found?.length > 0 || result.keywords_analysis.missing?.length > 0) && (
                <KeywordsAnalysis
                  found={result.keywords_analysis.found || []}
                  missing={result.keywords_analysis.missing || []}
                />
              )}

            {/* Missing Sections (general mode only) */}
            {!isJobMatch && result.missing_skills_or_sections && result.missing_skills_or_sections.length > 0 && (
              <WeakPoints title="Missing Skills or Sections" items={result.missing_skills_or_sections} color="orange" />
            )}

            {/* Formatting Issues */}
            {result.formatting_issues && result.formatting_issues.length > 0 && (
              <WeakPoints title="Formatting Issues" items={result.formatting_issues} color="yellow" />
            )}

            {file && <p className="text-center text-xs text-gray-400 pt-2">Analyzed: {file.name}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
