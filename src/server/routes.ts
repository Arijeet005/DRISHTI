import express from 'express';
import { calculateRiskPrediction, collapseToLegacyStage } from '../services/mlPredictor';
import { build18Features, FEATURE_EXPLANATION_MAP, Raw18ModelFeatures } from '../services/ml18FeatureAdapter';
import { ApprovalStage, PredictRequest, PredictResponse, RiskCategory } from '../types/project';
import {
  dbFindMany,
  dbFindById,
  dbCreate,
  dbUpdate,
  dbDelete,
  dbResetSeed,
} from './db';

export const apiRouter = express.Router();
export const mlRouter = express.Router();

export const STAGE_ORDER: ApprovalStage[] = [
  'Drafting',
  'PreliminaryNotification',
  'ObjectionsHearing',
  'DeclarationVesting',
  'AwardAnnounced',
  'PossessionTaken',
];

function getRequestRole(req: express.Request): string {
  const customHeader = req.headers['x-user-role'];
  if (typeof customHeader === 'string') return customHeader;
  const clerkRole = (req as any).auth?.sessionClaims?.metadata?.role;
  if (clerkRole) return clerkRole;
  return 'Admin';
}

/**
 * Unified Prediction Executor:
 * 1. Derives the 18-feature vector required by models/pipeline_with_preprocessor.pkl.
 * 2. Attempts inference via the FastAPI service (http://127.0.0.1:8000/predict or ML_SERVICE_URL).
 * 3. Falls back smoothly to the calibrated engine if the Python service is offline.
 */
export async function executePrediction(input: any): Promise<PredictResponse & { raw18Features: Raw18ModelFeatures }> {
  const features18 = build18Features(input);
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'https://dristi-model.onrender.com/predict';

  try {
    const res = await fetch(mlServiceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features18),
      signal: AbortSignal.timeout(8000), // generous timeout for cloud hosted microservice
    });

    if (res.ok) {
      const data = await res.json();
      const prob = Number(data.risk_probability) || 0;
      const score = Math.min(100, Math.max(0, Math.round(prob * 100)));
      const category = (data.delay_risk_level as RiskCategory) || (score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low');
      const topFactors = Array.isArray(data.top_risk_factors) ? data.top_risk_factors : [];

      const factors = topFactors.map((f: any) => {
        if (typeof f === 'object' && f !== null) {
          return {
            factor: f.display_name || f.feature?.replace(/^numeric__|^cat__/, '').replace(/_/g, ' ') || 'Attribution Factor',
            impact: Math.round((Math.abs(f.contribution) || prob) * 100),
            description: f.description || 'Model-attributed contribution from SHAP analysis',
            severity: category === 'High' ? ('high' as const) : ('medium' as const),
            direction: f.direction,
          };
        }
        const meta = FEATURE_EXPLANATION_MAP[f] || {
          label: String(f).replace(/_/g, ' ').toUpperCase(),
          description: 'Model SHAP attribution factor from pipeline bundle',
        };
        return {
          factor: meta.label,
          impact: Math.round(prob * 20),
          description: meta.description,
          severity: category === 'High' ? ('high' as const) : ('medium' as const),
        };
      });

      return {
        riskScore: score,
        riskCategory: category,
        legacyMappedStage: collapseToLegacyStage(input.approvalStage || 'PreliminaryNotification'),
        factors,
        top_risk_factors: topFactors.map((item: any) => (typeof item === 'object' ? item.display_name || item.feature : String(item))),
        model_version: data.model_version || '1.0.0',
        raw18Features: features18,
        source: `Live Render Service (${mlServiceUrl})`,
      };
    } else {
      console.warn(`[ML Service] ${mlServiceUrl} returned status ${res.status}: ${await res.text()}`);
    }
  } catch (err: any) {
    console.warn(`[ML Service] Error calling ${mlServiceUrl}, using calibrated fallback:`, err?.message || err);
  }

  // Fallback to calibrated procedural predictor
  const calibrated = calculateRiskPrediction({
    landAreaHectares: features18.land_area_hectares,
    familiesAffected: features18.affected_families_count,
    compensationStatus: input.compensationStatus || 'Pending',
    approvalStage: input.approvalStage || 'PreliminaryNotification',
    legalDisputeFlag: Boolean(input.legalDisputeFlag || features18.stay_order_present || features18.active_litigations_count > 0),
    daysSinceLastUpdate: Number(input.daysSinceLastUpdate) || 30,
    underArbitration: Boolean(input.underArbitration),
  });

  return {
    riskScore: calibrated.riskScore,
    riskCategory: calibrated.riskCategory,
    legacyMappedStage: calibrated.legacyMappedStage,
    factors: calibrated.factors,
    top_risk_factors: ['active_litigations_count', 'compensation_disbursed_pct', 'forest_land_pct'],
    model_version: 'calibrated-fallback-v1',
    raw18Features: features18,
    source: 'calibrated-engine',
  };
}

// GET /api/projects - List all projects
apiRouter.get('/projects', async (req, res) => {
  try {
    const projects = await dbFindMany();
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve projects', details: err?.message });
  }
});

// GET /api/projects/:id - Get single project
apiRouter.get('/projects/:id', async (req, res) => {
  try {
    const project = await dbFindById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve project', details: err?.message });
  }
});

// POST /api/projects - Create project -> triggers 18-feature model prediction
apiRouter.post('/projects', async (req, res) => {
  const role = getRequestRole(req);
  if (role === 'Viewer') {
    return res.status(403).json({ error: 'Forbidden: Viewer role has read-only access.' });
  }

  const {
    name,
    state,
    district,
    landAreaHectares,
    familiesAffected,
    compensationStatus,
    approvalStage,
    legalDisputeFlag,
    daysSinceLastUpdate,
    createdByClerkId,
    underArbitration,
    arbitrationRaisedAt,
    preliminaryNotificationAt,
    objectionsDeadlineAt,
    possessionNoticeAt,
    possessionDueAt,
  } = req.body;

  if (!name || !state || !district) {
    return res.status(400).json({ error: 'Name, state, and district are required.' });
  }

  const validStage: ApprovalStage = STAGE_ORDER.includes(approvalStage)
    ? approvalStage
    : 'Drafting';

  // Section 3G(5) Arbitration constraint
  const isArbRequested = Boolean(underArbitration);
  const stageIndex = STAGE_ORDER.indexOf(validStage);
  const awardIndex = STAGE_ORDER.indexOf('AwardAnnounced');

  if (isArbRequested && stageIndex < awardIndex) {
    return res.status(400).json({
      error: 'Section 3G(5) arbitration is only admissible once compensation award has been announced (Stage 5 AwardAnnounced onward).',
    });
  }

  // Execute prediction via 18-feature pipeline (or calibrated fallback)
  const prediction = await executePrediction({
    ...req.body,
    name,
    state,
    district,
    landAreaHectares: Number(landAreaHectares) || 0,
    familiesAffected: Number(familiesAffected) || 0,
    compensationStatus: compensationStatus || 'Pending',
    approvalStage: validStage,
    legalDisputeFlag: Boolean(legalDisputeFlag),
    daysSinceLastUpdate: Number(daysSinceLastUpdate) || 0,
    underArbitration: isArbRequested,
  });

  try {
    const newProject = await dbCreate({
      name: String(name).trim(),
      state: String(state).trim(),
      district: String(district).trim(),
      landAreaHectares: Number(landAreaHectares) || 0,
      familiesAffected: Number(familiesAffected) || 0,
      compensationStatus: compensationStatus || 'Pending',
      approvalStage: validStage,
      legalDisputeFlag: Boolean(legalDisputeFlag),
      daysSinceLastUpdate: Number(daysSinceLastUpdate) || 0,
      createdByClerkId: createdByClerkId || 'user_clerk_admin_01',
      riskScore: prediction.riskScore,
      riskCategory: prediction.riskCategory,
      underArbitration: isArbRequested,
      arbitrationRaisedAt: isArbRequested ? (arbitrationRaisedAt || new Date().toISOString()) : null,
      preliminaryNotificationAt: preliminaryNotificationAt || null,
      objectionsDeadlineAt: objectionsDeadlineAt || null,
      possessionNoticeAt: possessionNoticeAt || null,
      possessionDueAt: possessionDueAt || null,
    });

    res.status(201).json(newProject);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create project', details: err?.message });
  }
});

// PUT /api/projects/:id - Update project with strict sequential stage transition enforcement
apiRouter.put('/projects/:id', async (req, res) => {
  const role = getRequestRole(req);
  if (role === 'Viewer') {
    return res.status(403).json({ error: 'Forbidden: Viewer role has read-only access.' });
  }

  const existing = await dbFindById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Strict Stage-Transition Enforcement
  const requestedStage: ApprovalStage | undefined = req.body.approvalStage;
  if (requestedStage && requestedStage !== existing.approvalStage) {
    const oldIndex = STAGE_ORDER.indexOf(existing.approvalStage);
    const newIndex = STAGE_ORDER.indexOf(requestedStage);

    if (newIndex === -1) {
      return res.status(400).json({ error: `Invalid approvalStage '${requestedStage}'. Valid stages: ${STAGE_ORDER.join(', ')}` });
    }

    // Only allow sequential 1-step advancement unless user has Admin role
    const isSequentialAdvance = newIndex === oldIndex + 1;
    if (!isSequentialAdvance && role !== 'Admin') {
      return res.status(400).json({
        error: `Strict statutory workflow violation: Cannot transition from '${existing.approvalStage}' to '${requestedStage}'. Statutory process must advance sequentially: ${STAGE_ORDER.join(' → ')}. Admin role required to override.`,
        currentStage: existing.approvalStage,
        expectedNextStage: oldIndex + 1 < STAGE_ORDER.length ? STAGE_ORDER[oldIndex + 1] : null,
      });
    }
  }

  const targetStage = requestedStage || existing.approvalStage;
  const isArbRequested = req.body.underArbitration !== undefined
    ? Boolean(req.body.underArbitration)
    : existing.underArbitration;

  const targetIndex = STAGE_ORDER.indexOf(targetStage);
  const awardIndex = STAGE_ORDER.indexOf('AwardAnnounced');

  if (isArbRequested && targetIndex < awardIndex) {
    return res.status(400).json({
      error: 'Section 3G(5) arbitration dispute can only be active from Stage 5 (AwardAnnounced) onward.',
    });
  }

  const updatedData = { ...existing, ...req.body, approvalStage: targetStage, underArbitration: isArbRequested };

  // Re-run inference with 18-feature pipeline
  const prediction = await executePrediction(updatedData);

  try {
    const updated = await dbUpdate(req.params.id, {
      ...req.body,
      approvalStage: targetStage,
      underArbitration: isArbRequested,
      arbitrationRaisedAt: isArbRequested
        ? (existing.arbitrationRaisedAt || new Date().toISOString())
        : null,
      riskScore: prediction.riskScore,
      riskCategory: prediction.riskCategory,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update project', details: err?.message });
  }
});

// PATCH /api/projects/:id/arbitration - Dedicated endpoint for Stage 7 Parallel Arbitration Flag
apiRouter.patch('/projects/:id/arbitration', async (req, res) => {
  const role = getRequestRole(req);
  if (role === 'Viewer') {
    return res.status(403).json({ error: 'Forbidden: Viewer role has read-only access.' });
  }

  const existing = await dbFindById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const stageIndex = STAGE_ORDER.indexOf(existing.approvalStage);
  const awardIndex = STAGE_ORDER.indexOf('AwardAnnounced');

  const { underArbitration } = req.body;
  const newArbState = Boolean(underArbitration);

  if (newArbState && stageIndex < awardIndex) {
    return res.status(400).json({
      error: 'Arbitration under Section 3G(5) is only admissible from AwardAnnounced onward. The current stage is ' + existing.approvalStage,
    });
  }

  // Re-run inference
  const prediction = await executePrediction({
    ...existing,
    underArbitration: newArbState,
  });

  try {
    const updated = await dbUpdate(req.params.id, {
      underArbitration: newArbState,
      arbitrationRaisedAt: newArbState
        ? (existing.arbitrationRaisedAt || new Date().toISOString())
        : null,
      riskScore: prediction.riskScore,
      riskCategory: prediction.riskCategory,
    });

    res.json({
      message: newArbState
        ? 'Project flagged under Section 3G(5) Arbitration (physical possession progression remains unblocked).'
        : 'Project arbitration flag cleared.',
      project: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update arbitration status', details: err?.message });
  }
});

// DELETE /api/projects/:id - Delete project (Role: Admin)
apiRouter.delete('/projects/:id', async (req, res) => {
  const role = getRequestRole(req);
  if (role !== 'Admin') {
    return res.status(403).json({ error: 'Forbidden: Admin role required to delete project records.' });
  }

  try {
    const deleted = await dbDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete project', details: err?.message });
  }
});

// POST /api/seed - Reset database to sample dataset
apiRouter.post('/seed', async (req, res) => {
  try {
    const refreshed = await dbResetSeed();
    res.json({ message: 'Seeded successfully', count: refreshed.length, projects: refreshed });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset seed', details: err?.message });
  }
});

// POST /ml/predict - Direct ML Service Endpoint (accepts 18 raw features or high-level project parameters)
mlRouter.post('/predict', async (req, res) => {
  try {
    const prediction = await executePrediction(req.body);
    res.json(prediction);
  } catch (err: any) {
    res.status(500).json({ error: 'Prediction failed', details: err?.message });
  }
});
