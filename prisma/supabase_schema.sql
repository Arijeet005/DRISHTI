-- DRISHTI PostgreSQL Schema for Supabase
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE "CompensationStatus" AS ENUM ('Pending', 'PartiallyPaid', 'Paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ApprovalStage" AS ENUM (
        'Drafting',
        'PreliminaryNotification',
        'ObjectionsHearing',
        'DeclarationVesting',
        'AwardAnnounced',
        'PossessionTaken'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RiskCategory" AS ENUM ('Low', 'Medium', 'High');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Project Table
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "landAreaHectares" DOUBLE PRECISION NOT NULL,
    "familiesAffected" INTEGER NOT NULL,
    "compensationStatus" "CompensationStatus" NOT NULL,
    "approvalStage" "ApprovalStage" NOT NULL,
    "legalDisputeFlag" BOOLEAN NOT NULL DEFAULT false,
    "daysSinceLastUpdate" INTEGER NOT NULL,
    "createdByClerkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "underArbitration" BOOLEAN NOT NULL DEFAULT false,
    "arbitrationRaisedAt" TIMESTAMP(3),
    "preliminaryNotificationAt" TIMESTAMP(3),
    "objectionsDeadlineAt" TIMESTAMP(3),
    "possessionNoticeAt" TIMESTAMP(3),
    "possessionDueAt" TIMESTAMP(3),
    "riskScore" DOUBLE PRECISION,
    "riskCategory" "RiskCategory"
);

-- Enable Row Level Security and allow API access
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on Project" ON "Project";
CREATE POLICY "Allow public read access on Project"
ON "Project" FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public insert access on Project" ON "Project";
CREATE POLICY "Allow public insert access on Project"
ON "Project" FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access on Project" ON "Project";
CREATE POLICY "Allow public update access on Project"
ON "Project" FOR UPDATE
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public delete access on Project" ON "Project";
CREATE POLICY "Allow public delete access on Project"
ON "Project" FOR DELETE
TO anon, authenticated
USING (true);

-- 3. Initial Seed Records (from official dataset)
INSERT INTO "Project" (
    "id", "name", "state", "district", "landAreaHectares", "familiesAffected",
    "compensationStatus", "approvalStage", "legalDisputeFlag", "daysSinceLastUpdate",
    "createdByClerkId", "riskScore", "riskCategory"
) VALUES
('proj-001', 'Highway Expansion Phase 1', 'Madhya Pradesh', 'Indore', 120.0, 340, 'Pending', 'Notified', true, 95, 'user_clerk_seed', 82.0, 'High'),
('proj-002', 'Solar Park Corridor', 'Rajasthan', 'Jodhpur', 450.0, 80, 'PartiallyPaid', 'Awarded', false, 30, 'user_clerk_seed', 54.0, 'Medium'),
('proj-003', 'Metro Rail Depot Ext', 'Maharashtra', 'Pune', 35.0, 520, 'Pending', 'Draft', true, 110, 'user_clerk_seed', 88.0, 'High'),
('proj-004', 'Industrial Park Zone B', 'Gujarat', 'Vadodara', 200.0, 45, 'Paid', 'Possessed', false, 15, 'user_clerk_seed', 18.0, 'Low'),
('proj-005', 'Ring Road Bypass', 'Karnataka', 'Bengaluru', 85.0, 210, 'PartiallyPaid', 'Notified', false, 65, 'user_clerk_seed', 61.0, 'Medium'),
('proj-006', 'Thermal Power Plant Buffer', 'Chhattisgarh', 'Korba', 310.0, 410, 'Pending', 'Draft', true, 140, 'user_clerk_seed', 92.0, 'High'),
('proj-007', 'Inland Waterway Terminal', 'Uttar Pradesh', 'Varanasi', 60.0, 95, 'Paid', 'Possessed', false, 20, 'user_clerk_seed', 24.0, 'Low'),
('proj-008', 'Freight Rail Terminal', 'Haryana', 'Rewari', 175.0, 160, 'PartiallyPaid', 'Awarded', false, 45, 'user_clerk_seed', 56.0, 'Medium'),
('proj-009', 'Airport Runway Extension', 'Tamil Nadu', 'Chennai', 90.0, 600, 'Pending', 'Notified', true, 80, 'user_clerk_seed', 85.0, 'High'),
('proj-010', 'Smart City Logistic Hub', 'Madhya Pradesh', 'Bhopal', 130.0, 115, 'Paid', 'Possessed', false, 25, 'user_clerk_seed', 22.0, 'Low')
ON CONFLICT ("id") DO NOTHING;
