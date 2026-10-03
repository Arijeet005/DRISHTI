import express from 'express';
import { calculateRiskPrediction } from '../services/mlPredictor';
import { ApprovalStage, PredictRequest } from '../types/project';
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

// POST /api/projects - Create project -> triggers ML prediction (Roles: Admin, Officer)
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

  // ML Risk Prediction
  const prediction = calculateRiskPrediction({
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

  // Re-run ML Prediction with mapping layer and arbitration weight
  const prediction = calculateRiskPrediction({
    landAreaHectares: Number(updatedData.landAreaHectares) || 0,
    familiesAffected: Number(updatedData.familiesAffected) || 0,
    compensationStatus: updatedData.compensationStatus,
    approvalStage: targetStage,
    legalDisputeFlag: Boolean(updatedData.legalDisputeFlag),
    daysSinceLastUpdate: Number(updatedData.daysSinceLastUpdate) || 0,
    underArbitration: isArbRequested,
  });

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
// Completely independent from stage order check; does NOT block PossessionTaken
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

  // Re-run ML Prediction
  const prediction = calculateRiskPrediction({
    landAreaHectares: existing.landAreaHectares,
    familiesAffected: existing.familiesAffected,
    compensationStatus: existing.compensationStatus,
    approvalStage: existing.approvalStage,
    legalDisputeFlag: existing.legalDisputeFlag,
    daysSinceLastUpdate: existing.daysSinceLastUpdate,
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

// POST /ml/predict - Direct ML Service Endpoint
mlRouter.post('/predict', async (req, res) => {
  const {
    landAreaHectares,
    familiesAffected,
    compensationStatus,
    approvalStage,
    legalDisputeFlag,
    daysSinceLastUpdate,
    underArbitration,
  } = req.body as PredictRequest;

  // If an external ML microservice URL is configured (e.g. FastAPI serving model.pkl)
  const externalMlUrl = process.env.ML_SERVICE_URL;
  if (externalMlUrl) {
    try {
      const response = await fetch(externalMlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      if (response.ok) {
        const customPred = await response.json();
        return res.json(customPred);
      }
    } catch (err) {
      console.warn('[ML Bridge] External ML service unreachable, falling back to built-in calibrated model:', err);
    }
  }

  const result = calculateRiskPrediction({
    landAreaHectares: Number(landAreaHectares) || 0,
    familiesAffected: Number(familiesAffected) || 0,
    compensationStatus: compensationStatus || 'Pending',
    approvalStage: approvalStage || 'Drafting',
    legalDisputeFlag: Boolean(legalDisputeFlag),
    daysSinceLastUpdate: Number(daysSinceLastUpdate) || 0,
    underArbitration: Boolean(underArbitration),
  });

  res.json({
    riskScore: result.riskScore,
    riskCategory: result.riskCategory,
    legacyMappedStage: result.legacyMappedStage,
    factors: result.factors,
  });
});
