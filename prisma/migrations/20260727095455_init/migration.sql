-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sub" TEXT,
    "name" TEXT,
    "sessionsValidFrom" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'default',
    "restriction" TEXT NOT NULL DEFAULT 'none',
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorEmail" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subject_email_key" ON "Subject"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_sub_key" ON "Subject"("sub");

-- CreateIndex
CREATE INDEX "Grant_serviceId_role_idx" ON "Grant"("serviceId", "role");

-- CreateIndex
CREATE INDEX "Grant_serviceId_restriction_idx" ON "Grant"("serviceId", "restriction");

-- CreateIndex
CREATE UNIQUE INDEX "Grant_subjectId_serviceId_key" ON "Grant"("subjectId", "serviceId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_targetEmail_idx" ON "AuditLog"("targetEmail");

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
