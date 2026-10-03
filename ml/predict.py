"""
Standalone inference CLI script for model.pkl.

Usage:
    python ml/predict.py --area 120 --families 340 --compensation Pending --stage PreliminaryNotification --dispute --days 95
"""

import os
import sys
import argparse
import json

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

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

def main():
    parser = argparse.ArgumentParser(description="Run inference using model.pkl")
    parser.add_argument("--area", type=float, default=50.0, help="Land area in hectares")
    parser.add_argument("--families", type=int, default=100, help="Project affected families")
    parser.add_argument("--compensation", type=str, default="Pending", choices=["Pending", "PartiallyPaid", "Paid"])
    parser.add_argument("--stage", type=str, default="PreliminaryNotification", help="Statutory approval stage")
    parser.add_argument("--dispute", action="store_true", help="Active litigation flag")
    parser.add_argument("--arbitration", action="store_true", help="Sec. 3G(5) arbitration flag")
    parser.add_argument("--days", type=int, default=30, help="Days since last update")
    parser.add_argument("--model", type=str, default=MODEL_PATH, help="Path to .pkl model")

    args = parser.parse_args()

    if not os.path.exists(args.model):
        print(f"Error: Model file '{args.model}' not found.")
        print(f"Please place your trained model at: {args.model}")
        sys.exit(1)

    try:
        import joblib
        import pandas as pd
    except ImportError:
        print("Required packages: joblib, pandas, scikit-learn. Install with: pip install joblib pandas scikit-learn")
        sys.exit(1)

    model = joblib.load(args.model)
    mapped_stage = collapse_stage(args.stage)

    df = pd.DataFrame([{
        "landAreaHectares": args.area,
        "familiesAffected": args.families,
        "compensationStatus": args.compensation,
        "approvalStage": mapped_stage,
        "legalDisputeFlag": args.dispute,
        "daysSinceLastUpdate": args.days,
        "underArbitration": args.arbitration,
    }])

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(df)[0]
        score = round(float(probs[1] * 100), 1) if len(probs) > 1 else round(float(probs[0] * 100), 1)
    else:
        score = float(model.predict(df)[0])
        if score <= 1.0:
            score = round(score * 100, 1)

    category = "High" if score >= 70 else "Medium" if score >= 40 else "Low"

    print(json.dumps({
        "riskScore": score,
        "riskCategory": category,
        "legacyMappedStage": mapped_stage,
        "inputs": df.to_dict(orient="records")[0]
    }, indent=2))

if __name__ == "__main__":
    main()
