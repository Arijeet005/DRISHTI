"""
DRISHTI ML Microservice
Loads model.pkl and serves predictions via FastAPI / Flask.

Usage:
    pip install fastapi uvicorn scikit-learn joblib pandas numpy
    uvicorn ml.app:app --host 0.0.0.0 --port 8000
"""

import os
import joblib
import numpy as np
import pandas as pd
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="DRISHTI Land Acquisition ML Predictor", version="1.0.0")

# Model path: Place your trained .pkl file here
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

model = None

@app.on_event("startup")
def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print(f"[ML Service] Successfully loaded trained model from {MODEL_PATH}")
        except Exception as e:
            print(f"[ML Service] Error loading model from {MODEL_PATH}: {e}")
    else:
        print(f"[ML Service] Warning: {MODEL_PATH} not found. Place your trained model.pkl in the ml/ folder.")

class PredictRequest(BaseModel):
    landAreaHectares: float
    familiesAffected: int
    compensationStatus: str  # 'Pending', 'PartiallyPaid', 'Paid'
    approvalStage: str       # 'Drafting', 'PreliminaryNotification', 'ObjectionsHearing', 'DeclarationVesting', 'AwardAnnounced', 'PossessionTaken'
    legalDisputeFlag: bool
    daysSinceLastUpdate: int
    underArbitration: Optional[bool] = False

# Mapping layer: collapses 6 granular statutory stages to legacy 4 features if trained on (Draft, Notified, Awarded, Possessed)
def collapse_stage(stage: str) -> str:
    mapping = {
        "Drafting": "Draft",
        "PreliminaryNotification": "Notified",
        "ObjectionsHearing": "Notified",
        "DeclarationVesting": "Awarded",
        "AwardAnnounced": "Awarded",
        "PossessionTaken": "Possessed",
    }
    return mapping.get(stage, "Draft")

@app.get("/")
def health_check():
    return {
        "status": "online",
        "model_loaded": model is not None,
        "model_path": MODEL_PATH,
    }

@app.post("/predict")
def predict(req: PredictRequest):
    mapped_stage = collapse_stage(req.approvalStage)

    # 1. If your model.pkl is loaded, run inference
    if model is not None:
        try:
            # Build DataFrame matching your trained feature names:
            input_df = pd.DataFrame([{
                "landAreaHectares": req.landAreaHectares,
                "familiesAffected": req.familiesAffected,
                "compensationStatus": req.compensationStatus,
                "approvalStage": mapped_stage,
                "legalDisputeFlag": req.legalDisputeFlag,
                "daysSinceLastUpdate": req.daysSinceLastUpdate,
                "underArbitration": req.underArbitration or False,
            }])

            # If model supports predict_proba (classifier):
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(input_df)[0]
                # Assuming class 1 is delay/risk probability
                score = round(float(probs[1] * 100), 1) if len(probs) > 1 else round(float(probs[0] * 100), 1)
            else:
                pred = model.predict(input_df)[0]
                score = float(pred)
                # Normalize if on 0-1 scale
                if score <= 1.0:
                    score = round(score * 100, 1)

            # Categorize
            category = "High" if score >= 70 else "Medium" if score >= 40 else "Low"

            return {
                "riskScore": score,
                "riskCategory": category,
                "legacyMappedStage": mapped_stage,
                "source": "model.pkl",
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

    # 2. Fallback response if model.pkl is not yet provided
    return {
        "riskScore": 50.0,
        "riskCategory": "Medium",
        "legacyMappedStage": mapped_stage,
        "message": f"Place your model.pkl in {MODEL_PATH} to enable custom inference.",
    }
