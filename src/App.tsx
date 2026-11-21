import React, { useState, useEffect } from 'react';
import { Project } from './types/project';
import { api } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ProjectListView } from './components/ProjectListView';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { ProjectFormModal } from './components/ProjectFormModal';
import { MlSimulatorView } from './components/MlSimulatorView';
import { RoleSwitchModal } from './components/RoleSwitchModal';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

function AppContent() {
  const { role } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'projects' | 'new' | 'ml'>('dashboard');

  // Modal states
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      showToast('Error loading project registry', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (
    data: Omit<Project, '_id' | 'createdAt' | 'updatedAt' | 'riskScore' | 'riskCategory'>
  ) => {
    try {
      const created = await api.createProject(data);
      setProjects((prev) => [created, ...prev]);
      showToast(
        `Project created! ML Risk Score: ${created.riskScore}/100 (${created.riskCategory.toUpperCase()})`,
        'success'
      );
      setCurrentTab('projects');
    } catch (err) {
      console.error('Error creating project:', err);
      showToast('Failed to create project', 'error');
    }
  };

  const handleUpdateProject = async (
    data: Omit<Project, '_id' | 'createdAt' | 'updatedAt' | 'riskScore' | 'riskCategory'>
  ) => {
    if (!editingProject) return;
    try {
      const updated = await api.updateProject(editingProject._id, data);
      setProjects((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      showToast(
        `Project updated! New ML Risk Score: ${updated.riskScore}/100 (${updated.riskCategory.toUpperCase()})`,
        'success'
      );
      setEditingProject(null);
    } catch (err: any) {
      console.error('Error updating project:', err);
      showToast(err?.message || 'Failed to update project', 'error');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await api.deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      showToast('Project record removed from registry', 'info');
      if (selectedProject?._id === projectId) {
        setSelectedProject(null);
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      showToast('Failed to delete project', 'error');
    }
  };

  const handleResetSeed = async () => {
    try {
      const resetList = await api.resetToSample();
      setProjects(resetList);
      showToast('Database reset to official 10-row CSV seed dataset', 'info');
    } catch (err) {
      console.error('Error resetting seed:', err);
      showToast('Failed to reset dataset', 'error');
    }
  };

  const handleSelectTab = (tab: 'dashboard' | 'projects' | 'new' | 'ml') => {
    if (tab === 'new') {
      if (role === 'Viewer') {
        showToast('Viewers have read-only access. Switch to Admin or Officer to add projects.', 'info');
        return;
      }
      setEditingProject(null);
      setIsFormOpen(true);
    } else {
      setCurrentTab(tab);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5EFE3] text-[#4F5B2A] flex flex-col selection:bg-[#B8892D] selection:text-[#F5EFE3]">
      {/* Top Navigation */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenRoleModal={() => setIsRoleModalOpen(true)}
      />

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-md animate-in slide-in-from-top-2 duration-200">
          <div
            className={`p-4 border-4 border-[#4F5B2A] font-bold text-xs uppercase tracking-wider flex items-center gap-3 shadow-[6px_6px_0px_0px_#4F5B2A] ${
              toastMessage.type === 'success'
                ? 'bg-[#B8892D] text-[#F5EFE3]'
                : toastMessage.type === 'error'
                ? 'bg-[#A8442E] text-[#F5EFE3]'
                : 'bg-[#4F5B2A] text-[#F5EFE3]'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-[#F5EFE3]" />
            ) : toastMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-[#F5EFE3]" />
            ) : (
              <Info className="w-5 h-5 flex-shrink-0 text-[#B8892D]" />
            )}
            <span className="flex-1">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Viewport Container */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block p-3 border-4 border-[#4F5B2A] bg-[#F5EFE3] shadow-[4px_4px_0px_0px_#4F5B2A]">
              <div className="w-6 h-6 border-3 border-[#4F5B2A] border-t-[#B8892D] animate-spin mx-auto" />
              <div className="mt-2 text-[11px] font-black uppercase tracking-widest text-[#4F5B2A]">
                INITIALIZING DRISHTI ML REGISTRY...
              </div>
            </div>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                projects={projects}
                onSelectProject={(p) => setSelectedProject(p)}
                onNavigateProjects={() => setCurrentTab('projects')}
                onNavigateNew={() => handleSelectTab('new')}
              />
            )}

            {currentTab === 'projects' && (
              <ProjectListView
                projects={projects}
                onSelectProject={(p) => setSelectedProject(p)}
                onEditProject={(p) => {
                  setEditingProject(p);
                  setIsFormOpen(true);
                }}
                onDeleteProject={handleDeleteProject}
                onOpenNew={() => handleSelectTab('new')}
                onResetSeed={handleResetSeed}
              />
            )}

            {currentTab === 'ml' && <MlSimulatorView />}
          </>
        )}
      </main>

      {/* Application Footer */}
      <footer className="bg-[#D8C9A8] border-t-2 border-[#4F5B2A] mt-auto py-2">
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#4F5B2A]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[#4F5B2A] border border-[#4F5B2A] inline-block" />
              <span className="w-2 h-2 bg-[#B8892D] border border-[#4F5B2A] inline-block" />
              <span className="w-2 h-2 bg-[#A8442E] border border-[#4F5B2A] inline-block" />
            </div>
            <span>DRISHTI</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ProjectDetailModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onEdit={(p) => {
          setEditingProject(p);
          setIsFormOpen(true);
        }}
        onProjectUpdated={(updated) => {
          setSelectedProject(updated);
          setProjects((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
          showToast('Updated arbitration status under Section 3G(5)', 'success');
        }}
      />

      <ProjectFormModal
        isOpen={isFormOpen}
        project={editingProject}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProject(null);
        }}
        onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
      />

      <RoleSwitchModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
