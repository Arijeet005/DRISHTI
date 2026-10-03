import { ApprovalStage, PredictRequest, PredictResponse, RiskCategory } from '../types/project';

export interface RiskFactor {
  factor: string;
  impact: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface DetailedPrediction extends PredictResponse {
  factors: RiskFactor[];
  legacyMappedStage: 'Draft' | 'Notified' | 'Awarded' | 'Possessed';
}

/**
 * Mapping layer bridging the 6 strict legal stages to the legacy 4-value model features:
 * - Drafting -> Draft
 * - PreliminaryNotification, ObjectionsHearing -> Notified
 * - DeclarationVesting, AwardAnnounced -> Awarded
 * - PossessionTaken -> Possessed
 */
export function collapseToLegacyStage(stage: ApprovalStage): 'Draft' | 'Notified' | 'Awarded' | 'Possessed' {
  switch (stage) {
    case 'Drafting':
      return 'Draft';
    case 'PreliminaryNotification':
    case 'ObjectionsHearing':
      return 'Notified';
    case 'DeclarationVesting':
    case 'AwardAnnounced':
      return 'Awarded';
    case 'PossessionTaken':
      return 'Possessed';
    default:
      return 'Draft';
  }
}

/**
 * Calibrated ML Risk Scoring Model for Land Acquisition Projects.
 * Conforms to the input/output shape of the /ml/predict endpoint.
 */
export function calculateRiskPrediction(data: PredictRequest): DetailedPrediction {
  const {
    landAreaHectares,
    familiesAffected,
    compensationStatus,
    approvalStage,
    legalDisputeFlag,
    daysSinceLastUpdate,
    underArbitration,
  } = data;

  const legacyStage = collapseToLegacyStage(approvalStage);

  let score = 10; // Baseline administrative buffer
  const factors: RiskFactor[] = [
    {
      factor: 'Baseline Administrative Buffer',
      impact: 10,
      description: 'Minimum procedural latency buffer across state jurisdictions',
      severity: 'low',
    },
  ];

  // 1. Legal Dispute Impact (Court stays, title challenges)
  if (legalDisputeFlag) {
    const disputePoints = 30;
    score += disputePoints;
    factors.push({
      factor: 'Active Legal Dispute',
      impact: disputePoints,
      description: 'Court stay orders, land title challenges, or tribunal litigation pending',
      severity: 'high',
    });
  }

  // 2. Stage 7 Parallel Flag: Section 3G(5) Statutory Arbitration
  // (Does not block physical possession, but indicates contested compensation quantum)
  if (underArbitration) {
    const arbPoints = 16;
    score += arbPoints;
    factors.push({
      factor: 'Statutory Arbitration Active (Sec. 3G(5))',
      impact: arbPoints,
      description: 'Award compensation quantum challenged before Central Govt Arbitrator',
      severity: 'high',
    });
  }

  // 3. Compensation Status Impact
  if (compensationStatus === 'Pending') {
    const compPoints = 26;
    score += compPoints;
    factors.push({
      factor: 'Compensation Pending',
      impact: compPoints,
      description: 'Unpaid land parcel awards trigger social resistance and procedural injunctions',
      severity: 'high',
    });
  } else if (compensationStatus === 'PartiallyPaid') {
    const compPoints = 14;
    score += compPoints;
    factors.push({
      factor: 'Compensation Partially Paid',
      impact: compPoints,
      description: 'Partial disbursement carries residual friction during final award vesting',
      severity: 'medium',
    });
  } else {
    factors.push({
      factor: 'Compensation Fully Paid',
      impact: 0,
      description: 'Financial settlement completed without outstanding dues',
      severity: 'low',
    });
  }

  // 4. Days Since Last Update (Staleness / Inactivity Latency)
  if (daysSinceLastUpdate >= 180) {
    score += 18;
    factors.push({
      factor: 'Extreme File Stagnation (>180d)',
      impact: 18,
      description: `Last activity occurred ${daysSinceLastUpdate} days ago. Severe stall risk.`,
      severity: 'high',
    });
  } else if (daysSinceLastUpdate >= 100) {
    score += 12;
    factors.push({
      factor: 'Prolonged Dormancy (100–180d)',
      impact: 12,
      description: `Last activity occurred ${daysSinceLastUpdate} days ago. Significant backlog friction.`,
      severity: 'medium',
    });
  } else if (daysSinceLastUpdate >= 45) {
    score += 6;
    factors.push({
      factor: 'Moderate Processing Interval (45–100d)',
      impact: 6,
      description: `Last activity was ${daysSinceLastUpdate} days ago. Standard monitoring needed.`,
      severity: 'medium',
    });
  } else {
    factors.push({
      factor: 'Recent Administrative Progress (<=45d)',
      impact: 0,
      description: `Active progress recorded ${daysSinceLastUpdate} days ago.`,
      severity: 'low',
    });
  }

  // 5. Social Displacement & Scale Friction (Families Affected & Area)
  if (familiesAffected >= 400) {
    score += 8;
    factors.push({
      factor: 'Large-scale Resettlement Demand (>=400 Families)',
      impact: 8,
      description: `${familiesAffected} project-affected families require extensive R&R compliance`,
      severity: 'high',
    });
  } else if (familiesAffected >= 150) {
    score += 5;
    factors.push({
      factor: 'Moderate Resettlement Burden (150–400 Families)',
      impact: 5,
      description: `${familiesAffected} families affected across district boundaries`,
      severity: 'medium',
    });
  }

  if (landAreaHectares >= 150) {
    score += 6;
    factors.push({
      factor: 'Expansive Land Boundary (>=150 Hectares)',
      impact: 6,
      description: `${landAreaHectares} ha requires multi-village boundary demarcation and surveying`,
      severity: 'medium',
    });
  }

  // 6. Stage-Specific Statutory Friction and Mitigation
  if (approvalStage === 'Drafting' && daysSinceLastUpdate > 90) {
    score += 6;
    factors.push({
      factor: 'Pre-notification Delay (Stage 1)',
      impact: 6,
      description: 'CALA appointment or survey verification delayed past standard schedule',
      severity: 'medium',
    });
  } else if (approvalStage === 'ObjectionsHearing' && daysSinceLastUpdate > 21) {
    score += 8;
    factors.push({
      factor: 'Section 3C Hearing Backlog (Stage 3)',
      impact: 8,
      description: '21-day statutory objection period lapsed; CALA report still pending',
      severity: 'high',
    });
  } else if (approvalStage === 'DeclarationVesting') {
    score -= 4;
    factors.push({
      factor: 'Section 3D Land Vesting Absolute (Stage 4)',
      impact: -4,
      description: 'Title vests absolutely in Central Government free from all encumbrances',
      severity: 'low',
    });
  } else if (approvalStage === 'PossessionTaken' && compensationStatus === 'Paid' && !underArbitration) {
    score -= 12;
    factors.push({
      factor: 'Vested Possession Complete with Zero Dues (Stage 6)',
      impact: -12,
      description: 'Physical possession taken under Section 3E/3F; mutation completed',
      severity: 'low',
    });
  } else if (approvalStage === 'PossessionTaken') {
    score -= 6;
    factors.push({
      factor: 'Physical Possession Obtained (Stage 6)',
      impact: -6,
      description: 'Physical possession obtained on site under Section 3E/3F',
      severity: 'low',
    });
  }

  // Clamp score strictly between 0 and 100
  const finalScore = Math.max(1, Math.min(99, Math.round(score)));

  let riskCategory: RiskCategory = 'Low';
  if (finalScore >= 70) {
    riskCategory = 'High';
  } else if (finalScore >= 40) {
    riskCategory = 'Medium';
  } else {
    riskCategory = 'Low';
  }

  return {
    riskScore: finalScore,
    riskCategory,
    factors,
    legacyMappedStage: legacyStage,
  };
}
