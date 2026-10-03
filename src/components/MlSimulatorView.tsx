import React, { useState } from 'react';
import { ApprovalStage, CompensationStatus, PredictRequest } from '../types/project';
import { api } from '../services/api';
import { RiskBadge } from './RiskBadge';
import { LEGAL_STAGES } from './StageStepper';
import { build18Features, Raw18ModelFeatures } from '../services/ml18FeatureAdapter';
import {
  Send,
  Terminal,
  Copy,
  CheckCircle2,
  Scale,
  Sliders,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const SAMPLE_18_README: Raw18ModelFeatures = {
  project_type: 'Industrial Corridor',
  state: 'Tamil Nadu',
  land_area_hectares: 73.73,
  total_parcels: 204,
  private_land_pct: 34.32,
  forest_land_pct: 23.28,
  govt_land_pct: 42.39,
  affected_families_count: 30,
  rr_settlement_status: 'Mostly Completed',
  forest_clearance_stage: 'Stage-1 Approved',
  env_clearance_stage: 'EC Granted',
  circle_rate_per_sqm: 10428.31,
  compensation_disbursed_pct: 46.49,
  cadastral_survey_discrepancy: 0,
  active_litigations_count: 2,
  stay_order_present: 0,
  inter_agency_nocs_pending: 0,
  historical_district_delay_score: 0.4664,
};

export const MlSimulatorView: React.FC = () => {
  const [mode, setMode] = useState<'standard' | 'raw18'>('standard');

  // Standard inputs
  const [landAreaHectares, setLandAreaHectares] = useState<number>(73.73);
  const [familiesAffected, setFamiliesAffected] = useState<number>(30);
  const [compensationStatus, setCompensationStatus] = useState<CompensationStatus>('PartiallyPaid');
  const [approvalStage, setApprovalStage] = useState<ApprovalStage>('AwardAnnounced');
  const [legalDisputeFlag, setLegalDisputeFlag] = useState<boolean>(true);
  const [daysSinceLastUpdate, setDaysSinceLastUpdate] = useState<number>(45);
  const [underArbitration, setUnderArbitration] = useState<boolean>(false);

  // Raw 18 inputs
  const [raw18, setRaw18] = useState<Raw18ModelFeatures>(SAMPLE_18_README);
  const [showRawOverrides, setShowRawOverrides] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const currentStageIndex = LEGAL_STAGES.findIndex((s) => s.key === approvalStage);
  const awardIndex = LEGAL_STAGES.findIndex((s) => s.key === 'AwardAnnounced');
  const isArbitrationAdmissible = currentStageIndex >= awardIndex;

  // Active 18-feature derivation
  const activeDerived18 = React.useMemo(() => {
    if (mode === 'raw18') return raw18;
    return build18Features({
      landAreaHectares,
      familiesAffected,
      compensationStatus,
      approvalStage,
      legalDisputeFlag,
      daysSinceLastUpdate,
      underArbitration,
    });
  }, [
    mode,
    raw18,
    landAreaHectares,
    familiesAffected,
    compensationStatus,
    approvalStage,
    legalDisputeFlag,
    daysSinceLastUpdate,
    underArbitration,
  ]);

  const handlePredict = async () => {
    setIsLoading(true);
    try {
      let payload: any;
      if (mode === 'raw18') {
        payload = { ...raw18 };
      } else {
        payload = {
          landAreaHectares: Number(landAreaHectares),
          familiesAffected: Number(familiesAffected),
          compensationStatus,
          approvalStage,
          legalDisputeFlag,
          daysSinceLastUpdate: Number(daysSinceLastUpdate),
          underArbitration: isArbitrationAdmissible ? underArbitration : false,
          ...(showRawOverrides ? raw18 : {}),
        };
      }
      const res = await api.predictRisk(payload);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReadmeSample = () => {
    setMode('raw18');
    setRaw18(SAMPLE_18_README);
  };

  const curlExample = `curl -X POST http://localhost:3000/ml/predict \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(activeDerived18, null, 2).replace(/\n/g, ' ')}'`;

  const copyCurl = () => {
    navigator.clipboard.writeText(curlExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3.5">
      {/* Header Banner */}
      <div className="bg-[#4F5B2A] text-[#F5EFE3] border-2 border-[#4F5B2A] p-3 sm:p-3.5 shadow-[4px_4px_0px_0px_#B8892D] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[10px] font-black uppercase px-1.5 py-0.2 bg-[#3B7A57] text-[#F5EFE3] border border-[#4F5B2A] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse inline-block" />
              LIVE RENDER ML API
            </span>
            <span className="text-[10px] font-mono text-[#F5EFE3]/80">
              dristi-model.onrender.com
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#F5EFE3] mt-0.5">
            Model Inference Test Bench
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === 'standard' ? 'raw18' : 'standard')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5EFE3] text-[#4F5B2A] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] hover:bg-[#D8C9A8]"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Mode: {mode === 'standard' ? 'Project' : '18 Raw Features'}</span>
          </button>

          <button
            onClick={loadReadmeSample}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B8892D] text-[#F5EFE3] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] hover:brightness-105"
            title="Load the exact 18-feature sample request from the README"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load README Sample</span>
          </button>
        </div>
      </div>

      {/* 2-Column Interface: Inputs on Left, API Response on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Column: Interactive Inputs (6 cols) */}
        <div className="lg:col-span-6 bg-[#F5EFE3] border-2 border-[#4F5B2A] p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#4F5B2A] space-y-3">
          <div className="border-b-2 border-[#4F5B2A] pb-2 flex items-center justify-between">
            <h3 className="text-base font-black uppercase text-[#4F5B2A] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#B8892D]" />
              <span>{mode === 'standard' ? 'Statutory Parameters' : 'Exact 18-Feature Vector'}</span>
            </h3>
            <span className="text-[10px] font-mono text-[#4F5B2A]/80 font-bold">
              18 Features Auto-Mapped
            </span>
          </div>

          {mode === 'standard' ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-0.5 text-[#4F5B2A]">Land Area (Ha)</label>
                  <input
                    type="number"
                    value={landAreaHectares}
                    onChange={(e) => setLandAreaHectares(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] font-bold text-xs text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-0.5 text-[#4F5B2A]">Affected Families</label>
                  <input
                    type="number"
                    value={familiesAffected}
                    onChange={(e) => setFamiliesAffected(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] font-bold text-xs text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-0.5 text-[#4F5B2A]">Compensation</label>
                  <select
                    value={compensationStatus}
                    onChange={(e) => setCompensationStatus(e.target.value as CompensationStatus)}
                    className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] font-bold text-xs text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
                  >
                    <option value="Pending">Pending</option>
                    <option value="PartiallyPaid">PartiallyPaid</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-0.5 text-[#4F5B2A]">Approval Stage</label>
                  <select
                    value={approvalStage}
                    onChange={(e) => setApprovalStage(e.target.value as ApprovalStage)}
                    className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] font-bold text-xs text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
                  >
                    {LEGAL_STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        Stage {s.stageNumber}: {s.label} ({s.citation})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stage 7: Under Arbitration Parallel Flag */}
              <div className="p-2 bg-[#D8C9A8]/40 border-2 border-[#4F5B2A]">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={underArbitration}
                    disabled={!isArbitrationAdmissible}
                    onChange={(e) => setUnderArbitration(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 border-2 border-[#4F5B2A] text-[#A8442E] disabled:opacity-40"
                  />
                  <div>
                    <span className="text-[11px] font-bold uppercase text-[#4F5B2A] flex items-center gap-1">
                      <Scale className="w-3 h-3 text-[#A8442E]" />
                      Stage 7: Under Arbitration (Sec. 3G(5))
                    </span>
                    <span className="text-[9px] text-[#4F5B2A]/70 block font-medium">
                      {isArbitrationAdmissible
                        ? 'Active dispute with Arbitrator over award quantum. Does not delay physical possession.'
                        : 'Admissible only from Stage 5 (Award Announced) onward.'}
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-0.5 text-[#4F5B2A]">Days Stagnant</label>
                  <input
                    type="number"
                    value={daysSinceLastUpdate}
                    onChange={(e) => setDaysSinceLastUpdate(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] font-bold text-xs text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-1.5 bg-[#D8C9A8]/30 border-2 border-[#4F5B2A] cursor-pointer hover:bg-[#D8C9A8]/60">
                    <input
                      type="checkbox"
                      checked={legalDisputeFlag}
                      onChange={(e) => setLegalDisputeFlag(e.target.checked)}
                      className="w-3.5 h-3.5 border-2 border-[#4F5B2A] text-[#A8442E]"
                    />
                    <span className="text-[11px] font-bold uppercase text-[#4F5B2A]">Court Dispute Active</span>
                  </label>
                </div>
              </div>
            </>
          ) : (
            /* Direct 18-Feature Editor */
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">Project Type</label>
                  <input
                    type="text"
                    value={raw18.project_type}
                    onChange={(e) => setRaw18({ ...raw18, project_type: e.target.value })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">State</label>
                  <input
                    type="text"
                    value={raw18.state}
                    onChange={(e) => setRaw18({ ...raw18, state: e.target.value })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">Land Area (Ha)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={raw18.land_area_hectares}
                    onChange={(e) => setRaw18({ ...raw18, land_area_hectares: Number(e.target.value) })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">Total Parcels</label>
                  <input
                    type="number"
                    value={raw18.total_parcels}
                    onChange={(e) => setRaw18({ ...raw18, total_parcels: Number(e.target.value) })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">Private Land %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={raw18.private_land_pct}
                    onChange={(e) => setRaw18({ ...raw18, private_land_pct: Number(e.target.value) })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">Forest Land %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={raw18.forest_land_pct}
                    onChange={(e) => setRaw18({ ...raw18, forest_land_pct: Number(e.target.value) })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">Affected Families</label>
                  <input
                    type="number"
                    value={raw18.affected_families_count}
                    onChange={(e) => setRaw18({ ...raw18, affected_families_count: Number(e.target.value) })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">R&R Status</label>
                  <select
                    value={raw18.rr_settlement_status}
                    onChange={(e) => setRaw18({ ...raw18, rr_settlement_status: e.target.value })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Mostly Completed">Mostly Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">Active Litigations</label>
                  <input
                    type="number"
                    value={raw18.active_litigations_count}
                    onChange={(e) => setRaw18({ ...raw18, active_litigations_count: Number(e.target.value) })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">Stay Order (0/1)</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    value={raw18.stay_order_present}
                    onChange={(e) => setRaw18({ ...raw18, stay_order_present: Number(e.target.value) })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">Comp. Disbursed %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={raw18.compensation_disbursed_pct}
                    onChange={(e) => setRaw18({ ...raw18, compensation_disbursed_pct: Number(e.target.value) })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#4F5B2A]">District Delay Score</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={raw18.historical_district_delay_score}
                    onChange={(e) => setRaw18({ ...raw18, historical_district_delay_score: Number(e.target.value) })}
                    className="w-full p-1 bg-[#F5EFE3] border border-[#4F5B2A] text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t-2 border-[#4F5B2A]">
            <button
              onClick={handlePredict}
              disabled={isLoading}
              className="w-full py-2 bg-[#B8892D] text-[#F5EFE3] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:brightness-105 flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isLoading ? 'INVOKING 18-FEATURE PIPELINE...' : 'Execute POST /ml/predict'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Output & 18 Features JSON (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          {/* Prediction Result Box */}
          <div className="bg-[#4F5B2A] text-[#F5EFE3] border-2 border-[#4F5B2A] p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#4F5B2A]">
            <div className="flex items-center justify-between border-b border-[#F5EFE3]/30 pb-2 mb-2.5">
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-[#B8892D] block">
                  Prediction Output
                </span>
                {result?.source && (
                  <span className="text-[9px] font-mono text-[#F5EFE3]/70">
                    Source: {result.source}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {result && <RiskBadge category={result.riskCategory} score={result.riskScore} size="md" />}
              </div>
            </div>

            {result ? (
              <div className="space-y-2">
                {/* SHAP Attributed Factors */}
                {result.factors && result.factors.length > 0 && (
                  <div className="space-y-1 mb-2">
                    <div className="text-[10px] font-black uppercase tracking-wider text-[#B8892D]">
                      Top SHAP Attributed Factors
                    </div>
                    {result.factors.map((f: any, idx: number) => (
                      <div key={idx} className="p-1.5 bg-[#2D3518] border border-[#B8892D]/40 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-black text-[#F5EFE3] uppercase text-[11px]">{f.factor}</div>
                          <div className="text-[10px] text-[#D8C9A8]/80">{f.description}</div>
                        </div>
                        <span className="px-1.5 py-0.2 bg-[#B8892D] text-[#4F5B2A] font-black text-[10px]">
                          SHAP #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-2.5 bg-[#2D3518] border border-[#B8892D]/40 font-mono text-[11px]">
                  <pre className="text-[#D8C9A8] overflow-x-auto max-h-[160px]">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-[#F5EFE3]/70 text-xs py-4 text-center uppercase font-bold">
                Run prediction to view response
              </div>
            )}
          </div>

          {/* cURL Request Snippet with 18 Features */}
          <div className="bg-[#F5EFE3] border-2 border-[#4F5B2A] p-3 shadow-[3px_3px_0px_0px_#4F5B2A]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black uppercase text-[#4F5B2A] flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                <span>18-Feature HTTP Payload (models/pipeline_with_preprocessor.pkl)</span>
              </span>
              <button
                onClick={copyCurl}
                className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#D8C9A8] text-[#4F5B2A] border border-[#4F5B2A] flex items-center gap-1 hover:brightness-105"
              >
                {copied ? <CheckCircle2 className="w-2.5 h-2.5 text-[#4F5B2A]" /> : <Copy className="w-2.5 h-2.5" />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
            <pre className="p-2 bg-[#2D3518] text-[#D8C9A8] font-mono text-[10px] overflow-x-auto max-h-[140px] border border-[#4F5B2A]">
              {JSON.stringify(activeDerived18, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
