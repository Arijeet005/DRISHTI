# DRISHTI (दृष्टि)
### Data-driven Risk Intelligence System for Timely Intervention

An enterprise-grade land acquisition risk management and statutory lifecycle tracking platform designed for Indian infrastructure projects governed by the **RFCTLARR Act, 2013** and the **National Highways Act, 1956**.

---

## 🌐 Live URLs

- **Deployed ML Inference Service**: [https://dristi-model.onrender.com/](https://dristi-model.onrender.com/)
- **Interactive OpenAPI Documentation**: [https://dristi-model.onrender.com/docs](https://dristi-model.onrender.com/docs)

---

## 🏛️ Statutory 7-Stage Legal Framework

DRISHTI enforces statutory compliance and procedural gating across all phases of land acquisition:

| Stage # | Stage Key | Statutory Authority | Legal Milestones & Requirements |
|---|---|---|---|
| **Stage 1** | `Drafting` | Sec. 4, RFCTLARR | Feasibility assessment, SIA (Social Impact Assessment) preparation |
| **Stage 2** | `PreliminaryNotification` | Sec. 11 / Sec. 3A | Gazette notification published; 21-day objection clock initiates |
| **Stage 3** | `ObjectionsHearing` | Sec. 15 / Sec. 3C | CALA hearing of khatedar objections, valuation grievances |
| **Stage 4** | `DeclarationVesting` | Sec. 19 / Sec. 3D | Formal declaration; land vests absolutely in the State free from encumbrances |
| **Stage 5** | `AwardAnnounced` | Sec. 23 / Sec. 3G | Competent authority determines compensation matrix and solatium |
| **Stage 6** | `PossessionTaken` | Sec. 38 / Sec. 3E | 60-day notice period completed; physical possession surrendered |
| **Stage 7** | `underArbitration` | Sec. 3G(5) NH Act | **Parallel Non-Blocking Dispute Track**: Khatedars contest compensation quantum before Central Arbitrator without halting physical possession |

---

## 🧠 Machine Learning Risk Intelligence

The platform integrates a machine learning pipeline bundled into `models/pipeline_with_preprocessor.pkl` and hosted live at Render.

### Model Architecture
- **Classifier**: `RandomForestClassifier` predicting categorical delay risk (`Low`, `Medium`, `High`).
- **Regressor**: `XGBRegressor` wrapped by `ClippedRegressor` calculating continuous `risk_probability` score in range `[0.0, 1.0]`.
- **Explainability**: SHAP (SHapley Additive exPlanations) generating model-attributed feature contributions for each prediction.

### 18-Feature Input Contract
The ML model expects these 18 raw features:

```json
{
  "project_type": "Industrial Corridor",
  "state": "Tamil Nadu",
  "land_area_hectares": 73.73,
  "total_parcels": 204,
  "private_land_pct": 34.32,
  "forest_land_pct": 23.28,
  "govt_land_pct": 42.39,
  "affected_families_count": 30,
  "rr_settlement_status": "Mostly Completed",
  "forest_clearance_stage": "Stage-1 Approved",
  "env_clearance_stage": "EC Granted",
  "circle_rate_per_sqm": 10428.31,
  "compensation_disbursed_pct": 46.49,
  "cadastral_survey_discrepancy": 0,
  "active_litigations_count": 2,
  "stay_order_present": 0,
  "inter_agency_nocs_pending": 0,
  "historical_district_delay_score": 0.4664
}
```

### Automatic 18-Feature Translation Bridge
The application bridges standard project records (`landAreaHectares`, `compensationStatus`, `approvalStage`, `legalDisputeFlag`, etc.) into this 18-feature vector, allowing prediction without manual data entry.

---

## 🔒 Role-Based Access Control (RBAC)

DRISHTI supports granular role-based permissions (integrated with Clerk authentication):

- **Admin**: Full administrative permissions — create, edit, delete projects, and override stage sequencing when authorized.
- **Officer**: High-level authority — advance projects through statutory stages and manage arbitration proceedings.
- **Clerk**: Operational authority — update project records, record compensation disbursement, and input cadastral surveys.
- **Viewer**: Read-only stakeholder access across all portfolios and risk dashboards.

---

## 📁 Repository Structure

```text
├── api/                     # Python FastAPI inference server (matching pipeline artifact)
│   └── main.py              # GET /health, GET /ready, POST /predict
├── models/                  # ML model artifact storage
│   └── pipeline_with_preprocessor.pkl # Trained bundle (RF + XGBoost + SHAP)
├── src/
│   ├── components/          # React components
│   │   ├── DashboardView.tsx    # Executive risk intelligence overview
│   │   ├── ProjectListView.tsx  # Project portfolio with filters & search
│   │   ├── ProjectDetailModal.tsx # Full statutory record & Stage 7 dispute tracking
│   │   ├── ProjectFormModal.tsx # Create & edit project records
│   │   ├── MlSimulatorView.tsx  # Interactive 18-feature inference test bench
│   │   ├── StageStepper.tsx     # Sequential RFCTLARR stage progress component
│   │   └── RiskBadge.tsx        # Earthy risk badges (Low, Medium, High)
│   ├── server/              # Express backend server
│   │   ├── routes.ts        # /api/projects, /api/seed, /ml/predict proxy
│   │   └── db.ts            # Supabase PostgreSQL + in-memory store
│   ├── services/
│   │   ├── ml18FeatureAdapter.ts # 18-feature derivation & SHAP translation bridge
│   │   ├── mlPredictor.ts        # Procedural fallback prediction engine
│   │   └── supabase.ts           # Supabase client initialization
│   ├── types/               # TypeScript interfaces & types
│   │   └── project.ts       # Project, ApprovalStage, PredictRequest/Response
│   └── App.tsx              # Main UI routing and navigation layout
├── index.html               # Main HTML entry point
├── package.json             # Node dependencies and build scripts
└── vite.config.ts           # Vite + Tailwind + Express API plugin configuration
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (refer to `.env.example`):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
DATABASE_URL="postgresql://postgres:password@your-db.supabase.co:5432/postgres"

# Machine Learning Inference Service (Live Render URL)
ML_SERVICE_URL="https://dristi-model.onrender.com/predict"
```

---

## 💻 Local Development Setup

### 1. Frontend & Node API

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Run TypeScript type check
npm run lint

# Build for production
npm run build
```

### 2. Local Python ML Service (Optional)

If you wish to run the model server locally instead of using the Render service:

```bash
# Install Python dependencies
pip install fastapi uvicorn scikit-learn xgboost joblib pandas numpy shap

# Start FastAPI server on port 8000
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Set `ML_SERVICE_URL="http://127.0.0.1:8000/predict"` in your `.env` to route predictions locally.

---

## 📡 API Endpoints

### Application API (`/api`)
- `GET /api/projects` - List all land acquisition projects
- `GET /api/projects/:id` - Retrieve a single project
- `POST /api/projects` - Create a new project (triggers automated ML prediction)
- `PUT /api/projects/:id` - Update project details & advance stages sequentially
- `PATCH /api/projects/:id/arbitration` - Toggle Section 3G(5) Arbitration flag
- `DELETE /api/projects/:id` - Remove project record (Admin only)
- `POST /api/seed` - Reset database to reference benchmark dataset

### Machine Learning API (`/ml`)
- `POST /ml/predict` - Accepts statutory parameters or exact 18-feature JSON schema; returns predicted delay risk level, continuous risk score, and top SHAP attributions.
