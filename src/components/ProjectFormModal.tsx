import React, { useState, useEffect, useMemo } from 'react';
import { Project, CompensationStatus, ApprovalStage } from '../types/project';
import { RiskBadge } from './RiskBadge';
import { calculateRiskPrediction } from '../services/mlPredictor';
import { LEGAL_STAGES } from './StageStepper';
import { useAuth } from '../context/AuthContext';
import { X, Sparkles, AlertCircle, Scale, Calendar, Info } from 'lucide-react';

interface ProjectFormModalProps {
  project?: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Gujarat',
  'Haryana',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'West Bengal',
  'Delhi NCR',
];

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  project,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { user, role } = useAuth();
  const isEditing = Boolean(project);

  const [name, setName] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('');
  const [landAreaHectares, setLandAreaHectares] = useState<number>(50);
  const [familiesAffected, setFamiliesAffected] = useState<number>(100);
  const [compensationStatus, setCompensationStatus] = useState<CompensationStatus>('Pending');
  const [approvalStage, setApprovalStage] = useState<ApprovalStage>('Drafting');
  const [legalDisputeFlag, setLegalDisputeFlag] = useState<boolean>(false);
  const [daysSinceLastUpdate, setDaysSinceLastUpdate] = useState<number>(30);
  const [underArbitration, setUnderArbitration] = useState<boolean>(false);
  const [prelimNotificationDate, setPrelimNotificationDate] = useState<string>('');
  const [possessionNoticeDate, setPossessionNoticeDate] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (project) {
      setName(project.name);
      setState(project.state);
      setDistrict(project.district);
      setLandAreaHectares(project.landAreaHectares);
      setFamiliesAffected(project.familiesAffected);
      setCompensationStatus(project.compensationStatus);
      setApprovalStage(project.approvalStage);
      setLegalDisputeFlag(project.legalDisputeFlag);
      setDaysSinceLastUpdate(project.daysSinceLastUpdate);
      setUnderArbitration(Boolean(project.underArbitration));
      setPrelimNotificationDate(
        project.preliminaryNotificationAt
          ? new Date(project.preliminaryNotificationAt).toISOString().split('T')[0]
          : ''
      );
      setPossessionNoticeDate(
        project.possessionNoticeAt
          ? new Date(project.possessionNoticeAt).toISOString().split('T')[0]
          : ''
      );
    } else {
      setName('');
      setState('Madhya Pradesh');
      setDistrict('Indore');
      setLandAreaHectares(65);
      setFamiliesAffected(120);
      setCompensationStatus('Pending');
      setApprovalStage('Drafting');
      setLegalDisputeFlag(false);
      setDaysSinceLastUpdate(15);
      setUnderArbitration(false);
      setPrelimNotificationDate('');
      setPossessionNoticeDate('');
    }
    setErrorMsg('');
  }, [project, isOpen]);

  const currentStageIndex = LEGAL_STAGES.findIndex((s) => s.key === approvalStage);
  const awardIndex = LEGAL_STAGES.findIndex((s) => s.key === 'AwardAnnounced');
  const isArbitrationAdmissible = currentStageIndex >= awardIndex;

  // Live ML prediction calculation as inputs change
  const livePrediction = useMemo(() => {
    return calculateRiskPrediction({
      landAreaHectares: Number(landAreaHectares) || 0,
      familiesAffected: Number(familiesAffected) || 0,
      compensationStatus,
      approvalStage,
      legalDisputeFlag,
      daysSinceLastUpdate: Number(daysSinceLastUpdate) || 0,
      underArbitration: isArbitrationAdmissible ? underArbitration : false,
    });
  }, [
    landAreaHectares,
    familiesAffected,
    compensationStatus,
    approvalStage,
    legalDisputeFlag,
    daysSinceLastUpdate,
    underArbitration,
    isArbitrationAdmissible,
  ]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Project Name is required.');
      return;
    }
    if (!district.trim()) {
      setErrorMsg('District is required.');
      return;
    }
    if (landAreaHectares <= 0) {
      setErrorMsg('Land Area must be greater than 0.');
      return;
    }

    // Sequential Transition check if editing
    if (isEditing && project && approvalStage !== project.approvalStage) {
      const oldIndex = LEGAL_STAGES.findIndex((s) => s.key === project.approvalStage);
      const newIndex = LEGAL_STAGES.findIndex((s) => s.key === approvalStage);
      if (newIndex !== oldIndex + 1 && role !== 'Admin') {
        setErrorMsg(
          `Sequential statutory workflow required: Cannot jump or revert from '${project.approvalStage}' to '${approvalStage}'. Only Admins can override legal stage sequence.`
        );
        return;
      }
    }

    if (underArbitration && !isArbitrationAdmissible) {
      setErrorMsg('Section 3G(5) arbitration is only admissible once compensation award is announced (Stage 5+).');
      return;
    }

    // Calculate statutory deadlines
    let calculatedObjectionsDeadline: string | null = null;
    let calculatedPossessionDue: string | null = null;

    if (prelimNotificationDate) {
      const d = new Date(prelimNotificationDate);
      d.setDate(d.getDate() + 21); // 21 days window under Sec. 3C
      calculatedObjectionsDeadline = d.toISOString();
    }

    if (possessionNoticeDate) {
      const d = new Date(possessionNoticeDate);
      d.setDate(d.getDate() + 60); // 60 days window under Sec. 3E
      calculatedPossessionDue = d.toISOString();
    }

    onSubmit({
      name: name.trim(),
      state: state.trim(),
      district: district.trim(),
      landAreaHectares: Number(landAreaHectares),
      familiesAffected: Number(familiesAffected),
      compensationStatus,
      approvalStage,
      legalDisputeFlag,
      daysSinceLastUpdate: Number(daysSinceLastUpdate),
      underArbitration: isArbitrationAdmissible ? underArbitration : false,
      arbitrationRaisedAt: underArbitration ? new Date().toISOString() : null,
      preliminaryNotificationAt: prelimNotificationDate ? new Date(prelimNotificationDate).toISOString() : null,
      objectionsDeadlineAt: calculatedObjectionsDeadline,
      possessionNoticeAt: possessionNoticeDate ? new Date(possessionNoticeDate).toISOString() : null,
      possessionDueAt: calculatedPossessionDue,
      createdByClerkId: project?.createdByClerkId || user?.userId || 'user_clerk_admin_01',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#4F5B2A]/70 flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-none">
      <div
        id="project-form-modal"
        className="bg-[#F5EFE3] border-2 border-[#4F5B2A] shadow-[8px_8px_0px_0px_#4F5B2A] w-full max-w-2xl my-3 relative"
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
                {isEditing ? 'UPDATE RECORD' : 'NEW ACQUISITION'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#F5EFE3] mt-0.5">
              {isEditing ? 'Modify Parameters' : 'Register Project'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 bg-[#F5EFE3] text-[#4F5B2A] border border-[#4F5B2A] shadow-[1px_1px_0px_0px_#4F5B2A] hover:bg-[#D8C9A8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* Live ML Prediction Preview Card */}
        <div className="bg-[#D8C9A8] border-b-2 border-[#4F5B2A] px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[#4F5B2A]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#B8892D]" />
            <div className="text-xs font-black uppercase text-[#4F5B2A]">
              Score: {livePrediction.riskScore}/100 • Model Mapped: {livePrediction.legacyMappedStage}
            </div>
          </div>
          <RiskBadge category={livePrediction.riskCategory} score={livePrediction.riskScore} size="sm" />
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 space-y-2.5 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-2 bg-[#A8442E]/10 border border-[#A8442E] text-[#A8442E] text-xs font-bold uppercase flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
              Project Name *
            </label>
            <input
              id="form-project-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. National Highway 48 Bypass"
              className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] rounded-none text-xs font-bold text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
            />
          </div>

          {/* State & District Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
                State *
              </label>
              <select
                id="form-project-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] rounded-none text-xs font-bold uppercase text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
                District *
              </label>
              <input
                id="form-project-district"
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Indore"
                className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] rounded-none text-xs font-bold text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
              />
            </div>
          </div>

          {/* Scale Metrics: Area & Families */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
                Land Area (Hectares) *
              </label>
              <input
                id="form-land-area"
                type="number"
                min="1"
                step="any"
                required
                value={landAreaHectares}
                onChange={(e) => setLandAreaHectares(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] rounded-none text-xs font-bold text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
                Project-Affected Families *
              </label>
              <input
                id="form-families-affected"
                type="number"
                min="0"
                required
                value={familiesAffected}
                onChange={(e) => setFamiliesAffected(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] rounded-none text-xs font-bold text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
              />
            </div>
          </div>

          {/* Procedural State: Compensation & 6 Legal Stages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
                Compensation Status *
              </label>
              <select
                id="form-compensation-status"
                value={compensationStatus}
                onChange={(e) => setCompensationStatus(e.target.value as CompensationStatus)}
                className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] rounded-none text-xs font-bold uppercase text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
              >
                <option value="Pending">Pending</option>
                <option value="PartiallyPaid">Partially Paid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
                Statutory Approval Stage (1–6) *
              </label>
              <select
                id="form-approval-stage"
                value={approvalStage}
                onChange={(e) => setApprovalStage(e.target.value as ApprovalStage)}
                className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] rounded-none text-xs font-bold uppercase text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
              >
                {LEGAL_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    Stage {s.stageNumber}: {s.label} ({s.citation})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stage 7: Section 3G(5) Arbitration Parallel Flag */}
          <div className="p-2 bg-[#D8C9A8]/40 border-2 border-[#4F5B2A]">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                id="form-arbitration-toggle"
                type="checkbox"
                checked={underArbitration}
                disabled={!isArbitrationAdmissible}
                onChange={(e) => setUnderArbitration(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-none border-2 border-[#4F5B2A] text-[#A8442E] focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:opacity-40"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-[#A8442E]" />
                  <span className="text-[11px] font-black uppercase text-[#4F5B2A]">
                    Stage 7: Under Arbitration (Section 3G(5))
                  </span>
                  <span className="text-[9px] font-bold uppercase px-1 bg-[#4F5B2A] text-[#F5EFE3]">
                    Parallel / Non-Blocking
                  </span>
                </div>
                <p className="text-[10px] text-[#4F5B2A]/80 font-medium leading-snug mt-0.5">
                  {isArbitrationAdmissible
                    ? 'Dispute raised with Arbitrator over compensation quantum. Does not delay or block physical possession.'
                    : 'Admissible only once Stage 5 (Award Announced) is reached.'}
                </p>
              </div>
            </label>
          </div>

          {/* Statutory Dates (Optional Deadlines) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 border-t border-[#4F5B2A]">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
                Sec. 3A Publication Date (21d Objections Window)
              </label>
              <input
                type="date"
                value={prelimNotificationDate}
                onChange={(e) => setPrelimNotificationDate(e.target.value)}
                className="w-full px-2 py-1 bg-[#F5EFE3] border-2 border-[#4F5B2A] text-xs font-bold text-[#4F5B2A]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
                Sec. 3E Notice Date (60d Possession Window)
              </label>
              <input
                type="date"
                value={possessionNoticeDate}
                onChange={(e) => setPossessionNoticeDate(e.target.value)}
                className="w-full px-2 py-1 bg-[#F5EFE3] border-2 border-[#4F5B2A] text-xs font-bold text-[#4F5B2A]"
              />
            </div>
          </div>

          {/* Dispute Flag & Days Since Last Update */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1.5 border-t border-[#4F5B2A]">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#4F5B2A] mb-0.5">
                Days Since Last Update *
              </label>
              <input
                id="form-days-update"
                type="number"
                min="0"
                required
                value={daysSinceLastUpdate}
                onChange={(e) => setDaysSinceLastUpdate(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] rounded-none text-xs font-bold text-[#4F5B2A] focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-1.5 bg-[#D8C9A8]/40 border-2 border-[#4F5B2A] cursor-pointer hover:bg-[#D8C9A8] transition-colors">
                <input
                  id="form-dispute-toggle"
                  type="checkbox"
                  checked={legalDisputeFlag}
                  onChange={(e) => setLegalDisputeFlag(e.target.checked)}
                  className="w-4 h-4 rounded-none border-2 border-[#4F5B2A] text-[#A8442E] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-[11px] font-black uppercase text-[#4F5B2A]">
                  Court Litigation Active
                </span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2.5 border-t-2 border-[#4F5B2A] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-[#F5EFE3] text-[#4F5B2A] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:bg-[#D8C9A8] transition-all"
            >
              Cancel
            </button>
            <button
              id="form-submit-btn"
              type="submit"
              className="px-4 py-1.5 bg-[#4F5B2A] text-[#F5EFE3] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#B8892D] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:brightness-110 transition-all"
            >
              {isEditing ? 'Save Changes' : 'Create Project Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
