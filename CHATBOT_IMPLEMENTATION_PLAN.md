# DRISHTI AI Legal & Operations Assistant — Implementation Plan

> **Objective:** Add a citation-backed AI Chatbot (**DRISHTI Sahayak / Legal & Risk Assistant**) that answers citizen, landowner, CALA/revenue officer, and state-level administrator queries **first and foremost from the two official statutory PDFs** in this repository, backed by **server-side Gemini API (`@google/genai`)** synthesis and live **DRISHTI project/ML tools**.

---

## 1. Source Knowledge Base Inventory

The assistant's primary source of truth consists of the two official PDFs already stored in `public/assets/aistudio/`:

| Document ID | Workspace Path | Official Title | Core Statutory Coverage |
| :--- | :--- | :--- | :--- |
| `nh_manual_2018` | `public/assets/aistudio/manual-of-guidelines-on-la-for-nhs-under-nh-act-1956-10.12.2018_516ba278.pdf` | *A Manual of Guidelines on Land Acquisition for National Highways under The National Highways Act, 1956* (MoRTH, Dec 2018; 208 PDF pages) | **Ch. 1–6 & Annexures:** NH Act 1956 (Sec. 3A–3J), 21-day Sec. 3C objections, 1-yr Sec. 3D vesting lapse, 60-day Sec. 3E possession, 6-step compensation formula, State Multiplication Factors (Annexure 2.4), 2.5% State admin charge cap, non-applicability of Sec. 24 RFCTLARR to NH Act, standalone 12% u/s 30(3), Sec. 3G(5) Arbitrator appointment by Central Govt & 9% interest u/s 3H(5), R&R 2nd/3rd Schedule applicability to linear NH projects, Bhoomi Rashi & PFMS payment flow. |
| `rfctlarr_2013` | `public/assets/aistudio/la_act_4c26f0a0.pdf` | *The Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013* (Act No. 30 of 2013; 45 pages) | **Sec. 1–114 & Schedules 1–4:** Prior consent (80% private / 70% PPP, Sec. 2(2)), SIA & Expert Group appraisal (Sec. 4–9, 12-mo lapse u/s 14), Food Security multi-crop limits (Sec. 10), Sec. 11 Notification & 60-day Sec. 15 objections, Sec. 19 Declaration, Sec. 24–30 Awards & 100% Solatium, Sec. 31–42 R&R / Urgency (+75%) / SC-ST protections, Sec. 51–74 LARR Authority (9%/15% interest u/s 72), Sec. 101–102 (5-yr unutilised land return, 40% appreciation share), Sec. 105 & 4th Schedule (13 exempted Acts including NH Act 1956 at Sl. 7). |

---

## 2. Architecture Decision: Hybrid Local PDF Retrieval + Server-Side Gemini API

To satisfy *"answer based on the given files if possible, else use Gemini API"*, the architecture uses a **two-tier grounded pipeline**:

1. **Tier 1 — Local Document Knowledge Base & Deterministic Lookup (No External LLM Required for Indexing/Search)**
   - Pre-indexes both PDFs at build/prep time into section-aware, page-numbered JSON chunks (`data/legal_kb_chunks.json`) plus structured statutory lookup tables (`data/statutory_tables.json` for State Multiplication Factors, 6-step compensation calculation rules, and NH Act vs. RFCTLARR timeline comparisons).
   - Runs a fast **in-process hybrid retriever** (BM25 scoring + legal section/citation exact-match booster + statutory synonym expansion) on every query.
   - Supports an **Extractive Document Citation Mode** when `GEMINI_API_KEY` is unavailable or when a user explicitly selects *Document-Only Lookup*, returning verbatim cited PDF excerpts (`[Document, Section/Chapter, Page N]`) and deterministic table lookups—never hallucinated legal text.

2. **Tier 2 — Server-Side Gemini API (`gemini-4-hydrogen`) Synthesis + Live DRISHTI Portfolio Tools**
   - Injects the **top-K retrieved PDF passages** (with document ID, chapter/section, and PDF page number) into the prompt context for `ai.models.generateContent` via `@google/genai` (`>= 2.29.1`).
   - Exposes live DRISHTI backend capabilities via **Function Calling** (`get_portfolio_summary`, `list_projects`, `get_project_details`, `predict_project_risk`, `search_legal_documents`) so users can ask both:
     - *Legal/procedural questions:* *"How is the 12% additional amount under Section 30(3) calculated for NH projects, and is Section 24 of RFCTLARR applicable?"*
     - *Operational/portfolio questions:* *"Which projects currently in Stage 3 or higher have active litigation or Section 3G(5) arbitration, and what does the 2018 Manual say about possession under Section 3E?"*
   - Enforces **strict error propagation**: if Gemini API returns `400/403/429/503` or times out after retries, the Express endpoint returns a structured HTTP error + retrieved PDF citations separately so the UI can show an accurate diagnostic message (never silently faking an AI response).

### End-to-End Request Flow

```text
[User in DrishtiAssistant Drawer / ProjectDetailModal]
        │  POST /api/chat { message, history, activeProjectId?, mode: "hybrid" | "pdf_only" }
        ▼
[Express Router: src/server/routes.ts]
        │
        ├──► 1. Local PDF Retriever (src/server/legalRetriever.ts)
        │       ├─ Searches data/legal_kb_chunks.json (BM25 + Citation Regex Boost)
        │       ├─ Checks data/statutory_tables.json (State MF, 6-Step Calc, Timelines)
        │       └─ Returns Top 6-8 Chunks + Exact Page Citations
        │
        ├──► 2a. If mode === "pdf_only":
        │       └─ Return structured extractive excerpts + table matches + deep links (/assets/aistudio/...#page=N)
        │
        └──► 2b. If mode === "hybrid" (Default):
                └─ Server-Side Gemini Orchestrator (src/server/geminiChat.ts)
                   ├─ Model: "gemini-4-hydrogen" | ThinkingLevel.LOW | User-Agent: "aistudio-build"
                   ├─ Grounding Context: Top-K PDF chunks (explicitly tagged with doc, section, page)
                   ├─ Live Tools: dbFindMany, dbFindById, executePrediction (from src/server/db.ts & routes.ts)
                   └─ Response: { reply, citations: [...], toolsUsed: [...], model: "gemini-4-hydrogen" }
```

---

## 3. Target Files & Integration Points

| File | Action | Purpose |
| :--- | :--- | :--- |
| `package.json` | Update | Upgrade `@google/genai` from `^2.4.0` to `^3.6.1` (`>= 2.29.1` required for `gemini-4-hydrogen` and `ThinkingLevel`); add `pdf-parse` (and `@types/pdf-parse` as devDependency) for local PDF text extraction. |
| `scripts/ingestLegalPdfs.ts` | Create | One-time / reproducible CLI script (`npm run kb:ingest`) that parses both PDFs in `public/assets/aistudio/` page-by-page, chunks by Chapter/Section/Annexure with overlap, and writes `data/legal_kb_chunks.json`. |
| `data/legal_kb_chunks.json` | Generate | Pre-indexed, page-cited chunk store (~450–650 structured chunks across the 253 total PDF pages) ready for instant server startup with zero runtime PDF parsing latency. |
| `data/statutory_tables.json` | Create | Curated deterministic reference data extracted from the PDFs: Annexure 2.4 State Multiplication Factors (21 states/UTs), 6-step compensation formula, NH Act vs. RFCTLARR statutory deadline matrix, and Second Schedule NH applicability matrix. |
| `src/server/legalRetriever.ts` | Create | In-memory BM25 + legal-citation index (`3A`, `3C`, `3D`, `3E`, `3G(5)`, `3H(4)`, `Sec 24`, `Sec 30(3)`, `Sec 105`, `solatium`, `Bhoomi Rashi`) + extractive citation responder for deterministic PDF answers. |
| `src/server/geminiChat.ts` | Create | Server-side `@google/genai` client (`apiKey: process.env.GEMINI_API_KEY`, `User-Agent: aistudio-build`), `gemini-4-hydrogen` with `ThinkingLevel.LOW`, `30000ms` timeout + bounded exponential backoff on `503`, RAG prompt assembly, and function calling loop over live DRISHTI registry & ML predictor. |
| `src/server/routes.ts` | Modify | Mount `POST /api/chat` and `GET /api/kb/search` (for direct PDF citation lookup) onto `apiRouter`. |
| `src/services/api.ts` | Modify | Add `api.sendChatMessage(...)` and `api.searchLegalDocs(...)` client helpers (browser never imports `@google/genai`). |
| `src/components/DrishtiAssistant.tsx` | Create | Slide-over chatbot drawer matching DRISHTI's geometric palette (`#F5EFE3`, `#4F5B2A`, `#B8892D`, `#D8C9A8`, `#A8442E`), featuring mode toggle (`PDF + Gemini AI` vs `Local PDF Citations Only`), clickable PDF page links (`/assets/aistudio/<file>.pdf#page=N`), role-tailored starter prompts, and project context pills. |
| `src/components/Header.tsx` | Modify | Add `Sahayak AI` trigger button in top bar next to the RBAC Role Switcher. |
| `src/components/ProjectDetailModal.tsx` | Modify | Add `"Ask AI About This Project"` action button that opens `DrishtiAssistant` pre-seeded with the active project's `_id`, statutory stage, and risk score. |
| `src/App.tsx` | Modify | Manage `isAssistantOpen` and `assistantProjectContext` state and render `<DrishtiAssistant />`. |
| `.env.example` | Modify | Document `GEMINI_API_KEY=""` (server-side secret; never prefixed with `VITE_`). |

---

## 4. Phased Implementation Plan

### Phase 1: PDF Ingestion, Chunking & Deterministic Knowledge Tables
1. **Install ingestion & SDK dependencies:**
   - Upgrade `@google/genai` to `>= 2.29.1` (`^3.6.1`) and add `pdf-parse` + `@types/pdf-parse`.
2. **Write `scripts/ingestLegalPdfs.ts`:**
   - Parse each PDF page-by-page using a custom `pagerender` hook in `pdf-parse` so every character retains its exact **1-based PDF page number** (`#page=N`).
   - Normalize headers/footers (e.g., strip repeated Gazette headers or page-number lines) while preserving section headings (`CHAPTER-2`, `3A.`, `3G(5)`, `Section 24`, `FIRST SCHEDULE`, `Annexure 2.4`).
   - Split into semantic chunks (~900–1,200 characters with ~180-character overlap) that never split mid-table or mid-clause where avoidable.
   - Output `data/legal_kb_chunks.json` with schema:
     ```ts
     export interface LegalChunk {
       id: string;                 // e.g., "nh_manual_2018_p42_c2"
       docId: 'nh_manual_2018' | 'rfctlarr_2013';
       docTitle: string;
       pdfPublicPath: string;      // "/assets/aistudio/...pdf"
       pageNumber: number;         // 1-indexed PDF page for #page=N link
       chapterOrPart: string;      // e.g., "Chapter 3: Procedure for LA"
       sectionRefs: string[];      // e.g., ["3C", "3A(3)", "Section 15"]
       keywords: string[];
       text: string;
     }
     ```
3. **Create `data/statutory_tables.json`:**
   - Encode high-precision structured tables directly from the PDFs so numeric/statutory queries never suffer from OCR/chunk-boundary truncation:
     - **State Multiplication Factors (Annexure 2.4, MoRTH Manual):** Rural/urban multipliers and distance slabs for Andhra Pradesh, Assam, Bihar, Chhattisgarh, Gujarat, Haryana, Himachal Pradesh, Jharkhand, Karnataka, Kerala, Madhya Pradesh, Maharashtra, Odisha, Punjab, Rajasthan, Tamil Nadu, Telangana, Tripura, Uttar Pradesh, Uttarakhand, and West Bengal.
     - **6-Step NH Act Compensation Calculation Formula (Ch. 3, MoRTH Manual):** Step 1 Basic Market Value (Sec. 26) → Step 2 × Multiplication Factor → Step 3 + Assets/Trees/Structures (Sec. 29) → Step 4 + 100% Solatium (Sec. 30(1)) → Step 5 + Standalone 12% p.a. from Sec. 3A date to Award (Sec. 30(3)) → Step 6 Total Award.
     - **Statutory Timelines Matrix:** Sec. 3C (21 days from last newspaper pub.) vs. RFCTLARR Sec. 15 (60 days); Sec. 3D (1-year lapse excluding court stay); Sec. 3E (60-day surrender notice); Sec. 3G(5) Arbitrator (3-year Limitation Act + 1-year Sec. 29A Arbitration Act; Sec. 3H(5) 9% p.a. excess interest).
4. **Add NPM script:** `"kb:ingest": "tsx scripts/ingestLegalPdfs.ts"` in `package.json`.

---

### Phase 2: Hybrid Local Retriever & Extractive Document Engine (`src/server/legalRetriever.ts`)
1. **Lexical BM25 + Statutory Citation Booster:**
   - Precompute IDF weights across `data/legal_kb_chunks.json` once at module load.
   - Extract explicit legal section tokens from user queries via regex (e.g., `/\b3[A-J](?:\(\d+\))?\b/gi`, `/\bsec(?:tion)?\.?\s*\d+(?:\(\d+\))?\b/gi`, `/\bschedule\s*(?:1|2|3|4|first|second|third|fourth)\b/gi`).
   - Apply a strong score boost when a chunk's `sectionRefs` or `chapterOrPart` matches extracted citations, plus synonym expansion (e.g., `"solatium"` ↔ `"100%"` / `"Section 30"`, `"arbitration"` ↔ `"3G(5)"`, `"multiplication factor"` ↔ `"First Schedule"` / `"Annexure 2.4"`, `"Bhoomi Rashi"` ↔ `"PFMS"` / `"CALA"`).
   - Also match structured entries from `data/statutory_tables.json` (e.g., if the user mentions a state name + `"factor"` / `"multiplier"` / `"rural"` / `"compensation"`).
2. **Tier-1 Extractive Citation Mode (`buildLocalDocumentResponse`):**
   - Used when `mode === 'pdf_only'` (or as an explicit user-triggered fallback option if the user chooses offline search):
     - Ranks the top 4 chunks + any matching deterministic table row.
     - Formats a clean, structured Markdown answer quoting the exact statutory rules, timeline/formula values, and `[Document Title, Section, Page N]` badges.
   - Ensures **100% file-grounded answers** with zero external API calls when requested.

---

### Phase 3: Server-Side Gemini API & Live Portfolio Tools (`src/server/geminiChat.ts` & `src/server/routes.ts`)
1. **SDK & Client Initialization (following `gemini-api` guidelines):**
   - `import { GoogleGenAI, ThinkingLevel, Type, FunctionDeclaration } from '@google/genai';`
   - Instantiate strictly on the server with `apiKey: process.env.GEMINI_API_KEY` and `httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }`.
   - Use model `'gemini-4-hydrogen'` with `config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }` for low-latency conversational Q&A (do **not** set `thinkingBudget` or deprecated `temperature`/`topP` parameters).
2. **Reliability & Timeout Handling:**
   - Guard against missing `GEMINI_API_KEY` with an explicit `503` JSON error (`{ error: 'GEMINI_API_KEY is not configured on the server. Switch to Local PDF Search mode or configure the secret.' }`) — never silently fake an AI response.
   - Wrap `ai.models.generateContent` in a `30000ms` timeout and bounded retry loop (up to 2 retries with jittered exponential backoff `1000ms`, `2500ms`) specifically for transient `503 UNAVAILABLE` / network errors.
3. **Strict Grounding System Instruction:**
   - Instruct the model to:
     1. Prioritize the injected `[RETRIEVED STATUTORY CONTEXT]` chunks from `nh_manual_2018` and `rfctlarr_2013` and `statutory_tables.json`.
     2. Cite every statutory claim inline using `[NH Manual 2018, Ch./Sec., p.X]` or `[RFCTLARR Act 2013, Sec. X, p.Y]`.
     3. Never invent section numbers, compensation percentages, or state multiplication factors outside the retrieved context or tool outputs.
     4. Clearly distinguish **NH Act 1956 rules** (where Fourth Schedule Sec. 105 applies only Schedules 1–3 of RFCTLARR 2013, **not** Sec. 24) from **general RFCTLARR 2013 acquisitions** (e.g., 21-day Sec. 3C vs. 60-day Sec. 15 objections).
     5. Keep answers structured, concise, and actionable for citizens, CALAs, or administrators.
4. **Live DRISHTI Tool Declarations (`FunctionDeclaration`):**
   - `get_portfolio_summary`: Aggregates total projects, high/medium/low risk counts, total hectares, families affected, and active Sec. 3G(5) arbitrations via `dbFindMany()`.
   - `list_projects`: Filters registry projects by `state`, `district`, `riskCategory`, `approvalStage`, or `underArbitration`.
   - `get_project_details`: Fetches a specific project by ID/name via `dbFindById()` / search and returns statutory windows (`objectionsDeadlineAt`, `possessionDueAt`) + 18-feature risk attribution.
   - `predict_project_risk`: Invokes `executePrediction(...)` (live Render ML microservice with calibrated fallback) for *"what-if"* risk simulations inside chat.
   - `search_legal_documents`: Allows Gemini to run a targeted second-pass query against `legalRetriever.ts` if the user's follow-up touches a new legal topic during multi-turn tool execution.
5. **Express Endpoints (`src/server/routes.ts`):**
   - `POST /api/chat`: Validates request `{ message, history, activeProjectId?, mode? }`, runs Tier-1 retrieval, invokes either `buildLocalDocumentResponse` (`pdf_only`) or `runGeminiRagChat` (`hybrid`), and returns `{ reply, citations, toolsUsed, modeUsed, retrievedTables }`.
   - `GET /api/kb/search?q=...`: Lightweight endpoint for direct keyword/section lookup in the PDF knowledge base.

---

### Phase 4: Frontend Chatbot UI Integration (`DrishtiAssistant` & App Shell)
1. **Design Consistency:**
   - Match DRISHTI's crisp utilitarian geometric aesthetic (`#F5EFE3` warm parchment surface, `#4F5B2A` olive structural borders & primary headers, `#B8892D` ochre highlights, `#D8C9A8` sand panels, `#A8442E` terracotta risk/dispute badges, crisp `2px` borders and hard `4px` offset shadows—zero rounded pill slop).
2. **`src/components/DrishtiAssistant.tsx` (Slide-Over Drawer):**
   - **Header:** Shows `"DRISHTI Sahayak"`, active mode switcher (`PDF + Gemini AI` vs `Local PDF Citations Only`), and an optional active-project context chip when launched from a project row/modal.
   - **Starter Prompt Chips (Role-Aware):**
     - *Citizen / Landowner:* `"How is NH compensation & 12% u/s 30(3) calculated?"`, `"What is the deadline to file Sec. 3C objections?"`, `"Does Sec. 3G(5) arbitration stop land possession?"`
     - *CALA / Officer:* `"Show Maharashtra/Haryana rural Multiplication Factor"`, `"What are the 2.5% State admin charge rules?"`, `"Summarize Bhoomi Rashi & PFMS payment steps"`
     - *Admin / Review:* `"List all High-risk projects currently under litigation or arbitration"`
   - **Citation Chips Below Each Answer:**
     - Renders clickable source badges like `[NH Manual 2018 • p. 44]` or `[RFCTLARR Act 2013 • Sec. 26 • p. 15]` that open the local PDF directly to the cited page (`/assets/aistudio/manual-of-guidelines-on-la-for-nhs-under-nh-act-1956-10.12.2018_516ba278.pdf#page=44` or `/assets/aistudio/la_act_4c26f0a0.pdf#page=15`) in an inline modal viewer or link.
   - **Error Banner:** If `/api/chat` returns a Gemini upstream error (e.g., missing key or `503`), display the exact error plus a one-click `"Search Local PDFs Instead"` button that re-runs the query in `pdf_only` mode using Tier-1 retrieval.
3. **Wiring in `Header.tsx`, `ProjectDetailModal.tsx`, and `App.tsx`:**
   - `Header.tsx`: Add `"Ask Sahayak AI"` button (`id="nav-btn-assistant"`) in the header action cluster.
   - `ProjectDetailModal.tsx`: Add `"Ask Legal AI"` button in the modal footer that passes `project._id` into `DrishtiAssistant` so the model automatically has that project's stage, state, and dispute status in context.

---

### Phase 5: Environment, Verification & Golden Q&A Acceptance Matrix
1. **Environment & Capabilities Check:**
   - Verify `metadata.json` keeps `"MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"`.
   - Document `GEMINI_API_KEY=""` in `.env.example` (never expose via `VITE_` and never build UI inputs for API keys).
2. **Build & Type Verification:**
   - Run `npm run kb:ingest` to verify `data/legal_kb_chunks.json` builds cleanly from both PDFs.
   - Run `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`).
3. **Golden Q&A Verification Matrix (Must Pass Against Both PDFs):**

| # | Test Query | Expected Grounded Answer (Verified Against Source PDFs) | Mode(s) |
| :--- | :--- | :--- | :--- |
| 1 | *"What is the time limit to file objections under NH Act vs RFCTLARR Act?"* | **21 days** from date of publication u/s 3A(3) (counted from **last newspaper publication** per MoRTH Manual Ch. 3) under **Sec. 3C(1) NH Act**, vs. **60 days** under **Sec. 15(1) RFCTLARR Act 2013**. | Both |
| 2 | *"Does Section 24 of RFCTLARR 2013 apply to National Highway acquisitions?"* | **No.** Sec. 24 does **not** apply to NH Act 1956 acquisitions (RFCTLARR Sec. 105 & Removal of Difficulties Order 2015 extended only First, Second, and Third Schedules w.e.f. 01.01.2015; supported by AG Opinions & High Court/Manual Ch. 2). | Both |
| 3 | *"How is the 12% additional amount under Section 30(3) calculated?"* | Calculated at **12% p.a.** as a **standalone component on the basic market value** (from Sec. 3A notification date to award/possession date)—not compounded on top of Multiplication Factor or Solatium (MoRTH Manual Ch. 2 & Ch. 3, 6-Step Calculation). | Both |
| 4 | *"Who appoints the Arbitrator under Section 3G(5) and what interest applies on enhanced compensation?"* | Appointed solely by the **Central Government** (SC Civil Appeal 5250/2018, 16.05.2018); **9% p.a.** interest u/s 3H(5) applies on the **excess amount** awarded by the Arbitrator from possession date u/s 3D to deposit date (MoRTH Manual Ch. 2 & Ch. 4). | Both |
| 5 | *"Are Third Schedule infrastructure amenities or land-for-land required for NH linear projects?"* | **No** for typical linear NH projects where no mass community displacement occurs (Third Schedule amenities & Second Schedule land-for-land/fishing rights/urban developed land are marked *Not attracted* in MoRTH Manual Ch. 5). | Both |
| 6 | *"What happens if land acquired under RFCTLARR remains unutilised for 5 years?"* | Under **Sec. 101 RFCTLARR 2013**, unutilised land for 5 years from taking possession must be returned to the original owner(s)/legal heirs or the State Land Bank. | Both |
| 7 | *"Which active projects in DRISHTI have Section 3G(5) arbitration or high delay risk?"* | Calls `list_projects` / `get_portfolio_summary` tools, returns live registry counts/records, and notes that Sec. 3G(5) arbitration does **not** block physical possession u/s 3E/3F. | Hybrid |
