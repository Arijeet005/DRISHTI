import React from 'react';
import { Project } from '../types/project';
import { RiskBadge } from './RiskBadge';
import { AlertTriangle, Plus, ArrowRight, MapPin, Scale } from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onNavigateProjects: () => void;
  onNavigateNew: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  onSelectProject,
  onNavigateProjects,
  onNavigateNew,
}) => {
  const totalCount = projects.length;
  const highRiskCount = projects.filter((p) => p.riskCategory === 'High').length;
  const mediumRiskCount = projects.filter((p) => p.riskCategory === 'Medium').length;
  const lowRiskCount = projects.filter((p) => p.riskCategory === 'Low').length;

  const totalHectares = projects.reduce((acc, p) => acc + p.landAreaHectares, 0);
  const totalFamilies = projects.reduce((acc, p) => acc + p.familiesAffected, 0);
  const disputeCount = projects.filter((p) => p.legalDisputeFlag).length;

  const highPercent = totalCount ? Math.round((highRiskCount / totalCount) * 100) : 0;
  const mediumPercent = totalCount ? Math.round((mediumRiskCount / totalCount) * 100) : 0;
  const lowPercent = totalCount ? Math.round((lowRiskCount / totalCount) * 100) : 0;

  // Compensation breakdown
  const pendingCompensation = projects.filter((p) => p.compensationStatus === 'Pending').length;
  const partialCompensation = projects.filter((p) => p.compensationStatus === 'PartiallyPaid').length;
  const paidCompensation = projects.filter((p) => p.compensationStatus === 'Paid').length;

  const highRiskProjects = projects.filter((p) => p.riskCategory === 'High');

  return (
    <div className="space-y-3.5">
      {/* Top Banner with Compact Earthy Color Blocking */}
      <div className="bg-[#4F5B2A] text-[#F5EFE3] border-2 border-[#4F5B2A] p-3 sm:p-3.5 shadow-[4px_4px_0px_0px_#B8892D] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#F5EFE3]">
              Risk Intelligence Overview
            </h2>
          </div>

          <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
            <button
              id="dash-add-project-btn"
              onClick={onNavigateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#B8892D] text-[#F5EFE3] border-2 border-[#4F5B2A] font-bold uppercase tracking-wider text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all hover:brightness-105"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Create Project</span>
            </button>
            <button
              id="dash-view-all-btn"
              onClick={onNavigateProjects}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5EFE3] text-[#4F5B2A] border-2 border-[#4F5B2A] font-bold uppercase tracking-wider text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all hover:bg-[#D8C9A8]"
            >
              <span>View All ({totalCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4-Column Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Projects Card */}
        <div className="bg-[#F5EFE3] border-2 border-[#4F5B2A] p-3 shadow-[3px_3px_0px_0px_#4F5B2A] relative hover:-translate-y-0.5 transition-transform">
          <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#D8C9A8]" />
          <div className="text-[10px] font-black uppercase tracking-widest text-[#4F5B2A]/70">
            Total Projects
          </div>
          <div className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-[#4F5B2A] mt-1">
            {totalCount}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F5B2A] mt-1 flex items-center justify-between">
            <span>Portfolio</span>
            <span className="font-black bg-[#D8C9A8] px-1 py-0.2 border border-[#4F5B2A] text-[10px]">
              100%
            </span>
          </div>
        </div>

        {/* High Risk Critical Card */}
        <div className="bg-[#D8C9A8] text-[#4F5B2A] border-2 border-[#4F5B2A] p-3 shadow-[3px_3px_0px_0px_#4F5B2A] relative hover:-translate-y-0.5 transition-transform">
          <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#A8442E]" />
          <div className="text-[10px] font-black uppercase tracking-widest text-[#4F5B2A]">
            High Risk
          </div>
          <div className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-[#A8442E] mt-1">
            {highRiskCount}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F5B2A] mt-1 flex items-center justify-between">
            <span>Critical</span>
            <span className="font-black bg-[#A8442E] text-[#F5EFE3] px-1 py-0.2 border border-[#4F5B2A] text-[10px]">
              {highPercent}%
            </span>
          </div>
        </div>

        {/* Total Land Area Card */}
        <div className="bg-[#F5EFE3] border-2 border-[#4F5B2A] p-3 shadow-[3px_3px_0px_0px_#4F5B2A] relative hover:-translate-y-0.5 transition-transform">
          <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#B8892D]" />
          <div className="text-[10px] font-black uppercase tracking-widest text-[#4F5B2A]/70">
            Land Area
          </div>
          <div className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-[#4F5B2A] mt-1">
            {totalHectares.toLocaleString()}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#4F5B2A] mt-1 flex items-center justify-between">
            <span>Hectares</span>
            <span className="font-black text-[#B8892D] text-[10px]">HA</span>
          </div>
        </div>

        {/* Affected Families & Disputes */}
        <div className="bg-[#B8892D] text-[#F5EFE3] border-2 border-[#4F5B2A] p-3 shadow-[3px_3px_0px_0px_#4F5B2A] relative hover:-translate-y-0.5 transition-transform">
          <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#4F5B2A]" />
          <div className="text-[10px] font-black uppercase tracking-widest text-[#F5EFE3]/90">
            Displaced Families
          </div>
          <div className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-[#F5EFE3] mt-1">
            {totalFamilies.toLocaleString()}
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#F5EFE3] mt-1 flex items-center justify-between">
            <span>Disputes</span>
            <span className="font-black bg-[#4F5B2A] text-[#F5EFE3] px-1 py-0.2 border border-[#4F5B2A] text-[10px]">
              {disputeCount}
            </span>
          </div>
        </div>
      </div>

      {/* Main Analytics: Risk Distribution Chart & Attention Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left: Risk Category Breakdown Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-[#F5EFE3] border-2 border-[#4F5B2A] p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#4F5B2A] relative">
          <div className="flex items-center justify-between border-b-2 border-[#4F5B2A] pb-2 mb-3">
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-[#4F5B2A]">
              Risk Categories
            </h3>
            <div className="w-3.5 h-3.5 bg-[#B8892D] border border-[#4F5B2A]" />
          </div>

          {/* Color-blocked Stacked Proportion Bar */}
          <div className="space-y-3">
            <div className="h-8 w-full flex border-2 border-[#4F5B2A] shadow-[2px_2px_0px_0px_#4F5B2A] overflow-hidden bg-[#D8C9A8]">
              {highRiskCount > 0 && (
                <div
                  style={{ width: `${(highRiskCount / totalCount) * 100}%` }}
                  className="bg-[#A8442E] text-[#F5EFE3] flex items-center justify-center font-black text-xs tracking-wider border-r border-[#4F5B2A]"
                  title={`High Risk: ${highRiskCount} projects (${highPercent}%)`}
                >
                  {highPercent >= 10 ? `${highPercent}%` : ''}
                </div>
              )}
              {mediumRiskCount > 0 && (
                <div
                  style={{ width: `${(mediumRiskCount / totalCount) * 100}%` }}
                  className="bg-[#B8892D] text-[#4F5B2A] flex items-center justify-center font-black text-xs tracking-wider border-r border-[#4F5B2A]"
                  title={`Medium Risk: ${mediumRiskCount} projects (${mediumPercent}%)`}
                >
                  {mediumPercent >= 10 ? `${mediumPercent}%` : ''}
                </div>
              )}
              {lowRiskCount > 0 && (
                <div
                  style={{ width: `${(lowRiskCount / totalCount) * 100}%` }}
                  className="bg-[#4F5B2A] text-[#F5EFE3] flex items-center justify-center font-black text-xs tracking-wider"
                  title={`Low Risk: ${lowRiskCount} projects (${lowPercent}%)`}
                >
                  {lowPercent >= 10 ? `${lowPercent}%` : ''}
                </div>
              )}
            </div>

            {/* Legend Blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="border border-[#4F5B2A] p-2.5 bg-[#D8C9A8]/40 shadow-[2px_2px_0px_0px_#4F5B2A]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-[#A8442E] border border-[#4F5B2A]" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#4F5B2A]">High Risk</span>
                </div>
                <div className="mt-1 text-xl font-black text-[#A8442E]">
                  {highRiskCount}{' '}
                  <span className="text-xs text-[#4F5B2A]/70 font-bold">({highPercent}%)</span>
                </div>
              </div>

              <div className="border border-[#4F5B2A] p-2.5 bg-[#D8C9A8]/40 shadow-[2px_2px_0px_0px_#4F5B2A]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-[#B8892D] border border-[#4F5B2A]" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#4F5B2A]">Medium Risk</span>
                </div>
                <div className="mt-1 text-xl font-black text-[#B8892D]">
                  {mediumRiskCount}{' '}
                  <span className="text-xs text-[#4F5B2A]/70 font-bold">({mediumPercent}%)</span>
                </div>
              </div>

              <div className="border border-[#4F5B2A] p-2.5 bg-[#D8C9A8]/40 shadow-[2px_2px_0px_0px_#4F5B2A]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-[#4F5B2A] border border-[#4F5B2A]" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#4F5B2A]">Low Risk</span>
                </div>
                <div className="mt-1 text-xl font-black text-[#4F5B2A]">
                  {lowRiskCount}{' '}
                  <span className="text-xs text-[#4F5B2A]/70 font-bold">({lowPercent}%)</span>
                </div>
              </div>
            </div>

            {/* Compensation Status Summary */}
            <div className="mt-3 border-t border-[#4F5B2A] pt-2.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-[#4F5B2A] mb-2">
                Compensation Disbursement
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="border border-[#4F5B2A] p-1.5 bg-[#D8C9A8]/50">
                  <div className="text-base font-black text-[#A8442E]">{pendingCompensation}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#4F5B2A]">
                    Pending
                  </div>
                </div>
                <div className="border border-[#4F5B2A] p-1.5 bg-[#D8C9A8]/50">
                  <div className="text-base font-black text-[#B8892D]">{partialCompensation}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#4F5B2A]">
                    Partially Paid
                  </div>
                </div>
                <div className="border border-[#4F5B2A] p-1.5 bg-[#D8C9A8]/50">
                  <div className="text-base font-black text-[#4F5B2A]">{paidCompensation}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#4F5B2A]">
                    Fully Paid
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Urgent High-Risk Attention Queue (5 Cols) */}
        <div className="lg:col-span-5 bg-[#F5EFE3] border-2 border-[#4F5B2A] p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#4F5B2A] relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#4F5B2A] pb-2 mb-2.5">
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-[#4F5B2A]">
                Critical Projects
              </h3>
              <AlertTriangle className="w-5 h-5 text-[#A8442E]" />
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {highRiskProjects.slice(0, 5).map((p) => (
                <div
                  key={p._id}
                  onClick={() => onSelectProject(p)}
                  className="p-2 sm:p-2.5 border border-[#4F5B2A] bg-[#D8C9A8]/40 hover:bg-[#D8C9A8] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer shadow-[2px_2px_0px_0px_#4F5B2A]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-black text-xs uppercase text-[#4F5B2A] line-clamp-1">
                      {p.name}
                    </div>
                    <RiskBadge category={p.riskCategory} score={p.riskScore} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-medium text-[#4F5B2A]/80 mt-1">
                    <span className="flex items-center gap-1 font-bold text-[#4F5B2A]">
                      <MapPin className="w-2.5 h-2.5" />
                      {p.district}, {p.state}
                    </span>
                    <span>•</span>
                    <span>{p.landAreaHectares} Ha</span>
                    <span>•</span>
                    <span>{p.familiesAffected} Fam</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] pt-1 border-t border-[#4F5B2A]/20">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#4F5B2A]">Stage: {p.approvalStage}</span>
                      {p.underArbitration && (
                        <span className="font-black text-[#A8442E] bg-[#A8442E]/10 px-1 border border-[#A8442E] text-[8px] uppercase">
                          Sec. 3G(5)
                        </span>
                      )}
                    </div>
                    {p.legalDisputeFlag && (
                      <span className="font-black text-[#A8442E] flex items-center gap-0.5 text-[9px]">
                        <Scale className="w-2.5 h-2.5" />
                        LEGAL DISPUTE
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onNavigateProjects}
            className="w-full mt-2.5 py-2 bg-[#4F5B2A] text-[#F5EFE3] font-bold uppercase tracking-wider text-xs border-2 border-[#4F5B2A] shadow-[2px_2px_0px_0px_#B8892D] hover:opacity-90 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center gap-1.5"
          >
            <span>Open All Filtered Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
