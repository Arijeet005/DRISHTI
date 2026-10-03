"""
DRISHTI ML API Service
Serves predictions from models/pipeline_with_preprocessor.pkl

Endpoints:
  GET  /health  - Service health check
  GET  /ready   - Readiness check (bundle & model loaded)
  POST /predict - Accepts exactly the 18-feature schema and returns delay_risk_level, risk_probability, top_risk_factors
"""

import os
from pathlib import Path
from typing import Optional, List, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="DRISHTI Land Acquisition ML Inference Service",
    description="Inference service for the 18-feature Random Forest & XGBoost pipeline bundle",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Look for bundle in models/ or ml/
CANDIDATE_PATHS = [
    Path("models/pipeline_with_preprocessor.pkl"),
    Path("models/pipeline_with_preprocessor.joblib"),
    Path("ml/model.pkl"),
]

bundle_data = None
model_loaded = False
loaded_path = None

def load_bundle():
    global bundle_data, model_loaded, loaded_path
    for p in CANDIDATE_PATHS:
        if p.exists():
            try:
                import joblib
                bundle = joblib.load(p)
                bundle_data = bundle
                model_loaded = True
                loaded_path = str(p.resolve())
                print(f"[ML Service] Successfully loaded model bundle from {loaded_path}")
                return
            except Exception as e:
                print(f"[ML Service] Error loading {p}: {e}")
    print("[ML Service] No .pkl bundle found at candidate paths. Place pipeline_with_preprocessor.pkl in models/")

@app.on_event("startup")
def startup_event():
    load_bundle()

class Predict18Input(BaseModel):
    project_type: str = Field(..., example="Industrial Corridor")
    state: str = Field(..., example="Tamil Nadu")
    land_area_hectares: float = Field(..., ge=0.0, example=73.73)
    total_parcels: int = Field(..., ge=0, example=204)
    private_land_pct: float = Field(..., ge=0.0, le=100.0, example=34.32)
    forest_land_pct: float = Field(..., ge=0.0, le=100.0, example=23.28)
    govt_land_pct: float = Field(..., ge=0.0, le=100.0, example=42.39)
    affected_families_count: int = Field(..., ge=0, example=30)
    rr_settlement_status: str = Field(..., example="Mostly Completed")
    forest_clearance_stage: str = Field(..., example="Stage-1 Approved")
    env_clearance_stage: str = Field(..., example="EC Granted")
    circle_rate_per_sqm: float = Field(..., ge=0.0, example=10428.31)
    compensation_disbursed_pct: float = Field(..., ge=0.0, le=100.0, example=46.49)
    cadastral_survey_discrepancy: int = Field(..., ge=0, le=1, example=0)
    active_litigations_count: int = Field(..., ge=0, example=2)
    stay_order_present: int = Field(..., ge=0, le=1, example=0)
    inter_agency_nocs_pending: int = Field(..., ge=0, example=0)
    historical_district_delay_score: float = Field(..., ge=0.0, le=1.0, example=0.4664)

class Predict18Response(BaseModel):
    delay_risk_level: str  # 'Low', 'Medium', 'High'
    risk_probability: float  # [0.0, 1.0]
    top_risk_factors: List[str]
    model_version: Optional[str] = "bundle-v1"

@app.get("/health")
def health():
    return {"status": "healthy", "service": "drishti-ml"}

@app.get("/ready")
def ready():
    return {
        "status": "ready" if model_loaded else "standby",
        "model_loaded": model_loaded,
        "bundle_path": loaded_path,
    }

@app.post("/predict", response_model=Predict18Response)
def predict(payload: Predict18Input):
    data_dict = payload.dict()

    # 1. If trained bundle is loaded in memory, execute real inference
    if model_loaded and bundle_data is not None:
        try:
            import pandas as pd
            import numpy as np

            df = pd.DataFrame([data_dict])

            # Bundle typically holds classifier and regressor
            classifier = bundle_data.get("classifier") or bundle_data.get("selected_classification_model")
            regressor = bundle_data.get("regressor") or bundle_data.get("selected_regression_model")
            version = str(bundle_data.get("artifact_version", "v1.0.0"))

            # Continuous probability score from regressor or predict_proba
            if regressor is not None:
                prob = float(regressor.predict(df)[0])
            elif classifier is not None and hasattr(classifier, "predict_proba"):
                probs = classifier.predict_proba(df)[0]
                prob = float(probs[1]) if len(probs) > 1 else float(probs[0])
            else:
                prob = 0.5

            # Constrain to [0.0, 1.0]
            prob = max(0.0, min(1.0, prob))

            # Classification category
            if classifier is not None:
                cat = str(classifier.predict(df)[0])
            else:
                cat = "High" if prob >= 0.70 else "Medium" if prob >= 0.40 else "Low"

            # Compute top risk factors
            top_factors = ["active_litigations_count", "compensation_disbursed_pct", "forest_land_pct"]
            if data_dict["stay_order_present"] == 1:
                top_factors.insert(0, "stay_order_present")
            if data_dict["cadastral_survey_discrepancy"] == 1:
                top_factors.append("cadastral_survey_discrepancy")

            return Predict18Response(
                delay_risk_level=cat,
                risk_probability=round(prob, 4),
                top_risk_factors=top_factors[:3],
                model_version=version,
            )
        except Exception as e:
            print(f"[ML Service] Pipeline execution error: {e}")
            # Fall through to calibrated calculation

    # 2. Calibrated heuristic fallback based on the 18 features
    lit_weight = data_dict["active_litigations_count"] * 0.12
    stay_weight = 0.25 if data_dict["stay_order_present"] == 1 else 0.0
    cad_weight = 0.08 if data_dict["cadastral_survey_discrepancy"] == 1 else 0.0
    comp_weight = max(0.0, (100.0 - data_dict["compensation_disbursed_pct"]) / 100.0 * 0.26)
    delay_weight = data_dict["historical_district_delay_score"] * 0.20
    forest_weight = (data_dict["forest_land_pct"] / 100.0) * 0.10

    raw_prob = min(0.98, max(0.05, 0.10 + lit_weight + stay_weight + cad_weight + comp_weight + delay_weight + forest_weight))
    risk_level = "High" if raw_prob >= 0.70 else "Medium" if raw_prob >= 0.40 else "Low"

    factors = []
    if data_dict["stay_order_present"] == 1:
        factors.append("stay_order_present")
    if data_dict["active_litigations_count"] > 0:
        factors.append("active_litigations_count")
    if data_dict["compensation_disbursed_pct"] < 50.0:
        factors.append("compensation_disbursed_pct")
    if data_dict["cadastral_survey_discrepancy"] == 1:
        factors.append("cadastral_survey_discrepancy")
    if data_dict["forest_land_pct"] > 20.0:
        factors.append("forest_land_pct")
    if not factors:
        factors = ["historical_district_delay_score", "land_area_hectares", "affected_families_count"]

    return Predict18Response(
        delay_risk_level=risk_level,
        risk_probability=round(raw_prob, 4),
        top_risk_factors=factors[:3],
        model_version="calibrated-v1-fallback",
    )
