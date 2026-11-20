import { Content, FunctionDeclaration, GoogleGenAI, Part, ThinkingLevel, Type } from '@google/genai';
import { calculateRiskPrediction } from '../services/mlPredictor';
import { ApprovalStage, CompensationStatus, Project } from '../types/project';
import { dbFindById, dbFindMany } from './db';

export interface ChatTurnMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DrishtiChatRequest {
  messages: ChatTurnMessage[];
  activeProjectId?: string | null;
  userRole?: string;
}

export interface DrishtiChatResponse {
  reply: string;
  toolsUsed: string[];
  model: string;
}

export class GeminiConfigError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'GeminiConfigError';
    this.statusCode = statusCode;
  }
}

const MODEL_NAME = 'gemini-4-hydrogen';

const SYSTEM_INSTRUCTION = `You are the DRISHTI (दृष्टि) Land Acquisition & Risk Intelligence Assistant, an expert advisor on Indian infrastructure land acquisition under the National Highways Act, 1956 and the RFCTLARR Act, 2013.

Domain Knowledge you enforce accurately:
1. Statutory 7-Stage Lifecycle:
   - Stage 1 (Drafting): Feasibility, DPR/survey, Social Impact Assessment (Sec. 4 RFCTLARR / Sec. 3(a) CALA appointment).
   - Stage 2 (PreliminaryNotification): Gazette & 2-newspaper publication (Sec. 3A NH Act / Sec. 11 RFCTLARR); initiates 21-day objection window.
   - Stage 3 (ObjectionsHearing): CALA hearing of khatedar objections & valuation grievances (Sec. 3C NH Act / Sec. 15 RFCTLARR).
   - Stage 4 (DeclarationVesting): Formal declaration; land vests absolutely in Central/State Govt free of encumbrances (Sec. 3D NH Act / Sec. 19 RFCTLARR).
   - Stage 5 (AwardAnnounced): CALA announces compensation award matrix + solatium (Sec. 3G NH Act / Sec. 23 RFCTLARR).
   - Stage 6 (PossessionTaken): 60-day Sec. 3E notice served and physical possession taken (Sec. 3E/3F NH Act / Sec. 38 RFCTLARR).
   - Stage 7 (underArbitration — Parallel Non-Blocking Track): Section 3G(5) arbitration before Central Government Arbitrator contesting compensation quantum. Admissible from Stage 5 onward and explicitly DOES NOT halt or delay physical possession.

2. ML Risk Model (18 Features -> Low / Medium / High + 0–100 score):
   - Core inputs: project_type, state, land_area_hectares, total_parcels, private_land_pct, forest_land_pct, govt_land_pct, affected_families_count, rr_settlement_status, forest_clearance_stage, env_clearance_stage, circle_rate_per_sqm, compensation_disbursed_pct, cadastral_survey_discrepancy, active_litigations_count, stay_order_present, inter_agency_nocs_pending, historical_district_delay_score.

Operational Rules:
- Always call your tools to inspect live project records, portfolio aggregates, or run real ML risk predictions before quoting numbers, project statuses, or simulation scores. Never invent project IDs or risk scores.
- Keep answers concise, structured, and actionable for Commissioners, Revenue Officers, and Planning Auditors.
- Use clear Markdown headings, bullet points, and bold statutory citations when helpful.`;

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_portfolio_summary',
    description:
      'Get live aggregate statistics across all land acquisition projects in DRISHTI, including counts by risk category, total hectares, displaced families, compensation status breakdown, active litigations, Sec. 3G(5) arbitrations, and top highest-risk projects.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'list_projects',
    description:
      'List live projects from the DRISHTI registry with optional filters for risk category, state, approval stage, arbitration status, or search text.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        riskCategory: {
          type: Type.STRING,
          description: 'Filter by risk level: Low, Medium, or High',
        },
        state: {
          type: Type.STRING,
          description: 'Filter by Indian state name (partial match allowed)',
        },
        approvalStage: {
          type: Type.STRING,
          description:
            'Filter by stage: Drafting, PreliminaryNotification, ObjectionsHearing, DeclarationVesting, AwardAnnounced, or PossessionTaken',
        },
        underArbitration: {
          type: Type.BOOLEAN,
          description: 'Filter projects with active Stage 7 Sec. 3G(5) arbitration',
        },
        search: {
          type: Type.STRING,
          description: 'Search text matching project name, district, or state',
        },
      },
    },
  },
  {
    name: 'get_project_details',
    description:
      'Fetch complete statutory details, deadlines, and risk factor attribution for a specific project by project ID or project name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectId: {
          type: Type.STRING,
          description: 'The exact project ID (e.g. proj-001)',
        },
        projectName: {
          type: Type.STRING,
          description: 'Project name or partial name if exact ID is unknown',
        },
      },
    },
  },
  {
    name: 'predict_project_risk',
    description:
      'Run the DRISHTI ML risk prediction pipeline (live Render model or calibrated engine) for given project parameters or what-if scenarios.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: 'Optional project name' },
        state: { type: Type.STRING, description: 'Indian state name (e.g. Maharashtra)' },
        landAreaHectares: { type: Type.NUMBER, description: 'Land area in hectares' },
        familiesAffected: { type: Type.NUMBER, description: 'Affected families count' },
        compensationStatus: {
          type: Type.STRING,
          description: 'Pending, PartiallyPaid, or Paid',
        },
        approvalStage: {
          type: Type.STRING,
          description:
            'Drafting, PreliminaryNotification, ObjectionsHearing, DeclarationVesting, AwardAnnounced, or PossessionTaken',
        },
        legalDisputeFlag: {
          type: Type.BOOLEAN,
          description: 'Whether active court litigation or stay order exists',
        },
        daysSinceLastUpdate: {
          type: Type.NUMBER,
          description: 'Days dormant since last administrative update',
        },
        underArbitration: {
          type: Type.BOOLEAN,
          description: 'Whether Sec. 3G(5) arbitration is active (Stage 5+)',
        },
      },
      required: [
        'landAreaHectares',
        'familiesAffected',
        'compensationStatus',
        'approvalStage',
        'legalDisputeFlag',
        'daysSinceLastUpdate',
      ],
    },
  },
];

function summarizeProject(p: Project) {
  return {
    id: p._id,
    name: p.name,
    state: p.state,
    district: p.district,
    landAreaHectares: p.landAreaHectares,
    familiesAffected: p.familiesAffected,
    compensationStatus: p.compensationStatus,
    approvalStage: p.approvalStage,
    legalDisputeFlag: p.legalDisputeFlag,
    underArbitration: p.underArbitration,
    daysSinceLastUpdate: p.daysSinceLastUpdate,
    riskScore: p.riskScore,
    riskCategory: p.riskCategory,
    objectionsDeadlineAt: p.objectionsDeadlineAt || null,
    possessionDueAt: p.possessionDueAt || null,
  };
}

export type PredictExecutor = (input: any) => Promise<any>;

async function executeToolCall(
  name: string,
  args: Record<string, any>,
  predictExecutor: PredictExecutor
): Promise<Record<string, any>> {
  if (name === 'get_portfolio_summary') {
    const projects = await dbFindMany();
    const sorted = [...projects].sort((a, b) => b.riskScore - a.riskScore);
    return {
      totalProjects: projects.length,
      riskBreakdown: {
        high: projects.filter((p) => p.riskCategory === 'High').length,
        medium: projects.filter((p) => p.riskCategory === 'Medium').length,
        low: projects.filter((p) => p.riskCategory === 'Low').length,
      },
      totalHectares: projects.reduce((sum, p) => sum + p.landAreaHectares, 0),
      totalFamiliesAffected: projects.reduce((sum, p) => sum + p.familiesAffected, 0),
      compensationBreakdown: {
        pending: projects.filter((p) => p.compensationStatus === 'Pending').length,
        partiallyPaid: projects.filter((p) => p.compensationStatus === 'PartiallyPaid').length,
        paid: projects.filter((p) => p.compensationStatus === 'Paid').length,
      },
      activeLegalDisputes: projects.filter((p) => p.legalDisputeFlag).length,
      activeArbitrationsSec3G5: projects.filter((p) => p.underArbitration).length,
      highestRiskProjects: sorted.slice(0, 5).map(summarizeProject),
    };
  }

  if (name === 'list_projects') {
    let projects = await dbFindMany();
    if (args.riskCategory) {
      const target = String(args.riskCategory).toLowerCase();
      projects = projects.filter((p) => p.riskCategory.toLowerCase() === target);
    }
    if (args.state) {
      const target = String(args.state).toLowerCase();
      projects = projects.filter((p) => p.state.toLowerCase().includes(target));
    }
    if (args.approvalStage) {
      const target = String(args.approvalStage).toLowerCase();
      projects = projects.filter((p) => p.approvalStage.toLowerCase() === target);
    }
    if (typeof args.underArbitration === 'boolean') {
      projects = projects.filter((p) => Boolean(p.underArbitration) === args.underArbitration);
    }
    if (args.search) {
      const q = String(args.search).toLowerCase();
      projects = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.district.toLowerCase().includes(q) ||
          p.state.toLowerCase().includes(q)
      );
    }
    return {
      count: projects.length,
      projects: projects.map(summarizeProject),
    };
  }

  if (name === 'get_project_details') {
    let project: Project | null = null;
    if (args.projectId) {
      project = await dbFindById(String(args.projectId));
    }
    if (!project && args.projectName) {
      const q = String(args.projectName).toLowerCase();
      const all = await dbFindMany();
      project = all.find((p) => p.name.toLowerCase().includes(q) || p._id.toLowerCase() === q) || null;
    }
    if (!project) {
      return { error: 'Project not found in registry.' };
    }
    const factorAnalysis = calculateRiskPrediction({
      landAreaHectares: project.landAreaHectares,
      familiesAffected: project.familiesAffected,
      compensationStatus: project.compensationStatus,
      approvalStage: project.approvalStage,
      legalDisputeFlag: project.legalDisputeFlag,
      daysSinceLastUpdate: project.daysSinceLastUpdate,
      underArbitration: project.underArbitration,
    });
    return {
      project: summarizeProject(project),
      statutoryDeadlines: {
        preliminaryNotificationAt: project.preliminaryNotificationAt || null,
        objectionsDeadlineAt: project.objectionsDeadlineAt || null,
        possessionNoticeAt: project.possessionNoticeAt || null,
        possessionDueAt: project.possessionDueAt || null,
        arbitrationRaisedAt: project.arbitrationRaisedAt || null,
      },
      attributionFactors: factorAnalysis.factors,
      legacyMappedStage: factorAnalysis.legacyMappedStage,
    };
  }

  if (name === 'predict_project_risk') {
    const payload = {
      name: args.name || 'Scenario Simulation',
      state: args.state || 'Maharashtra',
      landAreaHectares: Number(args.landAreaHectares) || 50,
      familiesAffected: Number(args.familiesAffected) || 100,
      compensationStatus: (args.compensationStatus || 'Pending') as CompensationStatus,
      approvalStage: (args.approvalStage || 'PreliminaryNotification') as ApprovalStage,
      legalDisputeFlag: Boolean(args.legalDisputeFlag),
      daysSinceLastUpdate: Number(args.daysSinceLastUpdate) || 30,
      underArbitration: Boolean(args.underArbitration),
    };
    const result = await predictExecutor(payload);
    return {
      riskScore: result.riskScore,
      riskCategory: result.riskCategory,
      source: result.source,
      modelVersion: result.model_version,
      topFactors: result.factors || result.top_risk_factors || [],
    };
  }

  return { error: `Unknown tool: ${name}` };
}

function extractReadableErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      return String(parsed.error.message);
    }
    if (parsed?.message) {
      return String(parsed.message);
    }
  } catch {
    // Not JSON
  }
  return raw;
}

function mapGeminiError(err: any): { status: number; message: string } {
  const rawMessage = String(err?.message || err || 'Failed to generate AI response');
  const readable = extractReadableErrorMessage(rawMessage);
  let status = Number(err?.status || err?.code);

  if (!status) {
    try {
      const parsed = JSON.parse(rawMessage);
      status = Number(parsed?.error?.code || parsed?.code);
    } catch {
      // Ignore
    }
  }

  if (
    status === 400 &&
    (rawMessage.includes('API_KEY_INVALID') || readable.toLowerCase().includes('api key'))
  ) {
    return {
      status: 400,
      message: 'The configured Gemini API key appears invalid. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Gemini API access was denied. Please check GEMINI_API_KEY permissions in Settings > Secrets.',
    };
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Gemini API rate limit or quota exceeded. Please retry shortly or upgrade your key in Settings > Secrets.',
    };
  }
  if (status === 503 || rawMessage.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message: 'The AI service is experiencing temporary high demand. Please retry in a moment.',
    };
  }
  if (
    status === 408 ||
    status === 504 ||
    rawMessage.toLowerCase().includes('deadline expired') ||
    rawMessage.toLowerCase().includes('timed out')
  ) {
    return {
      status: 504,
      message: 'The AI service took too long to respond. Please retry in a moment.',
    };
  }
  if (status === 404 || rawMessage.includes('NOT_FOUND')) {
    return {
      status: 502,
      message: `Model '${MODEL_NAME}' returned not found from Gemini API.`,
    };
  }
  return {
    status: 502,
    message: readable,
  };
}

function isRetryableGeminiError(err: any): boolean {
  const raw = String(err?.message || err || '');
  const status = Number(err?.status || err?.code);
  return (
    status === 503 ||
    status === 500 ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('"code":503') ||
    raw.includes('fetch failed') ||
    raw.includes('ECONNRESET')
  );
}

async function generateWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  const delays = [500];
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastError = err;
      if (attempt < delays.length && isRetryableGeminiError(err)) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function handleDrishtiChat(
  request: DrishtiChatRequest,
  predictExecutor: PredictExecutor
): Promise<DrishtiChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiConfigError(
      'GEMINI_API_KEY is not configured on the server. Please add your Gemini API key in Settings > Secrets.',
      503
    );
  }

  const messages = Array.isArray(request.messages) ? request.messages.slice(-20) : [];
  if (messages.length === 0) {
    throw new GeminiConfigError('At least one message is required.', 400);
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 30000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Build context note for active project/role
  let contextPrefix = '';
  if (request.userRole) {
    contextPrefix += `[Active User RBAC Role: ${request.userRole}]\n`;
  }
  if (request.activeProjectId) {
    const activeProject = await dbFindById(request.activeProjectId);
    if (activeProject) {
      contextPrefix += `[Currently Inspected Project Context: ${JSON.stringify(summarizeProject(activeProject))}]\n`;
    }
  }

  const contents: Content[] = messages.map((m, idx) => {
    const text =
      idx === messages.length - 1 && m.role === 'user' && contextPrefix
        ? `${contextPrefix}\nUser Question: ${m.content}`
        : m.content;
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text }],
    };
  });

  const toolsUsed = new Set<string>();
  const tools = [{ functionDeclarations: TOOL_DECLARATIONS }];

  try {
    for (let round = 0; round < 5; round++) {
      const response = await generateWithRetry(ai, {
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const functionCalls = response.functionCalls;
      const modelContent = response.candidates?.[0]?.content;

      if (functionCalls && functionCalls.length > 0 && modelContent) {
        contents.push(modelContent);
        const responseParts: Part[] = [];

        for (const call of functionCalls) {
          const toolName = call.name || '';
          toolsUsed.add(toolName);
          const result = await executeToolCall(
            toolName,
            (call.args as Record<string, any>) || {},
            predictExecutor
          );
          responseParts.push({
            functionResponse: {
              id: call.id,
              name: toolName,
              response: result,
            },
          });
        }

        contents.push({
          role: 'user',
          parts: responseParts,
        });
        continue;
      }

      const replyText = (response.text || '').trim();
      if (!replyText) {
        throw new Error('Model returned an empty response.');
      }

      return {
        reply: replyText,
        toolsUsed: Array.from(toolsUsed),
        model: MODEL_NAME,
      };
    }

    throw new Error('Assistant exceeded maximum tool execution turns.');
  } catch (err: any) {
    if (err instanceof GeminiConfigError) {
      throw err;
    }
    const mapped = mapGeminiError(err);
    throw new GeminiConfigError(mapped.message, mapped.status);
  }
}
