# DRISHTI Machine Learning Model Integration

## 1. Where to Place Your `.pkl` File

Place your trained scikit-learn / XGBoost / LightGBM pipeline file here:
```
ml/model.pkl
```
*(Or in the project root as `model.pkl`)*

---

## 2. Input Features & Schema Expected

Your model receives these 7 statutory features:

| Feature Name | Type | Allowed Values / Range | Description |
|---|---|---|---|
| `landAreaHectares` | `float` | `> 0` | Total acquisition area in hectares |
| `familiesAffected` | `int` | `0 to 10000+` | Number of project-affected families (PAFs) |
| `compensationStatus` | `string` | `'Pending'`, `'PartiallyPaid'`, `'Paid'` | Financial disbursement status |
| `approvalStage` | `string` | `'Draft'`, `'Notified'`, `'Awarded'`, `'Possessed'` *(mapped)* | Legal acquisition stage |
| `legalDisputeFlag` | `boolean` | `true`, `false` | Active court litigation or stay orders |
| `daysSinceLastUpdate` | `int` | `0 to 365+` | Administrative dormancy / latency window |
| `underArbitration` | `boolean` | `true`, `false` | Section 3G(5) arbitration flag (parallel) |

> **Note on Statutory Stage Mapping:**
> If your model was trained on the 4 legacy stage names (`Draft`, `Notified`, `Awarded`, `Possessed`), the built-in bridge automatically maps:
> - `Drafting` &rarr; `Draft`
> - `PreliminaryNotification` & `ObjectionsHearing` &rarr; `Notified`
> - `DeclarationVesting` & `AwardAnnounced` &rarr; `Awarded`
> - `PossessionTaken` &rarr; `Possessed`

---

## 3. How to Connect Your Model to the App

### Method A: Run the Python Microservice (Recommended)
You can serve your `model.pkl` using FastAPI:

```bash
# 1. Install dependencies
pip install fastapi uvicorn scikit-learn joblib pandas numpy

# 2. Start the ML service
uvicorn ml.app:app --host 0.0.0.0 --port 8000
```

Then in `.env`, specify:
```env
ML_SERVICE_URL="http://localhost:8000/predict"
```
The Express backend proxy (`POST /ml/predict`) will forward all prediction requests directly to your Python server and use your `model.pkl` output!

---

### Method B: Built-in TypeScript Scorer
If no external Python service is running, the app automatically executes the calibrated procedural risk scoring engine in `src/services/mlPredictor.ts`.
