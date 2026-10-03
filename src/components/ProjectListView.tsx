import React, { useState, useMemo } from 'react';
import { Project, RiskCategory, ApprovalStage } from '../types/project';
import { RiskBadge } from './RiskBadge';
import { StageStepper } from './StageStepper';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Plus,
  RotateCcw,
  Eye,
  Edit2,
  Trash2,
  Scale,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';

interface ProjectListViewProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenNew: () => void;
  onResetSeed: () => void;
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({
  projects,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onOpenNew,
  onResetSeed,
}) => {
  const { role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'riskScore' | 'landAreaHectares' | 'familiesAffected' | 'daysSinceLastUpdate'>('riskScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const canEdit = role === 'Admin' || role === 'Officer';
  const canDelete = role === 'Admin';

  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const query = searchTerm.toLowerCase();
        const matchesSearch =
          p.name.toLowerCase().includes(query) ||
          p.state.toLowerCase().includes(query) ||
          p.district.toLowerCase().includes(query);

        const matchesRisk =
          riskFilter === 'ALL' || p.riskCategory === riskFilter;

        const matchesStage =
          stageFilter === 'ALL'
            ? true
            : stageFilter === 'ARBITRATION'
            ? Boolean(p.underArbitration)
            : p.approvalStage === stageFilter;

        return matchesSearch && matchesRisk && matchesStage;
      })
      .sort((a, b) => {
        const valA = a[sortBy];
        const valB = b[sortBy];
        if (sortOrder === 'desc') {
          return valB > valA ? 1 : -1;
        }
        return valA > valB ? 1 : -1;
      });
  }, [projects, searchTerm, riskFilter, stageFilter, sortBy, sortOrder]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-3">
      {/* Controls and Actions Bar */}
      <div className="bg-[#F5EFE3] border-2 border-[#4F5B2A] p-3 shadow-[3px_3px_0px_0px_#4F5B2A] space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#4F5B2A]">
              Project Registry
            </h2>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              id="projects-reset-sample-btn"
              onClick={onResetSeed}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#D8C9A8] text-[#4F5B2A] border-2 border-[#4F5B2A] font-bold uppercase tracking-wider text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:brightness-105 transition-all"
              title="Reset records to official 10-row CSV seed"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset CSV</span>
            </button>

            {canEdit && (
              <button
                id="projects-add-btn"
                onClick={onOpenNew}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#B8892D] text-[#F5EFE3] border-2 border-[#4F5B2A] font-bold uppercase tracking-wider text-xs shadow-[2px_2px_0px_0px_#4F5B2A] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:brightness-105 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Add Project</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter and Search Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 pt-2 border-t border-[#4F5B2A]">
          {/* Search Bar (5 cols) */}
          <div className="md:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-[#4F5B2A]" />
            </div>
            <input
              id="project-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="SEARCH PROJECT, STATE, DISTRICT..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#F5EFE3] border-2 border-[#4F5B2A] text-[#4F5B2A] rounded-none text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#B8892D] placeholder-[#4F5B2A]/60"
            />
          </div>

          {/* Risk Filter (3 cols) */}
          <div className="md:col-span-4 flex items-center gap-1 flex-wrap">
            <span className="text-[11px] font-black uppercase text-[#4F5B2A]/70 mr-0.5">Risk:</span>
            {(['ALL', 'High', 'Medium', 'Low'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setRiskFilter(lvl)}
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border border-[#4F5B2A] transition-all ${
                  riskFilter === lvl
                    ? lvl === 'High'
                      ? 'bg-[#A8442E] text-[#F5EFE3] shadow-[1px_1px_0px_0px_#4F5B2A]'
                      : lvl === 'Medium'
                      ? 'bg-[#B8892D] text-[#4F5B2A] shadow-[1px_1px_0px_0px_#4F5B2A]'
                      : lvl === 'Low'
                      ? 'bg-[#4F5B2A] text-[#F5EFE3] shadow-[1px_1px_0px_0px_#4F5B2A]'
                      : 'bg-[#4F5B2A] text-[#F5EFE3] shadow-[1px_1px_0px_0px_#B8892D]'
                    : 'bg-[#F5EFE3] text-[#4F5B2A] hover:bg-[#D8C9A8]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Stage Filter (3 cols) */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <span className="text-[11px] font-black uppercase text-[#4F5B2A]/70 whitespace-nowrap">Stage:</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-2 py-1 bg-[#F5EFE3] border-2 border-[#4F5B2A] text-[#4F5B2A] rounded-none text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[#B8892D]"
            >
              <option value="ALL">ALL STAGES</option>
              <option value="Drafting">Stage 1: Drafting (Pre-Notification)</option>
              <option value="PreliminaryNotification">Stage 2: Prelim Notification (Sec. 3A)</option>
              <option value="ObjectionsHearing">Stage 3: Objections Hearing (Sec. 3C)</option>
              <option value="DeclarationVesting">Stage 4: Declaration & Vesting (Sec. 3D)</option>
              <option value="AwardAnnounced">Stage 5: Award Announced (Sec. 3G)</option>
              <option value="PossessionTaken">Stage 6: Possession Taken (Sec. 3E/3F)</option>
              <option value="ARBITRATION">Stage 7: Under Arbitration (Sec. 3G(5))</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Table Card */}
      <div className="bg-[#F5EFE3] border-2 border-[#4F5B2A] shadow-[4px_4px_0px_0px_#4F5B2A] overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="py-10 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto text-[#A8442E] stroke-[2.5]" />
            <div className="mt-2 text-base font-black uppercase tracking-tight text-[#4F5B2A]">
              No Projects Found
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setRiskFilter('ALL');
                setStageFilter('ALL');
              }}
              className="mt-3 px-3 py-1.5 bg-[#B8892D] text-[#F5EFE3] border-2 border-[#4F5B2A] font-bold uppercase text-xs shadow-[2px_2px_0px_0px_#4F5B2A]"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#4F5B2A] text-[#F5EFE3] border-b-2 border-[#4F5B2A] text-[11px] font-black uppercase tracking-widest">
                  <th className="py-2.5 px-3 border-r border-[#4F5B2A]/40">Project / Location</th>
                  <th
                    className="py-2.5 px-3 border-r border-[#4F5B2A]/40 cursor-pointer hover:bg-[#4F5B2A]/80"
                    onClick={() => toggleSort('landAreaHectares')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Area (Ha)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-3 border-r border-[#4F5B2A]/40 cursor-pointer hover:bg-[#4F5B2A]/80"
                    onClick={() => toggleSort('familiesAffected')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Families</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-[#4F5B2A]/40">Compensation</th>
                  <th className="py-2.5 px-3 border-r border-[#4F5B2A]/40">Stage Progress</th>
                  <th
                    className="py-2.5 px-3 border-r border-[#4F5B2A]/40 cursor-pointer hover:bg-[#4F5B2A]/80"
                    onClick={() => toggleSort('riskScore')}
                  >
                    <div className="flex items-center gap-1">
                      <span>ML Risk</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b border-[#4F5B2A] divide-[#4F5B2A] text-xs font-medium text-[#4F5B2A]">
                {filteredProjects.map((p, index) => {
                  const rowBg = index % 2 === 0 ? 'bg-[#F5EFE3]' : 'bg-[#D8C9A8]/20';

                  return (
                    <tr
                      key={p._id}
                      className={`${rowBg} hover:bg-[#D8C9A8]/50 transition-colors`}
                    >
                      {/* Name & Geography */}
                      <td className="py-2 px-3 border-r border-[#4F5B2A]">
                        <div className="font-black text-xs uppercase text-[#4F5B2A]">
                          {p.name}
                        </div>
                        <div className="text-[10px] font-bold uppercase text-[#4F5B2A]/70 flex items-center gap-1.5">
                          <span>{p.district}, {p.state}</span>
                          {p.legalDisputeFlag && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0.1 bg-[#A8442E]/10 text-[#A8442E] font-black border border-[#A8442E] text-[9px]">
                              <Scale className="w-2.5 h-2.5" />
                              LITIGATION
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Land Area */}
                      <td className="py-2 px-3 border-r border-[#4F5B2A] font-black text-xs">
                        {p.landAreaHectares}{' '}
                        <span className="text-[9px] font-bold text-[#4F5B2A]/60">HA</span>
                      </td>

                      {/* Families Affected */}
                      <td className="py-2 px-3 border-r border-[#4F5B2A] font-black text-xs">
                        {p.familiesAffected}
                      </td>

                      {/* Compensation Status */}
                      <td className="py-2 px-3 border-r border-[#4F5B2A]">
                        <span
                          className={`inline-block px-1.5 py-0.2 font-bold uppercase text-[9px] border border-[#4F5B2A] ${
                            p.compensationStatus === 'Paid'
                              ? 'bg-[#4F5B2A] text-[#F5EFE3]'
                              : p.compensationStatus === 'PartiallyPaid'
                              ? 'bg-[#B8892D] text-[#4F5B2A]'
                              : 'bg-[#A8442E] text-[#F5EFE3]'
                          }`}
                        >
                          {p.compensationStatus === 'PartiallyPaid'
                            ? 'Partially Paid'
                            : p.compensationStatus}
                        </span>
                        <span className="text-[9px] text-[#4F5B2A]/60 ml-1.5 font-bold">
                          {p.daysSinceLastUpdate}d dormant
                        </span>
                      </td>

                      {/* Stage Stepper */}
                      <td className="py-2 px-3 border-r border-[#4F5B2A]">
                        <StageStepper currentStage={p.approvalStage} underArbitration={p.underArbitration} compact />
                      </td>

                      {/* ML Risk Score & Badge */}
                      <td className="py-2 px-3 border-r border-[#4F5B2A]">
                        <div className="flex items-center gap-1.5">
                          <RiskBadge category={p.riskCategory} score={p.riskScore} size="sm" />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`view-btn-${p._id}`}
                            onClick={() => onSelectProject(p)}
                            className="p-1 bg-[#F5EFE3] text-[#4F5B2A] border border-[#4F5B2A] shadow-[1px_1px_0px_0px_#4F5B2A] hover:bg-[#D8C9A8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                            title="Inspect Project Details"
                          >
                            <Eye className="w-3 h-3" />
                          </button>

                          {canEdit && (
                            <button
                              id={`edit-btn-${p._id}`}
                              onClick={() => onEditProject(p)}
                              className="p-1 bg-[#B8892D] text-[#F5EFE3] border border-[#4F5B2A] shadow-[1px_1px_0px_0px_#4F5B2A] hover:brightness-105 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                              title="Edit Project"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              id={`delete-btn-${p._id}`}
                              onClick={() => {
                                if (
                                  confirm(`Are you sure you want to delete "${p.name}"?`)
                                ) {
                                  onDeleteProject(p._id);
                                }
                              }}
                              className="p-1 bg-[#A8442E] text-[#F5EFE3] border border-[#4F5B2A] shadow-[1px_1px_0px_0px_#4F5B2A] hover:brightness-105 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                              title="Delete Project (Admin Role)"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Summary */}
        <div className="bg-[#D8C9A8] border-t-2 border-[#4F5B2A] px-3 py-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#4F5B2A]">
          <div>
            {filteredProjects.length} of {projects.length} Projects
          </div>
        </div>
      </div>
    </div>
  );
};
