import React from 'react';
import { ApprovalStage } from '../types/project';
import { Scale } from 'lucide-react';

interface StageConfig {
  key: ApprovalStage;
  label: string;
  citation: string;
  stageNumber: number;
}

export const LEGAL_STAGES: StageConfig[] = [
  {
    key: 'Drafting',
    label: 'Drafting',
    citation: 'Pre-Notification',
    stageNumber: 1,
  },
  {
    key: 'PreliminaryNotification',
    label: 'Preliminary Notification',
    citation: 'Sec. 3A',
    stageNumber: 2,
  },
  {
    key: 'ObjectionsHearing',
    label: 'Objections & Hearing',
    citation: 'Sec. 3C',
    stageNumber: 3,
  },
  {
    key: 'DeclarationVesting',
    label: 'Declaration & Vesting',
    citation: 'Sec. 3D',
    stageNumber: 4,
  },
  {
    key: 'AwardAnnounced',
    label: 'Award Announced',
    citation: 'Sec. 3G',
    stageNumber: 5,
  },
  {
    key: 'PossessionTaken',
    label: 'Possession Taken',
    citation: 'Sec. 3E/3F',
    stageNumber: 6,
  },
];

interface StageStepperProps {
  currentStage: ApprovalStage;
  underArbitration?: boolean;
  compact?: boolean;
}

export const StageStepper: React.FC<StageStepperProps> = ({
  currentStage,
  underArbitration = false,
  compact = false,
}) => {
  const currentIndex = LEGAL_STAGES.findIndex((s) => s.key === currentStage);
  const safeCurrentIndex = currentIndex !== -1 ? currentIndex : 0;
  const currentStageConfig = LEGAL_STAGES[safeCurrentIndex];

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap" title={`Current Stage: ${currentStageConfig.label} (${currentStageConfig.citation})`}>
        <div className="flex items-center gap-1">
          {LEGAL_STAGES.map((s, idx) => {
            const isPassed = idx < safeCurrentIndex;
            const isCurrent = idx === safeCurrentIndex;
            return (
              <div key={s.key} className="flex items-center">
                <div
                  className={`w-2.5 h-2.5 border border-[#4F5B2A] transition-all ${
                    isCurrent
                      ? 'rotate-45 bg-[#B8892D] scale-110 shadow-[1px_1px_0px_0px_#4F5B2A]'
                      : isPassed
                      ? 'bg-[#4F5B2A]'
                      : 'bg-[#F5EFE3]'
                  }`}
                  title={`Stage ${s.stageNumber}: ${s.label} (${s.citation})`}
                />
                {idx < LEGAL_STAGES.length - 1 && (
                  <div className={`w-1.5 h-0.5 ${isPassed ? 'bg-[#4F5B2A]' : 'bg-[#D8C9A8]'}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#4F5B2A]">
            {currentStageConfig.label}
          </span>
          <span className="text-[9px] font-bold uppercase px-1 py-0.2 bg-[#4F5B2A] text-[#F5EFE3] border border-[#4F5B2A]">
            {currentStageConfig.citation}
          </span>
          {underArbitration && (
            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-[#A8442E] text-[#F5EFE3] border border-[#4F5B2A] flex items-center gap-0.5 shadow-[1px_1px_0px_0px_#4F5B2A]">
              <Scale className="w-2.5 h-2.5" />
              Sec. 3G(5)
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5 py-1">
      {/* 6-Step Stepper Line */}
      <div className="relative pt-2 pb-1">
        {/* Connecting line */}
        <div className="absolute left-6 right-6 top-5 -translate-y-1/2 h-1 bg-[#4F5B2A]/40 z-0" />
        <div
          className="absolute left-6 top-5 -translate-y-1/2 h-1 bg-[#4F5B2A] z-0 transition-all duration-300"
          style={{ width: `${(safeCurrentIndex / (LEGAL_STAGES.length - 1)) * 100}%` }}
        />

        <div className="grid grid-cols-6 relative z-10 gap-1">
          {LEGAL_STAGES.map((s, idx) => {
            const isPassed = idx < safeCurrentIndex;
            const isCurrent = idx === safeCurrentIndex;

            return (
              <div key={s.key} className="flex flex-col items-center text-center">
                <div
                  className={`w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center border-2 border-[#4F5B2A] transition-all ${
                    isCurrent
                      ? 'bg-[#B8892D] text-[#F5EFE3] rotate-45 shadow-[2px_2px_0px_0px_#4F5B2A] scale-105'
                      : isPassed
                      ? 'bg-[#4F5B2A] text-[#F5EFE3]'
                      : 'bg-[#F5EFE3] text-[#4F5B2A]'
                  }`}
                >
                  <span className={`text-[11px] font-black ${isCurrent ? '-rotate-45' : ''}`}>
                    {s.stageNumber}
                  </span>
                </div>

                <div className="mt-1.5 space-y-0.5">
                  <div
                    className={`text-[10px] sm:text-[11px] font-black uppercase tracking-tight leading-tight line-clamp-2 ${
                      isCurrent
                        ? 'text-[#B8892D] underline underline-offset-2'
                        : isPassed
                        ? 'text-[#4F5B2A]'
                        : 'text-[#4F5B2A]/60'
                    }`}
                  >
                    {s.label}
                  </div>
                  <div
                    className={`text-[9px] font-bold uppercase tracking-wider ${
                      isCurrent
                        ? 'text-[#4F5B2A] font-black bg-[#D8C9A8] px-1 py-0.2 border border-[#4F5B2A] inline-block'
                        : isPassed
                        ? 'text-[#4F5B2A]/80'
                        : 'text-[#4F5B2A]/50'
                    }`}
                  >
                    {s.citation}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage 7: Independent Parallel Arbitration Indicator */}
      {underArbitration && (
        <div className="p-2 bg-[#A8442E]/10 border-2 border-[#A8442E] shadow-[2px_2px_0px_0px_#A8442E] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-[#A8442E] text-[#F5EFE3] border border-[#4F5B2A]">
              <Scale className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-[#A8442E]">
                Stage 7 (Parallel): Section 3G(5) Arbitration Active
              </div>
              <div className="text-[10px] font-medium text-[#4F5B2A] leading-snug">
                Compensation award disputed before Central Government Arbitrator. Explicitly does not halt or delay physical possession under Section 3E/3F.
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-[#A8442E] text-[#F5EFE3] font-black text-[9px] uppercase border border-[#4F5B2A] flex-shrink-0">
            NON-BLOCKING
          </span>
        </div>
      )}
    </div>
  );
};
