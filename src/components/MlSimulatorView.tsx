import React, { useState } from 'react';
import { ApprovalStage, CompensationStatus, PredictResponse, PredictRequest } from '../types/project';
import { api } from '../services/api';
import { RiskBadge } from './RiskBadge';
import { LEGAL_STAGES } from './StageStepper';
import { Send, Terminal, Copy, CheckCircle2, Scale, Info } from 'lucide-react';

export const MlSimulatorView: React.FC = () => {
  const [landAreaHectares, setLandAreaHectares] = useState<number>(120);
  const [familiesAffected, setFamiliesAffected] = useState<number>(340);
  const [compensationStatus, setCompensationStatus] = useState<CompensationStatus>('Pending');
  const [approvalStage, setApprovalStage] = useState<ApprovalStage>('PreliminaryNotification');
  const [legalDisputeFlag, setLegalDisputeFlag] = useState<boolean>(true);
  const [daysSinceLastUpdate, setDaysSinceLastUpdate] = useState<number>(95);
  const [underArbitration, setUnderArbitration] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const currentStageIndex = LEGAL_STAGES.findIndex((s) => s.key === approvalStage);
  const awardIndex = LEGAL_STAGES.findIndex((s) => s.key === 'AwardAnnounced');
  const isArbitrationAdmissible = currentStageIndex >= awardIndex;

  const handlePredict = async () => {
    setIsLoading(true);
    try {
      const payload: PredictRequest = {
        landAreaHectares: Number(landAreaHectares),
        familiesAffected: Number(familiesAffected),
        compensationStatus,
        approvalStage,
        legalDisputeFlag,
        daysSinceLastUpdate: Number(daysSinceLastUpdate),
        underArbitration: isArbitrationAdmissible ? underArbitration : false,
      };
      const res = await api.predictRisk(payload);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const jsonPayload = JSON.stringify(
    {
      landAreaHectares: Number(landAreaHectares),
      familiesAffected: Number(familiesAffected),
      compensationStatus,
      approvalStage,
      legalDisputeFlag,
      daysSinceLastUpdate: Number(daysSinceLastUpdate),
      underArbitration: isArbitrationAdmissible ? underArbitration : false,
    },
    null,
    2
  );

  const curlExample = `curl -X POST http://localhost:3000/ml/predict \\
  -H "Content-Type: application/json" \\
  -d '${jsonPayload.replace(/\n/g, ' ')}'`;

  const copyCurl = () => {
    navigator.clipboard.writeText(curlExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3.5">
      {/* Header Banner */}
      <div className="bg-[#4F5B2A] text-[#F5EFE3] border-2 border-[#4F5B2A] p-3 sm:p-3.5 shadow-[4px_4px_0px_0px_#B8892D] relative">
        <div className="absolute top-0 right-0 flex">
          <div className="w-5 h-5 bg-[#B8892D]" />
          <div className="w-5 h-5 bg-[#D8C9A8]" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#F5EFE3]">
          ML Prediction Test Bench
        </h2>
      </div>

      {/* 2-Column Interface: Inputs on Left, API Response on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Column: Interactive Inputs (6 cols) */}
        <div className="lg:col-span-6 bg-[#F5EFE3] border-2 border-[#4F5B2A] p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#4F5B2A] space-y-3">
          <div className="border-b-2 border-[#4F5B2A] pb-2 flex items-center justify-between">
            <h3 className="text-lg font-black uppercase text-[#4F5B2A]">
              Parameters
            </h3>
            <span className="text-[10px] font-bold uppercase bg-[#D8C9A8] px-1.5 py-0.2 border border-[#4F5B2A]">
              6 Legal Stages + Sec. 3G(5)
            </span>
          </div>

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
              <label className="block text-[11px] font-bold uppercase mb-0.5 text-[#4F5B2A]">Families Affected</label>
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
                    ? 'Dispute with Arbitrator over award quantum (+16 risk pts). Does not delay possession.'
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
                <span className="text-[11px] font-bold uppercase text-[#4F5B2A]">Legal Dispute</span>
              </label>
            </div>
          </div>

          <div className="pt-2 border-t-2 border-[#4F5B2A]">
            <button
              onClick={handlePredict}
              disabled={isLoading}
              className="w-full py-2 bg-[#B8892D] text-[#F5EFE3] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:brightness-105 flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isLoading ? 'INVOKING MODEL...' : 'Execute POST /ml/predict'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: JSON Output & Curl (6 cols) */}
        <div className="lg:col-span-6 space-y-3">
          {/* Prediction Result Box */}
          <div className="bg-[#4F5B2A] text-[#F5EFE3] border-2 border-[#4F5B2A] p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#4F5B2A]">
            <div className="flex items-center justify-between border-b border-[#F5EFE3]/30 pb-2 mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#B8892D]">
                Prediction Result
              </span>
              <div className="flex items-center gap-2">
                {result && <RiskBadge category={result.riskCategory} score={result.riskScore} size="md" />}
              </div>
            </div>

            {result ? (
              <div className="space-y-2">
                <div className="p-2.5 bg-[#2D3518] border border-[#B8892D]/40 font-mono text-[11px]">
                  <pre className="text-[#D8C9A8] overflow-x-auto">
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

          {/* cURL Request Snippet */}
          <div className="bg-[#F5EFE3] border-2 border-[#4F5B2A] p-3 shadow-[3px_3px_0px_0px_#4F5B2A]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-black uppercase text-[#4F5B2A] flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                <span>cURL Request Contract</span>
              </span>
              <button
                onClick={copyCurl}
                className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#D8C9A8] text-[#4F5B2A] border border-[#4F5B2A] flex items-center gap-1 hover:brightness-105"
              >
                {copied ? <CheckCircle2 className="w-2.5 h-2.5 text-[#4F5B2A]" /> : <Copy className="w-2.5 h-2.5" />}
                <span>{copied ? 'COPIED' : 'COPY CURL'}</span>
              </button>
            </div>
            <pre className="p-2 bg-[#2D3518] text-[#D8C9A8] font-mono text-[10px] overflow-x-auto border border-[#4F5B2A]">
              {curlExample}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
