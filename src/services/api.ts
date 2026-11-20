import { Project, PredictRequest, PredictResponse } from '../types/project';
import { calculateRiskPrediction } from './mlPredictor';
import { INITIAL_SAMPLE_PROJECTS } from '../data/sampleProjects';

const STORAGE_KEY = 'landacq_tier1_projects_v1';

function getCurrentRoleHeader(): string {
  try {
    const saved = localStorage.getItem('landacq_user_role');
    if (saved === 'Admin' || saved === 'Officer' || saved === 'Viewer') {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'Admin';
}

function getLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_PROJECTS));
      return INITIAL_SAMPLE_PROJECTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SAMPLE_PROJECTS;
  }
}

function saveLocalProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

export const api = {
  async getProjects(): Promise<Project[]> {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        saveLocalProjects(data);
        return data;
      }
    } catch {
      // Fallback to local store
    }
    return getLocalProjects();
  },

  async getProjectById(id: string): Promise<Project | null> {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const projects = getLocalProjects();
    return projects.find((p) => p._id === id) || null;
  },

  async createProject(
    payload: Omit<Project, '_id' | 'createdAt' | 'updatedAt' | 'riskScore' | 'riskCategory'>
  ): Promise<Project> {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': getCurrentRoleHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        const current = getLocalProjects();
        saveLocalProjects([created, ...current]);
        return created;
      }
      if (res.status >= 400 && res.status < 500) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create project');
      }
    } catch (err: any) {
      if (err?.message && !err.message.toLowerCase().includes('fetch')) {
        throw err;
      }
    }

    // Local fallback creation
    const prediction = calculateRiskPrediction({
      landAreaHectares: payload.landAreaHectares,
      familiesAffected: payload.familiesAffected,
      compensationStatus: payload.compensationStatus,
      approvalStage: payload.approvalStage,
      legalDisputeFlag: payload.legalDisputeFlag,
      daysSinceLastUpdate: payload.daysSinceLastUpdate,
      underArbitration: payload.underArbitration,
    });

    const now = new Date().toISOString();
    const newProject: Project = {
      ...payload,
      _id: 'proj-' + Math.random().toString(36).substring(2, 9),
      createdAt: now,
      updatedAt: now,
      riskScore: prediction.riskScore,
      riskCategory: prediction.riskCategory,
    };

    const current = getLocalProjects();
    const updated = [newProject, ...current];
    saveLocalProjects(updated);
    return newProject;
  },

  async updateProject(id: string, payload: Partial<Project>): Promise<Project> {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': getCurrentRoleHeader(),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updatedProj = await res.json();
        const current = getLocalProjects();
        const updatedList = current.map((p) => (p._id === id ? updatedProj : p));
        saveLocalProjects(updatedList);
        return updatedProj;
      }
      if (res.status >= 400 && res.status < 500) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update project');
      }
    } catch (err: any) {
      if (err?.message && !err.message.toLowerCase().includes('fetch')) {
        throw err;
      }
    }

    const current = getLocalProjects();
    const existing = current.find((p) => p._id === id);
    if (!existing) {
      throw new Error('Project not found');
    }

    const merged = { ...existing, ...payload };
    const prediction = calculateRiskPrediction({
      landAreaHectares: merged.landAreaHectares,
      familiesAffected: merged.familiesAffected,
      compensationStatus: merged.compensationStatus,
      approvalStage: merged.approvalStage,
      legalDisputeFlag: merged.legalDisputeFlag,
      daysSinceLastUpdate: merged.daysSinceLastUpdate,
      underArbitration: merged.underArbitration,
    });

    const updatedProject: Project = {
      ...merged,
      updatedAt: new Date().toISOString(),
      riskScore: prediction.riskScore,
      riskCategory: prediction.riskCategory,
    };

    const updatedList = current.map((p) => (p._id === id ? updatedProject : p));
    saveLocalProjects(updatedList);
    return updatedProject;
  },

  async updateArbitration(id: string, underArbitration: boolean): Promise<Project> {
    try {
      const res = await fetch(`/api/projects/${id}/arbitration`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': getCurrentRoleHeader(),
        },
        body: JSON.stringify({ underArbitration }),
      });
      if (res.ok) {
        const data = await res.json();
        const updatedProj = data.project;
        const current = getLocalProjects();
        const updatedList = current.map((p) => (p._id === id ? updatedProj : p));
        saveLocalProjects(updatedList);
        return updatedProj;
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update arbitration status');
      }
    } catch (err: any) {
      if (err.message && !err.message.toLowerCase().includes('fetch')) {
        throw err;
      }
    }

    // Local fallback
    const current = getLocalProjects();
    const existing = current.find((p) => p._id === id);
    if (!existing) throw new Error('Project not found');

    const updatedProject: Project = {
      ...existing,
      underArbitration,
      arbitrationRaisedAt: underArbitration ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    const updatedList = current.map((p) => (p._id === id ? updatedProject : p));
    saveLocalProjects(updatedList);
    return updatedProject;
  },

  async deleteProject(id: string): Promise<void> {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': getCurrentRoleHeader(),
        },
      });
      if (!res.ok && res.status >= 400 && res.status < 500) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete project');
      }
    } catch (err: any) {
      if (err?.message && !err.message.toLowerCase().includes('fetch')) {
        throw err;
      }
    }
    const current = getLocalProjects();
    saveLocalProjects(current.filter((p) => p._id !== id));
  },

  async predictRisk(request: PredictRequest): Promise<PredictResponse> {
    try {
      const res = await fetch('/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Local fallback
    }
    return calculateRiskPrediction(request);
  },

  async resetToSample(): Promise<Project[]> {
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.projects)) {
          saveLocalProjects(data.projects);
          return data.projects;
        }
      }
    } catch {
      // Local fallback
    }
    saveLocalProjects(INITIAL_SAMPLE_PROJECTS);
    return INITIAL_SAMPLE_PROJECTS;
  },

  async chat(payload: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    activeProjectId?: string | null;
  }): Promise<{ reply: string; toolsUsed: string[]; model: string }> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': getCurrentRoleHeader(),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Chat request failed (${res.status})`);
    }
    return data;
  },
};
