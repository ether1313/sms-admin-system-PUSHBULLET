-- AlterTable
ALTER TABLE "TaskExecutionLog" ADD COLUMN     "machineId" TEXT;

-- CreateTable
CREATE TABLE "SenderMachine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "deviceIden" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adminId" TEXT,

    CONSTRAINT "SenderMachine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskMachine" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,

    CONSTRAINT "TaskMachine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SenderMachine_adminId_idx" ON "SenderMachine"("adminId");

-- CreateIndex
CREATE INDEX "TaskMachine_taskId_idx" ON "TaskMachine"("taskId");

-- CreateIndex
CREATE INDEX "TaskMachine_machineId_idx" ON "TaskMachine"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskMachine_taskId_machineId_key" ON "TaskMachine"("taskId", "machineId");

-- CreateIndex
CREATE INDEX "TaskExecutionLog_machineId_idx" ON "TaskExecutionLog"("machineId");

-- AddForeignKey
ALTER TABLE "SenderMachine" ADD CONSTRAINT "SenderMachine_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskMachine" ADD CONSTRAINT "TaskMachine_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskMachine" ADD CONSTRAINT "TaskMachine_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "SenderMachine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskExecutionLog" ADD CONSTRAINT "TaskExecutionLog_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "SenderMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
