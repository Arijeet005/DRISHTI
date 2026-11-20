import type { PrismaClient } from '@prisma/client';
import { supabase } from '../services/supabase';
import { INITIAL_SAMPLE_PROJECTS } from '../data/sampleProjects';
import { ApprovalStage, CompensationStatus, Project, RiskCategory } from '../types/project';

let prismaInstance: PrismaClient | null = null;
let prismaInitPromise: Promise<PrismaClient | null> | null = null;
let prismaUnavailable = false;
let supabaseUnavailableUntil = 0;

function isSupabaseNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = String((err as { message?: string }).message || '').toLowerCase();
  const name = String((err as { name?: string }).name || '').toLowerCase();
  return (
    name === 'timeouterror' ||
    name === 'aborterror' ||
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('eai_again') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('timeout')
  );
}

function canTrySupabase(): boolean {
  return Date.now() >= supabaseUnavailableUntil;
}

function markSupabaseNetworkFailure(err: unknown): void {
  if (isSupabaseNetworkError(err)) {
    supabaseUnavailableUntil = Date.now() + 60_000;
  }
}

function isValidPostgresUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      return false;
    }
    if (!parsed.hostname) return false;
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    // Skip placeholder or passwordless remote URLs (e.g. .env.example template)
    if (!isLocal && !parsed.password) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isPrismaInitOrConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; errorCode?: string; code?: string; message?: string };
  if (e.name === 'PrismaClientInitializationError') return true;
  if (typeof e.code === 'string' && /^P10\d\d$/.test(e.code)) return true;
  const msg = String(e.message || '');
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('did not initialize yet') ||
    msg.includes('Authentication failed') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND')
  );
}

function disablePrisma(reason: unknown): void {
  if (!prismaUnavailable) {
    prismaUnavailable = true;
    const msg =
      reason && typeof reason === 'object' && 'message' in reason
        ? String((reason as { message?: string }).message).split('\n')[0]
        : 'connection unavailable';
    console.info(`[DB] PostgreSQL via Prisma unavailable (${msg}); using active fallback store.`);
  }
  if (prismaInstance) {
    prismaInstance.$disconnect().catch(() => {});
    prismaInstance = null;
  }
  prismaInitPromise = null;
}

export async function getPrisma(): Promise<PrismaClient | null> {
  if (prismaUnavailable || !isValidPostgresUrl(process.env.DATABASE_URL)) {
    return null;
  }
  if (prismaInstance) {
    return prismaInstance;
  }
  if (!prismaInitPromise) {
    prismaInitPromise = (async () => {
      try {
        const { PrismaClient: PrismaClientCtor } = await import('@prisma/client');
        const client = new PrismaClientCtor();
        await Promise.race([
          client.$connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PostgreSQL connection timeout')), 4000)
          ),
        ]);
        prismaInstance = client;
        return client;
      } catch (err) {
        disablePrisma(err);
        return null;
      }
    })();
  }
  return prismaInitPromise;
}

// In-memory store for development/preview when external database is offline or initializing
let memoryStore: Project[] = JSON.parse(JSON.stringify(INITIAL_SAMPLE_PROJECTS)).map((p: Project) => ({
  ...p,
  id: p._id,
}));

function mapRowToProject(row: any): Project {
  const parsedScore = Number(row.riskScore);
  return {
    id: row.id || row._id,
    _id: row.id || row._id,
    name: row.name,
    state: row.state,
    district: row.district,
    landAreaHectares: Number(row.landAreaHectares) || 0,
    familiesAffected: Number(row.familiesAffected) || 0,
    compensationStatus: row.compensationStatus as CompensationStatus,
    approvalStage: row.approvalStage as ApprovalStage,
    legalDisputeFlag: Boolean(row.legalDisputeFlag),
    daysSinceLastUpdate: Number(row.daysSinceLastUpdate) || 0,
    createdByClerkId: row.createdByClerkId || 'user_clerk_seed',
    createdAt:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : row.createdAt
        ? new Date(row.createdAt).toISOString()
        : new Date().toISOString(),
    updatedAt:
      typeof row.updatedAt === 'string'
        ? row.updatedAt
        : row.updatedAt
        ? new Date(row.updatedAt).toISOString()
        : new Date().toISOString(),
    riskScore:
      row.riskScore !== null && row.riskScore !== undefined && Number.isFinite(parsedScore)
        ? parsedScore
        : 0,
    riskCategory: (row.riskCategory as RiskCategory) || 'Low',

    // Stage 7: Parallel Arbitration Flag
    underArbitration: Boolean(row.underArbitration),
    arbitrationRaisedAt: row.arbitrationRaisedAt
      ? typeof row.arbitrationRaisedAt === 'string'
        ? row.arbitrationRaisedAt
        : new Date(row.arbitrationRaisedAt).toISOString()
      : null,

    // Statutory Deadlines
    preliminaryNotificationAt: row.preliminaryNotificationAt
      ? typeof row.preliminaryNotificationAt === 'string'
        ? row.preliminaryNotificationAt
        : new Date(row.preliminaryNotificationAt).toISOString()
      : null,
    objectionsDeadlineAt: row.objectionsDeadlineAt
      ? typeof row.objectionsDeadlineAt === 'string'
        ? row.objectionsDeadlineAt
        : new Date(row.objectionsDeadlineAt).toISOString()
      : null,
    possessionNoticeAt: row.possessionNoticeAt
      ? typeof row.possessionNoticeAt === 'string'
        ? row.possessionNoticeAt
        : new Date(row.possessionNoticeAt).toISOString()
      : null,
    possessionDueAt: row.possessionDueAt
      ? typeof row.possessionDueAt === 'string'
        ? row.possessionDueAt
        : new Date(row.possessionDueAt).toISOString()
      : null,
  };
}

export async function dbFindMany(): Promise<Project[]> {
  // 1. Try Supabase REST Client
  if (canTrySupabase()) {
    try {
      const { data, error } = await supabase
        .from('Project')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) {
        markSupabaseNetworkFailure(error);
      } else if (Array.isArray(data)) {
        if (data.length === 0) {
          // Table exists but is empty -> auto-seed initial projects into Supabase
          const seedPayload = INITIAL_SAMPLE_PROJECTS.map((p) => ({
            id: p._id,
            name: p.name,
            state: p.state,
            district: p.district,
            landAreaHectares: p.landAreaHectares,
            familiesAffected: p.familiesAffected,
            compensationStatus: p.compensationStatus,
            approvalStage: p.approvalStage,
            legalDisputeFlag: p.legalDisputeFlag,
            daysSinceLastUpdate: p.daysSinceLastUpdate,
            createdByClerkId: p.createdByClerkId,
            riskScore: p.riskScore,
            riskCategory: p.riskCategory,
            underArbitration: p.underArbitration || false,
            arbitrationRaisedAt: p.arbitrationRaisedAt || null,
            preliminaryNotificationAt: p.preliminaryNotificationAt || null,
            objectionsDeadlineAt: p.objectionsDeadlineAt || null,
            possessionNoticeAt: p.possessionNoticeAt || null,
            possessionDueAt: p.possessionDueAt || null,
          }));
          const { data: seeded, error: seedErr } = await supabase
            .from('Project')
            .insert(seedPayload)
            .select();
          if (!seedErr && seeded) {
            return seeded.map(mapRowToProject);
          }
        }
        return data.map(mapRowToProject);
      }
    } catch (err) {
      markSupabaseNetworkFailure(err);
    }
  }

  // 2. Try Prisma Postgres
  const client = await getPrisma();
  if (client) {
    try {
      const records = await client.project.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return records.map(mapRowToProject);
    } catch (err) {
      if (isPrismaInitOrConnectionError(err)) {
        disablePrisma(err);
      } else {
        console.warn('[DB] Prisma query failed, using fallback store:', (err as any)?.message || err);
      }
    }
  }

  // 3. Fallback to memoryStore
  return [...memoryStore];
}

export async function dbFindById(id: string): Promise<Project | null> {
  // 1. Try Supabase
  if (canTrySupabase()) {
    try {
      const { data, error } = await supabase
        .from('Project')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        markSupabaseNetworkFailure(error);
      } else if (data) {
        return mapRowToProject(data);
      }
    } catch (err) {
      markSupabaseNetworkFailure(err);
    }
  }

  // 2. Try Prisma
  const client = await getPrisma();
  if (client) {
    try {
      const record = await client.project.findUnique({
        where: { id },
      });
      if (record) {
        return mapRowToProject(record);
      }
    } catch (err) {
      if (isPrismaInitOrConnectionError(err)) {
        disablePrisma(err);
      }
    }
  }

  return memoryStore.find((p) => p.id === id || p._id === id) || null;
}

export async function dbCreate(data: {
  name: string;
  state: string;
  district: string;
  landAreaHectares: number;
  familiesAffected: number;
  compensationStatus: CompensationStatus;
  approvalStage: ApprovalStage;
  legalDisputeFlag: boolean;
  daysSinceLastUpdate: number;
  createdByClerkId: string;
  riskScore: number;
  riskCategory: RiskCategory;
  underArbitration?: boolean;
  arbitrationRaisedAt?: string | null;
  preliminaryNotificationAt?: string | null;
  objectionsDeadlineAt?: string | null;
  possessionNoticeAt?: string | null;
  possessionDueAt?: string | null;
}): Promise<Project> {
  const newId = 'proj-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  const recordPayload = {
    id: newId,
    name: data.name,
    state: data.state,
    district: data.district,
    landAreaHectares: data.landAreaHectares,
    familiesAffected: data.familiesAffected,
    compensationStatus: data.compensationStatus,
    approvalStage: data.approvalStage,
    legalDisputeFlag: data.legalDisputeFlag,
    daysSinceLastUpdate: data.daysSinceLastUpdate,
    createdByClerkId: data.createdByClerkId,
    riskScore: data.riskScore,
    riskCategory: data.riskCategory,
    underArbitration: Boolean(data.underArbitration),
    arbitrationRaisedAt: data.arbitrationRaisedAt || null,
    preliminaryNotificationAt: data.preliminaryNotificationAt || null,
    objectionsDeadlineAt: data.objectionsDeadlineAt || null,
    possessionNoticeAt: data.possessionNoticeAt || null,
    possessionDueAt: data.possessionDueAt || null,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Try Supabase
  if (canTrySupabase()) {
    try {
      const { data: created, error } = await supabase
        .from('Project')
        .insert([recordPayload])
        .select()
        .single();

      if (error) {
        markSupabaseNetworkFailure(error);
      } else if (created) {
        const mapped = mapRowToProject(created);
        memoryStore.unshift(mapped);
        return mapped;
      }
    } catch (err) {
      markSupabaseNetworkFailure(err);
    }
  }

  // 2. Try Prisma
  const client = await getPrisma();
  if (client) {
    try {
      const record = await client.project.create({
        data: {
          id: newId,
          name: data.name,
          state: data.state,
          district: data.district,
          landAreaHectares: data.landAreaHectares,
          familiesAffected: data.familiesAffected,
          compensationStatus: data.compensationStatus,
          approvalStage: data.approvalStage,
          legalDisputeFlag: data.legalDisputeFlag,
          daysSinceLastUpdate: data.daysSinceLastUpdate,
          createdByClerkId: data.createdByClerkId,
          riskScore: data.riskScore,
          riskCategory: data.riskCategory,
          underArbitration: Boolean(data.underArbitration),
          arbitrationRaisedAt: data.arbitrationRaisedAt ? new Date(data.arbitrationRaisedAt) : null,
          preliminaryNotificationAt: data.preliminaryNotificationAt ? new Date(data.preliminaryNotificationAt) : null,
          objectionsDeadlineAt: data.objectionsDeadlineAt ? new Date(data.objectionsDeadlineAt) : null,
          possessionNoticeAt: data.possessionNoticeAt ? new Date(data.possessionNoticeAt) : null,
          possessionDueAt: data.possessionDueAt ? new Date(data.possessionDueAt) : null,
        },
      });
      const mapped = mapRowToProject(record);
      memoryStore.unshift(mapped);
      return mapped;
    } catch (err) {
      if (isPrismaInitOrConnectionError(err)) {
        disablePrisma(err);
      }
    }
  }

  // 3. Fallback to memoryStore
  const newProject: Project = {
    id: newId,
    _id: newId,
    ...data,
    underArbitration: Boolean(data.underArbitration),
    arbitrationRaisedAt: data.arbitrationRaisedAt || null,
    preliminaryNotificationAt: data.preliminaryNotificationAt || null,
    objectionsDeadlineAt: data.objectionsDeadlineAt || null,
    possessionNoticeAt: data.possessionNoticeAt || null,
    possessionDueAt: data.possessionDueAt || null,
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.unshift(newProject);
  return newProject;
}

export async function dbUpdate(
  id: string,
  data: Partial<Project>
): Promise<Project | null> {
  const updateData: any = {
    updatedAt: new Date().toISOString(),
  };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.state !== undefined) updateData.state = data.state;
  if (data.district !== undefined) updateData.district = data.district;
  if (data.landAreaHectares !== undefined) updateData.landAreaHectares = data.landAreaHectares;
  if (data.familiesAffected !== undefined) updateData.familiesAffected = data.familiesAffected;
  if (data.compensationStatus !== undefined) updateData.compensationStatus = data.compensationStatus;
  if (data.approvalStage !== undefined) updateData.approvalStage = data.approvalStage;
  if (data.legalDisputeFlag !== undefined) updateData.legalDisputeFlag = data.legalDisputeFlag;
  if (data.daysSinceLastUpdate !== undefined) updateData.daysSinceLastUpdate = data.daysSinceLastUpdate;
  if (data.riskScore !== undefined) updateData.riskScore = data.riskScore;
  if (data.riskCategory !== undefined) updateData.riskCategory = data.riskCategory;

  if (data.underArbitration !== undefined) updateData.underArbitration = Boolean(data.underArbitration);
  if (data.arbitrationRaisedAt !== undefined) updateData.arbitrationRaisedAt = data.arbitrationRaisedAt;
  if (data.preliminaryNotificationAt !== undefined) updateData.preliminaryNotificationAt = data.preliminaryNotificationAt;
  if (data.objectionsDeadlineAt !== undefined) updateData.objectionsDeadlineAt = data.objectionsDeadlineAt;
  if (data.possessionNoticeAt !== undefined) updateData.possessionNoticeAt = data.possessionNoticeAt;
  if (data.possessionDueAt !== undefined) updateData.possessionDueAt = data.possessionDueAt;

  // 1. Try Supabase
  if (canTrySupabase()) {
    try {
      const { data: updated, error } = await supabase
        .from('Project')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        markSupabaseNetworkFailure(error);
      } else if (updated) {
        const mapped = mapRowToProject(updated);
        const idx = memoryStore.findIndex((p) => p.id === id || p._id === id);
        if (idx !== -1) memoryStore[idx] = mapped;
        return mapped;
      }
    } catch (err) {
      markSupabaseNetworkFailure(err);
    }
  }

  // 2. Try Prisma
  const client = await getPrisma();
  if (client) {
    try {
      const prismaUpdate: any = { ...updateData };
      if (updateData.arbitrationRaisedAt !== undefined) {
        prismaUpdate.arbitrationRaisedAt = updateData.arbitrationRaisedAt ? new Date(updateData.arbitrationRaisedAt) : null;
      }
      if (updateData.preliminaryNotificationAt !== undefined) {
        prismaUpdate.preliminaryNotificationAt = updateData.preliminaryNotificationAt ? new Date(updateData.preliminaryNotificationAt) : null;
      }
      if (updateData.objectionsDeadlineAt !== undefined) {
        prismaUpdate.objectionsDeadlineAt = updateData.objectionsDeadlineAt ? new Date(updateData.objectionsDeadlineAt) : null;
      }
      if (updateData.possessionNoticeAt !== undefined) {
        prismaUpdate.possessionNoticeAt = updateData.possessionNoticeAt ? new Date(updateData.possessionNoticeAt) : null;
      }
      if (updateData.possessionDueAt !== undefined) {
        prismaUpdate.possessionDueAt = updateData.possessionDueAt ? new Date(updateData.possessionDueAt) : null;
      }

      const record = await client.project.update({
        where: { id },
        data: prismaUpdate,
      });
      const mapped = mapRowToProject(record);
      const idx = memoryStore.findIndex((p) => p.id === id || p._id === id);
      if (idx !== -1) memoryStore[idx] = mapped;
      return mapped;
    } catch (err) {
      if (isPrismaInitOrConnectionError(err)) {
        disablePrisma(err);
      }
    }
  }

  // 3. Fallback to memoryStore
  const index = memoryStore.findIndex((p) => p.id === id || p._id === id);
  if (index === -1) return null;

  const existing = memoryStore[index];
  const updated: Project = {
    ...existing,
    ...data,
    id: existing.id || existing._id,
    _id: existing._id,
    updatedAt: new Date().toISOString(),
  };
  memoryStore[index] = updated;
  return updated;
}

export async function dbDelete(id: string): Promise<boolean> {
  // 1. Try Supabase
  if (canTrySupabase()) {
    try {
      const { error } = await supabase
        .from('Project')
        .delete()
        .eq('id', id);

      if (error) {
        markSupabaseNetworkFailure(error);
      } else {
        const idx = memoryStore.findIndex((p) => p.id === id || p._id === id);
        if (idx !== -1) memoryStore.splice(idx, 1);
        return true;
      }
    } catch (err) {
      markSupabaseNetworkFailure(err);
    }
  }

  // 2. Try Prisma
  const client = await getPrisma();
  if (client) {
    try {
      await client.project.delete({
        where: { id },
      });
      const idx = memoryStore.findIndex((p) => p.id === id || p._id === id);
      if (idx !== -1) memoryStore.splice(idx, 1);
      return true;
    } catch (err) {
      if (isPrismaInitOrConnectionError(err)) {
        disablePrisma(err);
      }
    }
  }

  const index = memoryStore.findIndex((p) => p.id === id || p._id === id);
  if (index === -1) return false;
  memoryStore.splice(index, 1);
  return true;
}

export async function dbResetSeed(): Promise<Project[]> {
  const seedData = INITIAL_SAMPLE_PROJECTS.map((p) => ({
    id: p._id,
    name: p.name,
    state: p.state,
    district: p.district,
    landAreaHectares: p.landAreaHectares,
    familiesAffected: p.familiesAffected,
    compensationStatus: p.compensationStatus as CompensationStatus,
    approvalStage: p.approvalStage as ApprovalStage,
    legalDisputeFlag: p.legalDisputeFlag,
    daysSinceLastUpdate: p.daysSinceLastUpdate,
    createdByClerkId: p.createdByClerkId,
    riskScore: p.riskScore,
    riskCategory: p.riskCategory as RiskCategory,
    underArbitration: Boolean(p.underArbitration),
    arbitrationRaisedAt: p.arbitrationRaisedAt || null,
    preliminaryNotificationAt: p.preliminaryNotificationAt || null,
    objectionsDeadlineAt: p.objectionsDeadlineAt || null,
    possessionNoticeAt: p.possessionNoticeAt || null,
    possessionDueAt: p.possessionDueAt || null,
  }));

  // 1. Try Supabase
  if (canTrySupabase()) {
    try {
      const { error: delErr } = await supabase
        .from('Project')
        .delete()
        .neq('id', 'placeholder_impossible_id');
      if (delErr) {
        markSupabaseNetworkFailure(delErr);
      } else {
        const { data: seeded, error } = await supabase
          .from('Project')
          .insert(seedData)
          .select();

        if (error) {
          markSupabaseNetworkFailure(error);
        } else if (seeded) {
          memoryStore = seeded.map(mapRowToProject);
          return memoryStore;
        }
      }
    } catch (err) {
      markSupabaseNetworkFailure(err);
    }
  }

  // 2. Try Prisma
  const client = await getPrisma();
  if (client) {
    try {
      await client.project.deleteMany({});
      await client.project.createMany({
        data: seedData.map((s) => ({
          ...s,
          arbitrationRaisedAt: s.arbitrationRaisedAt ? new Date(s.arbitrationRaisedAt) : null,
          preliminaryNotificationAt: s.preliminaryNotificationAt ? new Date(s.preliminaryNotificationAt) : null,
          objectionsDeadlineAt: s.objectionsDeadlineAt ? new Date(s.objectionsDeadlineAt) : null,
          possessionNoticeAt: s.possessionNoticeAt ? new Date(s.possessionNoticeAt) : null,
          possessionDueAt: s.possessionDueAt ? new Date(s.possessionDueAt) : null,
        })),
      });
      const refreshed = await client.project.findMany({ orderBy: { createdAt: 'desc' } });
      memoryStore = refreshed.map(mapRowToProject);
      return memoryStore;
    } catch (err) {
      if (isPrismaInitOrConnectionError(err)) {
        disablePrisma(err);
      }
    }
  }

  // 3. Fallback memoryStore
  memoryStore = JSON.parse(JSON.stringify(INITIAL_SAMPLE_PROJECTS)).map((p: Project) => ({
    ...p,
    id: p._id,
  }));
  return [...memoryStore];
}
