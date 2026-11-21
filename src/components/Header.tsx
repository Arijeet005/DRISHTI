import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, LayoutDashboard, Database, Cpu, UserCheck } from 'lucide-react';

interface HeaderProps {
  currentTab: 'dashboard' | 'projects' | 'new' | 'ml';
  onSelectTab: (tab: 'dashboard' | 'projects' | 'new' | 'ml') => void;
  onOpenRoleModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenRoleModal,
}) => {
  const { user, role } = useAuth();

  const getRoleBadgeStyle = () => {
    switch (role) {
      case 'Admin':
        return 'bg-[#4F5B2A] text-[#F5EFE3]';
      case 'Officer':
        return 'bg-[#B8892D] text-[#F5EFE3]';
      case 'Viewer':
        return 'bg-[#D8C9A8] text-[#4F5B2A]';
      default:
        return 'bg-[#F5EFE3] text-[#4F5B2A]';
    }
  };

  return (
    <header className="w-full bg-[#F5EFE3] border-b-2 border-[#4F5B2A] z-30 sticky top-0 shadow-sm">
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6">
        <div className="py-2 sm:py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          {/* Brand Mark & Title */}
          <div className="flex items-center gap-3">
            {/* Geometric Identity Mark */}
            <div className="flex items-center gap-1 p-1 bg-[#D8C9A8] border-2 border-[#4F5B2A] shadow-[2px_2px_0px_0px_#4F5B2A]">
              <div
                className="w-4 h-4 rounded-full bg-[#B8892D] border border-[#4F5B2A]"
                title="Perception (दृष्टि)"
              />
              <div
                className="w-4 h-4 bg-[#4F5B2A] border border-[#4F5B2A]"
                title="Structure (आधार)"
              />
              <div
                className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-[#B8892D]"
                title="Direction (दिशा)"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight leading-none text-[#4F5B2A]">
                  DRISHTI <span className="font-semibold text-xs sm:text-sm text-[#B8892D] tracking-normal font-sans">(दृष्टि)</span>
                </h1>
                <span className="inline-block px-1.5 py-0.2 text-[9px] font-black uppercase tracking-widest bg-[#4F5B2A] text-[#F5EFE3] border border-[#4F5B2A]">
                  RISK INTELLIGENCE
                </span>
              </div>
            </div>
          </div>

          {/* User / Clerk session & Role controller */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              id="auth-role-switcher-btn"
              onClick={onOpenRoleModal}
              className="flex items-center gap-2 px-2.5 py-1 bg-[#D8C9A8] border-2 border-[#4F5B2A] shadow-[2px_2px_0px_0px_#4F5B2A] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all text-xs font-bold uppercase text-[#4F5B2A]"
              title="Click to switch simulated Clerk user & RBAC role"
            >
              <div className="relative">
                <img
                  src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces'}
                  alt={user?.name || 'User'}
                  className="w-5 h-5 border border-[#4F5B2A] object-cover rounded-none"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#4F5B2A] border border-[#F5EFE3] rounded-full" />
              </div>
              <div className="text-left hidden sm:block">
                <div className="leading-tight text-[11px] font-black tracking-tight text-[#4F5B2A]">
                  {user?.name?.split(' ')[0]}
                </div>
              </div>
              <span
                className={`px-1.5 py-0.2 text-[9px] font-black uppercase border border-[#4F5B2A] ${getRoleBadgeStyle()}`}
              >
                {role}
              </span>
              <UserCheck className="w-3 h-3 ml-0.5 text-[#4F5B2A]" />
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none">
          <button
            id="nav-tab-dashboard"
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 border-[#4F5B2A] transition-all ${
              currentTab === 'dashboard'
                ? 'bg-[#4F5B2A] text-[#F5EFE3] shadow-[3px_3px_0px_0px_#B8892D] -translate-y-0.5'
                : 'bg-[#F5EFE3] text-[#4F5B2A] hover:bg-[#D8C9A8]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            id="nav-tab-projects"
            onClick={() => onSelectTab('projects')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 border-[#4F5B2A] transition-all ${
              currentTab === 'projects'
                ? 'bg-[#4F5B2A] text-[#F5EFE3] shadow-[3px_3px_0px_0px_#B8892D] -translate-y-0.5'
                : 'bg-[#F5EFE3] text-[#4F5B2A] hover:bg-[#D8C9A8]'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Project Registry</span>
          </button>

          <button
            id="nav-tab-new-project"
            onClick={() => onSelectTab('new')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 border-[#4F5B2A] transition-all ${
              currentTab === 'new'
                ? 'bg-[#B8892D] text-[#F5EFE3] shadow-[3px_3px_0px_0px_#4F5B2A] -translate-y-0.5'
                : 'bg-[#B8892D] text-[#F5EFE3] hover:opacity-90 shadow-[2px_2px_0px_0px_#4F5B2A]'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Project</span>
          </button>

          <button
            id="nav-tab-ml-simulator"
            onClick={() => onSelectTab('ml')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 border-[#4F5B2A] transition-all ${
              currentTab === 'ml'
                ? 'bg-[#D8C9A8] text-[#4F5B2A] shadow-[3px_3px_0px_0px_#4F5B2A] -translate-y-0.5 font-black'
                : 'bg-[#F5EFE3] text-[#4F5B2A] hover:bg-[#D8C9A8]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>ML /predict API</span>
          </button>
        </div>
      </div>
    </header>
  );
};
