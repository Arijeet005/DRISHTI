import React, { useState } from 'react';
import { Project } from '../types/project';
import { RiskBadge } from './RiskBadge';
import { StageStepper, LEGAL_STAGES } from './StageStepper';
import { calculateRiskPrediction } from '../services/mlPredictor';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  X,
  MapPin,
  Edit2,
  AlertOctagon,
  CheckCircle,
  Scale,
  Calendar,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface ProjectDetailModalProps {
  project: Project | null;
  onClose: () => void;
  onEdit: (project: Project) => void;
  onProjectUpdated?: (updated: Project) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  onClose,
  onEdit,
  onProjectUpdated,
}) => {
  const { role } = useAuth();
  const [isUpdatingArb, setIsUpdatingArb] = useState(false);
  const [arbError, setArbError] = useState<string | null>(null);

  if (!project) return null;

  const canEdit = role === 'Admin' || role === 'Officer';
  const stageIndex = LEGAL_STAGES.findIndex((s) => s.key === project.approvalStage);
  const awardIndex = LEGAL_STAGES.findIndex((s) => s.key === 'AwardAnnounced');
  const isArbitrationAdmissible = stageIndex >= awardIndex;

  // Compute breakdown factors for explainability (with mapping layer)
  const detailed = calculateRiskPrediction({
    landAreaHectares: project.landAreaHectares,
    familiesAffected: project.familiesAffected,
    compensationStatus: project.compensationStatus,
    approvalStage: project.approvalStage,
    legalDisputeFlag: project.legalDisputeFlag,
    daysSinceLastUpdate: project.daysSinceLastUpdate,
    underArbitration: project.underArbitration,
  });

  const handleToggleArbitration = async () => {
    if (!canEdit) return;
    setArbError(null);
    setIsUpdatingArb(true);
    try {
      const updated = await api.updateArbitration(project._id, !project.underArbitration);
      if (onProjectUpdated) {
        onProjectUpdated(updated);
      }
    } catch (err: any) {
      setArbError(err?.message || 'Failed to update arbitration state');
    } finally {
      setIsUpdatingArb(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#4F5B2A]/70 flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-none">
      <div
        id="project-detail-modal"
        className="bg-[#F5EFE3] border-2 border-[#4F5B2A] shadow-[8px_8px_0px_0px_#4F5B2A] w-full max-w-3xl my-4 relative"
      >
        {/* Geometric Corner Badge */}
        <div className="absolute -top-2.5 -right-2.5 flex gap-1 z-10">
          <div className="w-4 h-4 bg-[#B8892D] border border-[#4F5B2A]" />
          <div className="w-4 h-4 bg-[#D8C9A8] border border-[#4F5B2A]" />
        </div>

        {/* Modal Header */}
        <div className="bg-[#4F5B2A] text-[#F5EFE3] p-3 sm:p-3.5 border-b-2 border-[#4F5B2A] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.2 text-[9px] font-black uppercase bg-[#B8892D] text-[#F5EFE3] border border-[#4F5B2A]">
                ID: {project._id}
              </span>
              {project.underArbitration && (
                <span className="px-1.5 py-0.2 text-[9px] font-black uppercase bg-[#A8442E] text-[#F5EFE3] border border-[#4F5B2A] flex items-center gap-1">
                  <Scale className="w-2.5 h-2.5" />
                  SEC. 3G(5) ARBITRATION ACTIVE
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#F5EFE3] mt-0.5">
              {project.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-[#F5EFE3]/90 mt-0.5">
              <MapPin className="w-3 h-3 text-[#B8892D]" />
              <span>{project.district}, {project.state}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 bg-[#F5EFE3] text-[#4F5B2A] border border-[#4F5B2A] shadow-[1px_1px_0px_0px_#4F5B2A] hover:bg-[#D8C9A8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all ml-4"
            title="Close Modal"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-4 space-y-3 max-h-[78vh] overflow-y-auto">
          {/* Risk Overview Block */}
          <div className="p-3 border-2 border-[#4F5B2A] bg-[#D8C9A8]/40 shadow-[3px_3px_0px_0px_#4F5B2A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="mt-1 flex items-center gap-2.5 flex-wrap">
                <RiskBadge category={project.riskCategory} score={project.riskScore} size="md" />
                <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-[#4F5B2A] text-[#F5EFE3] border border-[#4F5B2A]">
                  Stage {stageIndex + 1} of 6 • {LEGAL_STAGES[stageIndex]?.citation}
                </span>
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-[#4F5B2A] sm:pl-4">
              <div className="text-3xl font-black uppercase tracking-tighter text-[#4F5B2A]">
                {project.riskScore}
                <span className="text-sm text-[#4F5B2A]/60 font-bold">/100</span>
              </div>
            </div>
          </div>

          {/* 6-Stage Legal Stepper with Citations + Stage 7 Parallel Indicator */}
          <div className="p-3 border border-[#4F5B2A] bg-[#F5EFE3] shadow-[2px_2px_0px_0px_#4F5B2A]">
            <StageStepper currentStage={project.approvalStage} underArbitration={project.underArbitration} />
          </div>

          {/* Stage 7: Section 3G(5) Parallel Arbitration Controls */}
          <div className="p-2.5 sm:p-3 border-2 border-[#4F5B2A] bg-[#F5EFE3] shadow-[2px_2px_0px_0px_#4F5B2A] space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1 border border-[#4F5B2A] ${project.underArbitration ? 'bg-[#A8442E] text-[#F5EFE3]' : 'bg-[#D8C9A8] text-[#4F5B2A]'}`}>
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black uppercase text-[#4F5B2A] flex items-center gap-1.5">
                    <span>Stage 7: Section 3G(5) Arbitration</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-[#D8C9A8] border border-[#4F5B2A]">
                      Parallel / Non-Blocking
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-[#4F5B2A]/80 leading-tight">
                    Arbitration over compensation quantum. Does not halt or delay physical possession under Section 3E/3F.
                  </div>
                </div>
              </div>

              {canEdit && (
                <button
                  onClick={handleToggleArbitration}
                  disabled={isUpdatingArb || !isArbitrationAdmissible}
                  className={`px-3 py-1.5 text-xs font-bold uppercase border-2 border-[#4F5B2A] transition-all flex items-center gap-1.5 flex-shrink-0 ${
                    !isArbitrationAdmissible
                      ? 'bg-[#D8C9A8]/40 text-[#4F5B2A]/50 cursor-not-allowed border-[#4F5B2A]/40'
                      : project.underArbitration
                      ? 'bg-[#F5EFE3] text-[#A8442E] hover:bg-[#D8C9A8] active:translate-x-[1px] active:translate-y-[1px] shadow-[2px_2px_0px_0px_#4F5B2A]'
                      : 'bg-[#B8892D] text-[#F5EFE3] hover:brightness-105 active:translate-x-[1px] active:translate-y-[1px] shadow-[2px_2px_0px_0px_#4F5B2A]'
                  }`}
                  title={
                    !isArbitrationAdmissible
                      ? 'Admissible only from AwardAnnounced (Stage 5) onward'
                      : 'Toggle Section 3G(5) Arbitration Flag'
                  }
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>
                    {isUpdatingArb
                      ? 'Updating...'
                      : project.underArbitration
                      ? 'Clear Arbitration Flag'
                      : 'Raise Sec. 3G(5) Arbitration'}
                  </span>
                </button>
              )}
            </div>

            {arbError && (
              <div className="p-1.5 bg-[#A8442E]/10 border border-[#A8442E] text-[#A8442E] text-[11px] font-bold">
                {arbError}
              </div>
            )}
          </div>

          {/* Statutory Deadlines & Windows */}
          <div className="p-2.5 sm:p-3 border border-[#4F5B2A] bg-[#D8C9A8]/30 shadow-[2px_2px_0px_0px_#4F5B2A] space-y-1.5">
            <div className="text-[11px] font-black uppercase text-[#4F5B2A] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#B8892D]" />
              <span>Statutory Legal Windows & Deadlines</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Sec. 3C Objections Window */}
              <div className="p-2 bg-[#F5EFE3] border border-[#4F5B2A]">
                <div className="flex items-center justify-between">
                  <span className="font-black uppercase text-[10px] text-[#4F5B2A]">Sec. 3C Objection Window</span>
                  <span className="font-bold text-[9px] bg-[#B8892D] text-[#F5EFE3] px-1 py-0.2">21 Days</span>
                </div>
                <div className="text-[11px] font-medium text-[#4F5B2A]/80 mt-1">
                  {project.objectionsDeadlineAt ? (
                    <div>
                      Due: <span className="font-bold text-[#4F5B2A]">{new Date(project.objectionsDeadlineAt).toLocaleDateString()}</span>
                    </div>
                  ) : (
                    <span>Runs 21 days from last newspaper publication under Section 3A(3).</span>
                  )}
                </div>
              </div>

              {/* Sec. 3E Possession Notice */}
              <div className="p-2 bg-[#F5EFE3] border border-[#4F5B2A]">
                <div className="flex items-center justify-between">
                  <span className="font-black uppercase text-[10px] text-[#4F5B2A]">Sec. 3E Possession Notice</span>
                  <span className="font-bold text-[9px] bg-[#4F5B2A] text-[#F5EFE3] px-1 py-0.2">60 Days</span>
                </div>
                <div className="text-[11px] font-medium text-[#4F5B2A]/80 mt-1">
                  {project.possessionDueAt ? (
                    <div>
                      Due: <span className="font-bold text-[#4F5B2A]">{new Date(project.possessionDueAt).toLocaleDateString()}</span>
                    </div>
                  ) : (
                    <span>Occupants must surrender possession within 60 days of notice service.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Core Metric Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="border border-[#4F5B2A] p-2 bg-[#F5EFE3] shadow-[2px_2px_0px_0px_#4F5B2A]">
              <div className="text-[9px] font-black uppercase text-[#4F5B2A]/70">Land Area</div>
              <div className="text-xl font-black text-[#4F5B2A] mt-0.5">{project.landAreaHectares} <span className="text-[10px] font-bold text-[#4F5B2A]/60">HA</span></div>
            </div>

            <div className="border border-[#4F5B2A] p-2 bg-[#F5EFE3] shadow-[2px_2px_0px_0px_#4F5B2A]">
              <div className="text-[9px] font-black uppercase text-[#4F5B2A]/70">Families</div>
              <div className="text-xl font-black text-[#4F5B2A] mt-0.5">{project.familiesAffected}</div>
            </div>

            <div className="border border-[#4F5B2A] p-2 bg-[#F5EFE3] shadow-[2px_2px_0px_0px_#4F5B2A]">
              <div className="text-[9px] font-black uppercase text-[#4F5B2A]/70">Compensation</div>
              <div className="text-xs font-black uppercase mt-1 text-[#B8892D]">
                {project.compensationStatus}
              </div>
            </div>

            <div className="border border-[#4F5B2A] p-2 bg-[#F5EFE3] shadow-[2px_2px_0px_0px_#4F5B2A]">
              <div className="text-[9px] font-black uppercase text-[#4F5B2A]/70">Legal Dispute</div>
              <div className="text-xs font-black uppercase mt-1">
                {project.legalDisputeFlag ? (
                  <span className="text-[#A8442E] flex items-center gap-1 font-black">
                    <AlertOctagon className="w-3.5 h-3.5" /> YES
                  </span>
                ) : (
                  <span className="text-[#4F5B2A] flex items-center gap-1 font-black">
                    <CheckCircle className="w-3.5 h-3.5" /> NO
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ML Explainability Factors */}
          <div className="border border-[#4F5B2A] p-3 bg-[#F5EFE3] shadow-[2px_2px_0px_0px_#4F5B2A]">
            <div className="flex items-center justify-between border-b border-[#4F5B2A] pb-1.5 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#4F5B2A]">
                Feature Attribution
              </span>
              <span className="text-[9px] font-mono text-[#4F5B2A]/70">
                Mapped Model Feature: {detailed.legacyMappedStage}
              </span>
            </div>

            <div className="space-y-1.5">
              {detailed.factors.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 text-xs p-1.5 border border-[#4F5B2A] bg-[#D8C9A8]/20"
                >
                  <div className="font-black uppercase text-[11px] text-[#4F5B2A]">{item.factor}</div>
                  <div
                    className={`font-black text-[10px] px-1.5 py-0.2 border border-[#4F5B2A] ${
                      item.impact > 0
                        ? item.severity === 'high'
                          ? 'bg-[#A8442E] text-[#F5EFE3]'
                          : 'bg-[#B8892D] text-[#4F5B2A]'
                        : item.impact < 0
                        ? 'bg-[#4F5B2A] text-[#F5EFE3]'
                        : 'bg-[#D8C9A8] text-[#4F5B2A]'
                    }`}
                  >
                    {item.impact > 0 ? `+${item.impact} pts` : item.impact < 0 ? `${item.impact} pts` : '0 pts'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit & Clerk Ownership Info */}
          <div className="border-t border-[#4F5B2A] pt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-medium text-[#4F5B2A]">
            <div>
              <span className="font-black uppercase text-[#4F5B2A]/60 block text-[9px]">Created By</span>
              <span className="font-bold text-[#4F5B2A] font-mono text-[10px]">{project.createdByClerkId}</span>
            </div>
            <div>
              <span className="font-black uppercase text-[#4F5B2A]/60 block text-[9px]">Created</span>
              <span className="font-bold text-[#4F5B2A] text-[10px]">
                {new Date(project.createdAt).toLocaleDateString()} {new Date(project.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>
              <span className="font-black uppercase text-[#4F5B2A]/60 block text-[9px]">Updated</span>
              <span className="font-bold text-[#4F5B2A] text-[10px]">
                {project.daysSinceLastUpdate}d ago
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="bg-[#D8C9A8] border-t-2 border-[#4F5B2A] p-2.5 sm:p-3 flex items-center justify-between">
          <div className="text-[11px] font-bold text-[#4F5B2A]">
            Current Stage: <span className="font-black uppercase">{LEGAL_STAGES[stageIndex]?.label}</span>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                id="modal-edit-project-btn"
                onClick={() => {
                  onClose();
                  onEdit(project);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4F5B2A] text-[#F5EFE3] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#B8892D] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:brightness-110 transition-all"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-[#F5EFE3] text-[#4F5B2A] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:bg-[#D8C9A8] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
