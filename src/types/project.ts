export type CompensationStatus = 'Pending' | 'PartiallyPaid' | 'Paid';

// Strict Legal Stages 1 through 6 under National Highways Act, 1956 & RFCTLARR Act, 2013
export type ApprovalStage =
  | 'Drafting'                // Stage 1: Pre-notification (DPR/survey, CALA appointed Sec. 3(a))
  | 'PreliminaryNotification' // Stage 2: Sec. 3A / Sec. 11 (Gazette + 2 newspapers, market value frozen)
  | 'ObjectionsHearing'       // Stage 3: Sec. 3C / Sec. 15 (21-day window, CALA hearings)
  | 'DeclarationVesting'      // Stage 4: Sec. 3D / Sec. 19 (Land vests absolutely in Central Govt)
  | 'AwardAnnounced'          // Stage 5: Sec. 3G / Sec. 23 (CALA announces compensation award)
  | 'PossessionTaken';        // Stage 6: Sec. 3E / 3F (60-day notice served, physical possession taken)

export type RiskCategory = 'Low' | 'Medium' | 'High';
export type UserRole = 'Admin' | 'Officer' | 'Viewer';

export interface Project {
  id?: string;
  _id: string;
  name: string;
  state: string;
  district: string;
  landAreaHectares: number;
  familiesAffected: number;
  compensationStatus: CompensationStatus;
  approvalStage: ApprovalStage;
  legalDisputeFlag: boolean;
  daysSinceLastUpdate: number;
  createdAt: string;
  updatedAt: string;
  createdByClerkId: string;
  riskScore: number; // 0-100
  riskCategory: RiskCategory;

  // Stage 7: Independent Parallel Flag under Section 3G(5)
  // Explicitly does NOT block or delay physical possession
  underArbitration: boolean;
  arbitrationRaisedAt?: string | null;

  // Statutory Deadline Tracking
  preliminaryNotificationAt?: string | null; // Sec. 3A publication date
  objectionsDeadlineAt?: string | null;      // Sec. 3A + 21 days
  possessionNoticeAt?: string | null;        // Sec. 3E notice served
  possessionDueAt?: string | null;           // Sec. 3E + 60 days
}

export interface PredictRequest {
  landAreaHectares: number;
  familiesAffected: number;
  compensationStatus: CompensationStatus;
  approvalStage: ApprovalStage;
  legalDisputeFlag: boolean;
  daysSinceLastUpdate: number;
  underArbitration?: boolean;

  // Optional Granular 18-Feature Overrides (for models/pipeline_with_preprocessor.pkl)
  project_type?: string;
  state?: string;
  total_parcels?: number;
  private_land_pct?: number;
  forest_land_pct?: number;
  govt_land_pct?: number;
  rr_settlement_status?: string;
  forest_clearance_stage?: string;
  env_clearance_stage?: string;
  circle_rate_per_sqm?: number;
  compensation_disbursed_pct?: number;
  cadastral_survey_discrepancy?: number;
  active_litigations_count?: number;
  stay_order_present?: number;
  inter_agency_nocs_pending?: number;
  historical_district_delay_score?: number;
}

export interface PredictResponse {
  riskScore: number;
  riskCategory: RiskCategory;
  legacyMappedStage?: string;
  factors?: Array<{
    factor: string;
    impact: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  top_risk_factors?: string[];
  model_version?: string;
  raw18Features?: Record<string, any>;
  source?: string;
}

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  isSimulated?: boolean;
}
