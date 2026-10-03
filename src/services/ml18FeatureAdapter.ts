/**
 * 18-Feature Translation Bridge for the DRISHTI Machine Learning Service.
 * Bridges application domain data to the fitted pipeline artifact:
 * models/pipeline_with_preprocessor.pkl
 */

export interface Raw18ModelFeatures {
  project_type: string;
  state: string;
  land_area_hectares: number;
  total_parcels: number;
  private_land_pct: number;
  forest_land_pct: number;
  govt_land_pct: number;
  affected_families_count: number;
  rr_settlement_status: string;
  forest_clearance_stage: string;
  env_clearance_stage: string;
  circle_rate_per_sqm: number;
  compensation_disbursed_pct: number;
  cadastral_survey_discrepancy: number; // 0 or 1
  active_litigations_count: number;
  stay_order_present: number;           // 0 or 1
  inter_agency_nocs_pending: number;
  historical_district_delay_score: number; // 0.0 to 1.0
}

export interface Model18ApiResponse {
  delay_risk_level: 'Low' | 'Medium' | 'High';
  risk_probability: number; // [0.0, 1.0]
  top_risk_factors?: (string | { factor: string; impact?: number; description?: string })[];
  model_version?: string;
}

/**
 * Infer a plausible project_type from project name or category
 */
function inferProjectType(name?: string): string {
  if (!name) return 'Infrastructure Corridor';
  const lower = name.toLowerCase();
  if (lower.includes('highway') || lower.includes('expressway') || lower.includes('road')) return 'National Highway';
  if (lower.includes('metro') || lower.includes('rail')) return 'Metro Rail';
  if (lower.includes('canal') || lower.includes('irrigation') || lower.includes('dam')) return 'Irrigation Project';
  if (lower.includes('port') || lower.includes('harbor')) return 'Port Expansion';
  if (lower.includes('airport') || lower.includes('runway')) return 'Airport Expansion';
  if (lower.includes('energy') || lower.includes('solar') || lower.includes('wind')) return 'Renewable Energy';
  if (lower.includes('industrial') || lower.includes('corridor')) return 'Industrial Corridor';
  return 'Industrial Corridor';
}

/**
 * Derives the exact 18-feature vector required by the trained model pipeline.
 */
export function build18Features(input: any): Raw18ModelFeatures {
  const area = Number(input.land_area_hectares ?? input.landAreaHectares ?? 50);
  const families = Number(input.affected_families_count ?? input.familiesAffected ?? 80);
  const state = String(input.state || 'Maharashtra').trim();
  const stage = String(input.approvalStage || 'PreliminaryNotification');
  const compStatus = String(input.compensationStatus || 'Pending');
  const hasDispute = Boolean(input.legalDisputeFlag || input.active_litigations_count > 0 || input.stay_order_present);
  const isArb = Boolean(input.underArbitration);
  const daysDormant = Number(input.daysSinceLastUpdate ?? 30);

  // 1. Project Type
  const projectType = input.project_type || inferProjectType(input.name);

  // 2. Total parcels (normative ~1.5 - 2.5 parcels per hectare in Indian land revenue records)
  const totalParcels = Number(input.total_parcels) > 0
    ? Number(input.total_parcels)
    : Math.max(5, Math.round(area * 1.8));

  // 3. Land ownership percentages (must sum to ~100)
  const privatePct = input.private_land_pct !== undefined ? Number(input.private_land_pct) : 65.0;
  const forestPct = input.forest_land_pct !== undefined ? Number(input.forest_land_pct) : 15.0;
  const govtPct = input.govt_land_pct !== undefined ? Number(input.govt_land_pct) : Math.max(0, 100 - privatePct - forestPct);

  // 4. Resettlement & Rehabilitation (R&R) Status
  let rrStatus = input.rr_settlement_status;
  if (!rrStatus) {
    if (stage === 'PossessionTaken' || compStatus === 'Paid') {
      rrStatus = 'Completed';
    } else if (stage === 'AwardAnnounced' || compStatus === 'PartiallyPaid') {
      rrStatus = 'Mostly Completed';
    } else if (stage === 'ObjectionsHearing' || stage === 'DeclarationVesting') {
      rrStatus = 'In Progress';
    } else {
      rrStatus = 'Pending';
    }
  }

  // 5. Environmental & Forest Clearance Stages
  let forestStage = input.forest_clearance_stage;
  if (!forestStage) {
    if (forestPct === 0) {
      forestStage = 'Exempted';
    } else if (stage === 'PossessionTaken' || stage === 'AwardAnnounced') {
      forestStage = 'Stage-2 Approved';
    } else if (stage === 'DeclarationVesting' || stage === 'ObjectionsHearing') {
      forestStage = 'Stage-1 Approved';
    } else {
      forestStage = 'In-Principle Applied';
    }
  }

  let envStage = input.env_clearance_stage;
  if (!envStage) {
    if (stage === 'PossessionTaken' || stage === 'AwardAnnounced' || stage === 'DeclarationVesting') {
      envStage = 'EC Granted';
    } else if (stage === 'ObjectionsHearing') {
      envStage = 'EIA In Progress';
    } else {
      envStage = 'ToR Issued';
    }
  }

  // 6. Circle rate per square meter (INR)
  const circleRate = Number(input.circle_rate_per_sqm) > 0 ? Number(input.circle_rate_per_sqm) : 8500.0;

  // 7. Compensation Disbursed %
  let compPct = input.compensation_disbursed_pct !== undefined ? Number(input.compensation_disbursed_pct) : undefined;
  if (compPct === undefined) {
    if (compStatus === 'Paid') compPct = 100.0;
    else if (compStatus === 'PartiallyPaid') compPct = 48.5;
    else compPct = 0.0;
  }

  // 8. Legal and Cadastral Litigations
  const cadastralDiscrepancy = input.cadastral_survey_discrepancy !== undefined
    ? Number(input.cadastral_survey_discrepancy)
    : (hasDispute ? 1 : 0);

  const activeLitigations = input.active_litigations_count !== undefined
    ? Number(input.active_litigations_count)
    : (hasDispute ? (isArb ? 3 : 1) : (isArb ? 1 : 0));

  const stayOrder = input.stay_order_present !== undefined
    ? Number(input.stay_order_present)
    : (hasDispute && !isArb ? 1 : 0);

  // 9. Inter-agency NOCs
  const interAgencyNocs = input.inter_agency_nocs_pending !== undefined
    ? Number(input.inter_agency_nocs_pending)
    : (daysDormant > 120 ? 3 : daysDormant > 60 ? 1 : 0);

  // 10. Historical District Delay Score [0.0, 1.0]
  const districtDelayScore = input.historical_district_delay_score !== undefined
    ? Math.min(1.0, Math.max(0.0, Number(input.historical_district_delay_score)))
    : Math.min(0.95, Math.max(0.12, Math.round(((daysDormant / 200) + 0.15) * 1000) / 1000));

  return {
    project_type: projectType,
    state,
    land_area_hectares: Math.round(area * 100) / 100,
    total_parcels: totalParcels,
    private_land_pct: Math.round(privatePct * 100) / 100,
    forest_land_pct: Math.round(forestPct * 100) / 100,
    govt_land_pct: Math.round(govtPct * 100) / 100,
    affected_families_count: families,
    rr_settlement_status: rrStatus,
    forest_clearance_stage: forestStage,
    env_clearance_stage: envStage,
    circle_rate_per_sqm: Math.round(circleRate * 100) / 100,
    compensation_disbursed_pct: Math.round(compPct * 100) / 100,
    cadastral_survey_discrepancy: cadastralDiscrepancy ? 1 : 0,
    active_litigations_count: activeLitigations,
    stay_order_present: stayOrder ? 1 : 0,
    inter_agency_nocs_pending: interAgencyNocs,
    historical_district_delay_score: districtDelayScore,
  };
}

/**
 * Human-readable explanations for the 18 model features when returned by SHAP
 */
export const FEATURE_EXPLANATION_MAP: Record<string, { label: string; description: string }> = {
  active_litigations_count: {
    label: 'Active Court Litigations',
    description: 'Number of pending writ petitions and civil title suits',
  },
  stay_order_present: {
    label: 'High Court Stay Order',
    description: 'Active judicial injunction halting physical possession or award disbursement',
  },
  compensation_disbursed_pct: {
    label: 'Compensation Disbursement Rate',
    description: 'Percentage of financial compensation deposited with CALA and disbursed to khatedars',
  },
  forest_land_pct: {
    label: 'Forest Land Proportion',
    description: 'Portion of alignment passing through reserved or protected forest requiring MoEFCC Stage-2 clearance',
  },
  cadastral_survey_discrepancy: {
    label: 'Cadastral Survey Discrepancy',
    description: 'Discrepancy between revenue village maps and ground DGPS joint measurement survey',
  },
  inter_agency_nocs_pending: {
    label: 'Inter-Agency Clearance Delay',
    description: 'Pending NOCs from Railways, Defence, State PWD, or State Irrigation Departments',
  },
  historical_district_delay_score: {
    label: 'District Procedural Latency Index',
    description: 'Empirical CALA office processing velocity index for this revenue district',
  },
  affected_families_count: {
    label: 'Resettlement Magnitude',
    description: 'Scale of project-affected families requiring R&R compliance and alternative residential plots',
  },
  land_area_hectares: {
    label: 'Scale of Land Acquisition',
    description: 'Expansive physical footprint demanding extensive multi-village demarcation',
  },
  rr_settlement_status: {
    label: 'R&R Package Progress',
    description: 'Execution stage of Rehabilitation & Resettlement awards under Second Schedule of RFCTLARR',
  },
  forest_clearance_stage: {
    label: 'Forest Clearance Progression',
    description: 'Formal regulatory status under Forest (Conservation) Act, 1980',
  },
  env_clearance_stage: {
    label: 'Environmental Clearance (EC) Stage',
    description: 'EIA notification compliance and public consultation status',
  },
  circle_rate_per_sqm: {
    label: 'Circle Rate Basis',
    description: 'Base valuation reference per square meter determining market value multiplier',
  },
  total_parcels: {
    label: 'Parcel Count Density',
    description: 'High parcel fragmentation increases title verification and dispute overhead',
  },
  private_land_pct: {
    label: 'Private Ownership Ratio',
    description: 'High private ownership ratio increases individual notice service and CALA hearing volume',
  },
  govt_land_pct: {
    label: 'Government Land Share',
    description: 'Inter-departmental land transfer latency for state and central government parcels',
  },
  project_type: {
    label: 'Infrastructure Typology',
    description: 'Linear infrastructure corridors face continuous boundary resistance across jurisdictions',
  },
  state: {
    label: 'State Statutory Ruleset',
    description: 'State-specific RFCTLARR rules and multiplier coefficients applied to market value',
  },
};
