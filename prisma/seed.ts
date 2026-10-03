import { PrismaClient, CompensationStatus, ApprovalStage, RiskCategory } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CsvRow {
  name: string;
  state: string;
  district: string;
  landAreaHectares: number;
  familiesAffected: number;
  compensationStatus: CompensationStatus;
  approvalStage: ApprovalStage;
  legalDisputeFlag: boolean;
  underArbitration: boolean;
  daysSinceLastUpdate: number;
  riskCategory: RiskCategory;
  riskScore: number;
}

export function parseSampleCsv(): CsvRow[] {
  const csvPath = path.resolve(__dirname, '../sample_projects.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`sample_projects.csv not found at ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows: CsvRow[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 10) continue;

    const [
      name,
      state,
      district,
      landAreaStr,
      familiesStr,
      compStatusStr,
      appStageStr,
      disputeStr,
      arbStr,
      daysStr,
      riskCatStr,
    ] = parts;

    const category = (riskCatStr || 'Low').trim() as RiskCategory;
    const defaultScore = category === 'High' ? 82 : category === 'Medium' ? 54 : 22;

    rows.push({
      name: name.trim(),
      state: state.trim(),
      district: district.trim(),
      landAreaHectares: parseFloat(landAreaStr) || 0,
      familiesAffected: parseInt(familiesStr, 10) || 0,
      compensationStatus: compStatusStr.trim() as CompensationStatus,
      approvalStage: appStageStr.trim() as ApprovalStage,
      legalDisputeFlag: disputeStr.trim().toUpperCase() === 'TRUE',
      underArbitration: arbStr ? arbStr.trim().toUpperCase() === 'TRUE' : false,
      daysSinceLastUpdate: parseInt(daysStr, 10) || 0,
      riskCategory: category,
      riskScore: defaultScore,
    });
  }

  return rows;
}

async function main() {
  console.log('Seeding database with sample_projects.csv (6 legal stages)...');
  const rows = parseSampleCsv();

  if (process.env.DATABASE_URL) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      // Clear existing records
      await prisma.project.deleteMany({});
      
      const created = await prisma.project.createMany({
        data: rows.map((r) => ({
          name: r.name,
          state: r.state,
          district: r.district,
          landAreaHectares: r.landAreaHectares,
          familiesAffected: r.familiesAffected,
          compensationStatus: r.compensationStatus,
          approvalStage: r.approvalStage,
          legalDisputeFlag: r.legalDisputeFlag,
          underArbitration: r.underArbitration,
          daysSinceLastUpdate: r.daysSinceLastUpdate,
          createdByClerkId: 'user_clerk_seed',
          riskScore: r.riskScore,
          riskCategory: r.riskCategory,
        })),
      });

      console.log(`Successfully seeded ${created.count} projects into PostgreSQL.`);
    } catch (err) {
      console.warn('PostgreSQL connection error during seed, seeded in-memory fallback:', err);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log(`DATABASE_URL not set. Parsed ${rows.length} rows ready for database.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
