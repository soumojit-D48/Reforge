-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('admin', 'developer', 'reviewer');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "TraceStatus" AS ENUM ('running', 'success', 'failed', 'processing_error');

-- CreateEnum
CREATE TYPE "SpanType" AS ENUM ('retrieval', 'llm_call', 'tool_call', 'tool_result', 'error');

-- CreateEnum
CREATE TYPE "FailureCategory" AS ENUM ('bad_retrieval', 'wrong_tool', 'invalid_tool_args', 'external_api_failure', 'timeout', 'hallucination', 'prompt_injection', 'evaluator_error', 'unknown');

-- CreateEnum
CREATE TYPE "FailureSource" AS ENUM ('ai', 'human');

-- CreateEnum
CREATE TYPE "ReplayFieldType" AS ENUM ('prompt', 'model', 'tool_arguments', 'retrieval_config', 'temperature');

-- CreateEnum
CREATE TYPE "ReplayStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ReplayOutcome" AS ENUM ('fixed', 'partially_fixed', 'not_fixed', 'new_failure');

-- CreateEnum
CREATE TYPE "EvaluatorType" AS ENUM ('exact_match', 'rule_based_rubric', 'llm_judge');

-- CreateEnum
CREATE TYPE "EvaluationTargetType" AS ENUM ('trace', 'replay');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AnnotationTargetType" AS ENUM ('trace', 'evaluation');

-- CreateEnum
CREATE TYPE "AnnotationVerdict" AS ENUM ('correct', 'incorrect', 'unsafe', 'needs_review', 'wrong_category');

-- CreateEnum
CREATE TYPE "LinkedEntityType" AS ENUM ('trace', 'replay', 'regression_test', 'test_run', 'evaluation');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'developer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "secretKeyHash" TEXT NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trace" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "environment" TEXT,
    "status" "TraceStatus" NOT NULL DEFAULT 'running',
    "input" JSONB,
    "metadata" JSONB,
    "totalDurationMs" INTEGER,
    "totalCost" DECIMAL(10,6),
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Span" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "SpanType" NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT,
    "input" JSONB,
    "output" JSONB,
    "arguments" JSONB,
    "result" JSONB,
    "error" JSONB,
    "tokenUsage" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Span_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailureTag" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "category" "FailureCategory" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" "FailureSource" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailureTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Replay" (
    "id" TEXT NOT NULL,
    "sourceTraceId" TEXT NOT NULL,
    "resultTraceId" TEXT,
    "changedField" "ReplayFieldType" NOT NULL,
    "changedValue" JSONB NOT NULL,
    "fieldResolution" JSONB NOT NULL,
    "status" "ReplayStatus" NOT NULL DEFAULT 'queued',
    "outcome" "ReplayOutcome",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Replay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "targetType" "EvaluationTargetType" NOT NULL,
    "traceId" TEXT,
    "replayId" TEXT,
    "evaluatorType" "EvaluatorType" NOT NULL,
    "evaluatorVersion" TEXT,
    "rubricVersion" TEXT,
    "config" JSONB,
    "input" JSONB,
    "output" JSONB,
    "score" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "reason" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'pending',
    "humanOverrideScore" DOUBLE PRECISION,
    "humanOverrideReason" TEXT,
    "humanOverrideByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegressionTest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "expectedBehavior" TEXT NOT NULL,
    "evaluatorType" "EvaluatorType" NOT NULL,
    "evaluatorConfig" JSONB,
    "minScore" DOUBLE PRECISION NOT NULL,
    "promptVersion" TEXT,
    "model" TEXT,
    "environment" TEXT,
    "sourceTraceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegressionTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSuite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuiteTest" (
    "id" TEXT NOT NULL,
    "testSuiteId" TEXT NOT NULL,
    "regressionTestId" TEXT NOT NULL,

    CONSTRAINT "TestSuiteTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" TEXT NOT NULL,
    "testSuiteId" TEXT NOT NULL,
    "promptVersion" TEXT,
    "model" TEXT,
    "status" "TestRunStatus" NOT NULL DEFAULT 'queued',
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRunResult" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "regressionTestId" TEXT NOT NULL,
    "replayId" TEXT,
    "evaluationId" TEXT,
    "passed" BOOLEAN,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestRunResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "targetType" "AnnotationTargetType" NOT NULL,
    "traceId" TEXT,
    "evaluationId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "verdict" "AnnotationVerdict" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "linkedEntityType" "LinkedEntityType",
    "linkedEntityId" TEXT,
    "r2Key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_publicKey_key" ON "ApiKey"("publicKey");

-- CreateIndex
CREATE INDEX "ApiKey_projectId_idx" ON "ApiKey"("projectId");

-- CreateIndex
CREATE INDEX "Trace_projectId_status_idx" ON "Trace"("projectId", "status");

-- CreateIndex
CREATE INDEX "Trace_projectId_startedAt_idx" ON "Trace"("projectId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trace_projectId_externalId_key" ON "Trace"("projectId", "externalId");

-- CreateIndex
CREATE INDEX "Span_traceId_idx" ON "Span"("traceId");

-- CreateIndex
CREATE INDEX "Span_parentId_idx" ON "Span"("parentId");

-- CreateIndex
CREATE INDEX "FailureTag_traceId_idx" ON "FailureTag"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "Replay_resultTraceId_key" ON "Replay"("resultTraceId");

-- CreateIndex
CREATE INDEX "Replay_sourceTraceId_idx" ON "Replay"("sourceTraceId");

-- CreateIndex
CREATE INDEX "Evaluation_traceId_idx" ON "Evaluation"("traceId");

-- CreateIndex
CREATE INDEX "Evaluation_replayId_idx" ON "Evaluation"("replayId");

-- CreateIndex
CREATE INDEX "RegressionTest_projectId_idx" ON "RegressionTest"("projectId");

-- CreateIndex
CREATE INDEX "TestSuite_projectId_idx" ON "TestSuite"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TestSuiteTest_testSuiteId_regressionTestId_key" ON "TestSuiteTest"("testSuiteId", "regressionTestId");

-- CreateIndex
CREATE INDEX "TestRun_testSuiteId_idx" ON "TestRun"("testSuiteId");

-- CreateIndex
CREATE INDEX "TestRunResult_testRunId_idx" ON "TestRunResult"("testRunId");

-- CreateIndex
CREATE INDEX "TestRunResult_regressionTestId_idx" ON "TestRunResult"("regressionTestId");

-- CreateIndex
CREATE INDEX "Annotation_traceId_idx" ON "Annotation"("traceId");

-- CreateIndex
CREATE INDEX "Annotation_evaluationId_idx" ON "Annotation"("evaluationId");

-- CreateIndex
CREATE INDEX "File_projectId_idx" ON "File"("projectId");

-- CreateIndex
CREATE INDEX "File_linkedEntityType_linkedEntityId_idx" ON "File"("linkedEntityType", "linkedEntityId");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trace" ADD CONSTRAINT "Trace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Span" ADD CONSTRAINT "Span_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Span" ADD CONSTRAINT "Span_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Span"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailureTag" ADD CONSTRAINT "FailureTag_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_sourceTraceId_fkey" FOREIGN KEY ("sourceTraceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_resultTraceId_fkey" FOREIGN KEY ("resultTraceId") REFERENCES "Trace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_replayId_fkey" FOREIGN KEY ("replayId") REFERENCES "Replay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_humanOverrideByUserId_fkey" FOREIGN KEY ("humanOverrideByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegressionTest" ADD CONSTRAINT "RegressionTest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuiteTest" ADD CONSTRAINT "TestSuiteTest_testSuiteId_fkey" FOREIGN KEY ("testSuiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuiteTest" ADD CONSTRAINT "TestSuiteTest_regressionTestId_fkey" FOREIGN KEY ("regressionTestId") REFERENCES "RegressionTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_testSuiteId_fkey" FOREIGN KEY ("testSuiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunResult" ADD CONSTRAINT "TestRunResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunResult" ADD CONSTRAINT "TestRunResult_regressionTestId_fkey" FOREIGN KEY ("regressionTestId") REFERENCES "RegressionTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunResult" ADD CONSTRAINT "TestRunResult_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_traceId_fkey" FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
