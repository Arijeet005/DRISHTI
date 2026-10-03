import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/project';
import { X, Check } from 'lucide-react';

interface RoleSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleSwitchModal: React.FC<RoleSwitchModalProps> = ({ isOpen, onClose }) => {
  const { role, switchRole, isClerkConfigured } = useAuth();

  if (!isOpen) return null;

  const rolesList: {
    id: UserRole;
    name: string;
    title: string;
    description: string;
    clerkId: string;
    badgeBg: string;
    badgeText: string;
    permissions: string[];
  }[] = [
    {
      id: 'Admin',
      name: 'Vikramaditya Sharma',
      title: 'Principal Land Commissioner',
      description: 'Unrestricted authorization. Full CRUD across all projects, database reset, and ML recalibration.',
      clerkId: 'user_clerk_admin_01',
      badgeBg: 'bg-[#A8442E]',
      badgeText: 'text-[#F5EFE3]',
      permissions: ['Create Projects', 'Update Projects', 'Delete Projects', 'Run /ml/predict', 'Reset Database'],
    },
    {
      id: 'Officer',
      name: 'Ananya Deshmukh',
      title: 'Revenue & Valuation Officer',
      description: 'Field & administrative officer. Can create projects and update compensation/progress stages.',
      clerkId: 'user_clerk_officer_02',
      badgeBg: 'bg-[#B8892D]',
      badgeText: 'text-[#F5EFE3]',
      permissions: ['Create Projects', 'Update Projects', 'Inspect Details', 'Run /ml/predict'],
    },
    {
      id: 'Viewer',
      name: 'Rajesh Ramanathan',
      title: 'State Planning Auditor',
      description: 'Read-only external auditor. Inspects risk analytics, project metrics, and ML outputs.',
      clerkId: 'user_clerk_viewer_03',
      badgeBg: 'bg-[#4F5B2A]',
      badgeText: 'text-[#F5EFE3]',
      permissions: ['View Dashboard', 'Inspect Project Details', 'View ML Risk Scores', 'Read Only'],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#4F5B2A]/70 flex items-center justify-center p-2 sm:p-4 overflow-y-auto backdrop-blur-none">
      <div
        id="role-switch-modal"
        className="bg-[#F5EFE3] border-2 border-[#4F5B2A] shadow-[8px_8px_0px_0px_#4F5B2A] w-full max-w-xl my-4 relative"
      >
        <div className="bg-[#4F5B2A] text-[#F5EFE3] p-3 sm:p-3.5 border-b-2 border-[#4F5B2A] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.2 text-[9px] font-black uppercase bg-[#B8892D] text-[#F5EFE3] border border-[#4F5B2A]">
                RBAC
              </span>
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-[#F5EFE3] mt-0.5">
              Role Switcher
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 bg-[#F5EFE3] text-[#4F5B2A] border border-[#4F5B2A] shadow-[1px_1px_0px_0px_#4F5B2A] hover:bg-[#D8C9A8] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        <div className="p-3.5 sm:p-4 space-y-2.5 max-h-[70vh] overflow-y-auto">
          {rolesList.map((item) => {
            const isSelected = role === item.id;
            return (
              <div
                key={item.id}
                onClick={() => {
                  switchRole(item.id);
                  onClose();
                }}
                className={`p-2.5 sm:p-3 border-2 border-[#4F5B2A] transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#D8C9A8] shadow-[3px_3px_0px_0px_#4F5B2A] -translate-y-0.5'
                    : 'bg-[#F5EFE3] hover:bg-[#D8C9A8]/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.2 text-[9px] font-black uppercase border border-[#4F5B2A] ${item.badgeBg} ${item.badgeText}`}
                      >
                        {item.id}
                      </span>
                      <span className="font-black text-xs sm:text-sm uppercase text-[#4F5B2A]">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-[#4F5B2A]/80">{item.title}</div>
                  </div>

                  {isSelected && (
                    <span className="px-1.5 py-0.5 bg-[#4F5B2A] text-[#F5EFE3] text-[9px] font-black uppercase flex items-center gap-1 border border-[#4F5B2A]">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1 pt-1.5 border-t border-[#4F5B2A]/20">
                  {item.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="px-1 py-0.2 text-[9px] font-bold uppercase bg-[#F5EFE3] border border-[#4F5B2A] text-[#4F5B2A]"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-[#D8C9A8] border-t-2 border-[#4F5B2A] p-2.5 sm:p-3 flex items-center justify-end text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#4F5B2A] text-[#F5EFE3] font-bold uppercase text-xs border border-[#4F5B2A] shadow-[2px_2px_0px_0px_#B8892D]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
