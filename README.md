# AI Resume Analyzer

> **Live Demo:** [https://ai-resume-analyzer-zeta-taupe.vercel.app/](https://ai-resume-analyzer-zeta-taupe.vercel.app/)

An AI-powered resume analysis tool that gives you a transparent, deterministic ATS score, identifies weak points, and provides actionable suggestions — in two modes: **General Analysis** and **Job Description Match**.

Built with React Router v7, TypeScript, and the Groq AI API (LLM). Deployable to Vercel in one click.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture Overview](#architecture-overview)
- [How It Works](#how-it-works)
- [Scoring System](#scoring-system)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Deployment (Vercel)](#deployment-vercel)
- [Docker](#docker)
- [Running Tests](#running-tests)

---

## Features

- 📄 **Upload PDF or DOCX** resumes (up to 5 MB)
- 🤖 **AI-powered analysis** via Groq LLM — fast, structured JSON output
- 📊 **Deterministic ATS scoring** — scores are always computed the same way, not hallucinated by the LLM
- 🎯 **Two analysis modes:**
  - **General** — overall resume quality across 5 weighted categories
  - **Job Match** — compare your resume against a specific job description
- 🔍 **Detailed breakdowns** — section-by-section scores, weak points with quotes, improvement suggestions, and keyword gap analysis
- 🔒 **Secure** — API key never exposed to the browser; no resume data stored persistently

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                        │
│                                                             │
│   React Router v7 (SPA mode, ssr: false)                   │
│   ├── Home page          (app/routes/home.tsx)              │
│   └── Analyze Resume     (app/routes/analyze-resume.tsx)    │
│       ├── ScoreGauge         (SVG circular gauge)           │
│       ├── ScoreBreakdown     (category bars)                │
│       ├── JobMatchResults    (requirement-level detail)     │
│       ├── SectionAnalysis    (per-section scores)           │
│       ├── WeakPoints         (LLM-found weaknesses)         │
│       ├── ImprovementCards   (before/after suggestions)     │
│       └── KeywordsAnalysis   (found vs. missing keywords)   │
└────────────────────┬────────────────────────────────────────┘
                     │  POST /api/analyze-resume
                     │  multipart/form-data
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Serverless Function (api/analyze-resume.js)       │
│                                                             │
│  1. Parse multipart form (custom parser, no extra deps)     │
│  2. Extract text from PDF (pdf-parse) or DOCX (mammoth)     │
│  3. Build structured prompt → call Groq LLM                 │
│  4. Parse + sanitize LLM JSON response                      │
│  5. Run deterministic scoring (api/scoring.js)              │
│  6. Return validated JSON to browser                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
             ┌───────────────┐
             │   Groq API    │
             │ (LLM backend) │
             └───────────────┘
```

**Key design principle:** The LLM is used only for *fact extraction* (what sections exist, what skills are present, what the evidence is). All numeric scoring is done deterministically in `api/scoring.js` — the LLM cannot inflate or deflate scores.

---

## How It Works

### Step 1 — File Upload
The user drags and drops (or selects) a PDF or DOCX resume. The file is validated client-side (type and size), then sent as `multipart/form-data` to the backend.

### Step 2 — Text Extraction (Server)
The serverless function extracts raw text from the uploaded file:
- **PDF** → [`pdf-parse`](https://www.npmjs.com/package/pdf-parse)
- **DOCX** → [`mammoth`](https://www.npmjs.com/package/mammoth)

Text is clamped to 12,000 characters before being sent to the LLM to stay within token limits.

### Step 3 — LLM Prompt & Response
A carefully crafted prompt is sent to the Groq API. The prompt instructs the model to return **only valid JSON** with a fixed schema — no markdown, no explanations. Prompt injection from the resume content is explicitly guarded against.

Two prompt modes exist:
- `buildGeneralPrompt(resumeText)` — asks the LLM to evaluate across 5 ATS categories
- `buildJobMatchPrompt(resumeText, jobDescription)` — asks the LLM to map each job requirement against resume evidence

### Step 4 — Deterministic Scoring (`api/scoring.js`)
Once the LLM JSON is received and sanitized, the actual scores are computed here — not by the LLM:

**General Score formula:**
```
overall_score = Σ(category_score × category_weight) / Σ(available weights)
```

**Job Match Score formula:**
```
category_score = 100 × Σ(req.weight × match_value) / Σ(req.weight)
overall_job_match = Σ(category_score × category_weight)
```

Where `match_value` is: `matched = 1.0`, `partially_matched = 0.5`, `missing = 0.0`.

### Step 5 — Sanitization & Response
All LLM output is sanitized before being returned to the browser:
- Strings are length-capped
- Arrays are item-limited
- Match statuses are validated against allowed enums
- A "matched" requirement without evidence is demoted to "partially_matched"
- Stack traces and secrets are never leaked in error responses

---

## Scoring System

### General Resume Score (out of 100)

| Category | Weight | What it measures |
|---|---|---|
| `section_completeness` | 20% | Presence of key resume sections (Summary, Skills, Experience, Education, etc.) |
| `skills_keyword_coverage` | 25% | Breadth and relevance of listed skills and technologies |
| `experience_project` | 25% | Quality, specificity, and relevance of work experience and projects |
| `impact_achievement` | 15% | Whether bullet points describe measurable outcomes |
| `formatting_extractability` | 15% | Text extraction quality; structure clarity for ATS parsers |

### Job Match Score (out of 100)

| Category | Weight | What it measures |
|---|---|---|
| `required_skills` | 50% | How well the resume matches must-have technical skills |
| `experience` | 30% | Years of experience, domain, and seniority match |
| `preferred_skills` | 20% | Bonus/nice-to-have qualifications |

The two scores (Resume Quality and Job Match) are kept **separate** on purpose — a strong resume can still be a poor match for a specific role, and vice versa.

---

## Project Structure

```
.
├── api/
│   ├── analyze-resume.js     # Vercel serverless handler — orchestrates the full pipeline
│   └── scoring.js            # Deterministic scoring functions (no LLM involvement)
│
├── app/
│   ├── routes/
│   │   ├── home.tsx          # Landing page
│   │   └── analyze-resume.tsx # Main analysis UI + state machine
│   ├── components/
│   │   ├── ScoreGauge.tsx        # SVG circular score dial
│   │   ├── ScoreBreakdown.tsx    # Category score bars with tooltips
│   │   ├── JobMatchResults.tsx   # Requirement-level match table
│   │   ├── SectionAnalysis.tsx   # Per-section score list
│   │   ├── WeakPoints.tsx        # Highlighted weaknesses
│   │   ├── ImprovementCards.tsx  # Before/after suggestion cards
│   │   ├── KeywordsAnalysis.tsx  # Found vs. missing keyword chips
│   │   ├── AnalysisSkeleton.tsx  # Loading skeleton during analysis
│   │   └── Navbar.tsx            # Top navigation bar
│   ├── routes.ts             # Route definitions
│   ├── root.tsx              # App shell (HTML, fonts, global layout)
│   └── app.css               # Global styles
│
├── tests/
│   └── scoring.test.js       # Unit tests for scoring.js (Vitest)
│
├── server.js                 # Local dev Express server (mirrors Vercel serverless)
├── vite.config.ts            # Vite config — includes /api proxy for local dev
├── react-router.config.ts    # SPA mode config
├── vercel.json               # Vercel deployment config
├── Dockerfile                # Multi-stage Docker build
├── .env.example              # Environment variable template
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [React Router v7](https://reactrouter.com/) (SPA mode) |
| Language | TypeScript + JavaScript (ESM) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Build tool | [Vite](https://vite.dev/) |
| AI / LLM | [Groq API](https://console.groq.com/) |
| PDF parsing | [pdf-parse](https://www.npmjs.com/package/pdf-parse) |
| DOCX parsing | [mammoth](https://www.npmjs.com/package/mammoth) |
| File upload UI | [react-dropzone](https://react-dropzone.js.org/) |
| Tests | [Vitest](https://vitest.dev/) |
| Hosting | [Vercel](https://vercel.com/) (serverless functions + static SPA) |
| Container | Docker (multi-stage build) |

---

## Local Development

You need **two processes** running simultaneously: the Vite frontend (port 5173) and the local API server (port 3001). The Vite dev server proxies all `/api/*` requests to the API server.

### 1. Clone and install

```bash
git clone https://github.com/Vishwas-Tiwari/resume_analyser.git
cd resume_analyser
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env and add your Groq API key
# Get one free at https://console.groq.com/keys
```

### 3. Run both servers

**Terminal 1 — API server:**
```bash
node server.js
# → API server running at http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
npm run dev
# → Frontend running at http://localhost:5173
```

Open [http://localhost:5173/analyze-resume](http://localhost:5173/analyze-resume).

> **Or run both at once:** `npm run dev:all` (uses `concurrently`)

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Your Groq API key. Get one free at [console.groq.com/keys](https://console.groq.com/keys). |

The API key is only ever used on the server — it is never bundled into the frontend or exposed to the browser.

---

## Deployment (Vercel)

This project is pre-configured for Vercel zero-config deployment.

1. Push your repo to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add the `GROQ_API_KEY` environment variable in Vercel project settings
4. Deploy — Vercel automatically serves the SPA from `build/client` and the API from `api/`

The `vercel.json` rewrites ensure:
- `/api/*` → Vercel serverless functions in `api/`
- `/*` → `index.html` (SPA client-side routing)

---

## Docker

A multi-stage Dockerfile is included for containerized deployments.

```bash
# Build
docker build -t ai-resume-analyzer .

# Run (pass your Groq key)
docker run -p 3000:3000 -e GROQ_API_KEY=your_key_here ai-resume-analyzer
```

> Note: The Docker image runs the production build (`npm run start`), not the serverless function. The `/api/analyze-resume` route needs to be adapted if running outside Vercel.

---

## Running Tests

Unit tests cover the deterministic scoring functions in `api/scoring.js`:

```bash
npm test          # run once
npm run test:watch # watch mode
```

Tests verify:
- Weight totals sum to 1.0
- Score clamping and rounding
- Match status → numeric value conversions
- Edge cases (empty arrays, invalid inputs, missing evidence guard)
