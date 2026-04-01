import { PrismaClient, Task, Contact } from '@prisma/client';
import fetch from 'node-fetch';

interface TaskWithContacts extends Task {
  contacts: Contact[];
}

interface SenderMachineRef {
  id: string;
  apiToken: string;
  deviceIden: string;
}

interface TaskWithContactsAndMachines extends TaskWithContacts {
  taskMachines: { machine: SenderMachineRef }[];
}

// 风控相关配置（可经 env 覆盖）
// SMS_DELAY_MS: 全局最小基础间隔(ms)，默认 1000
// SMS_DELAY_JITTER_MS: 全局最小随机抖动上限(ms)，默认 2000
// SMS_MAX_RETRIES: 全局重试上限，默认 2
// SMS_RATE_LIMIT_PER_MINUTE: 全局单机速率上限（每分钟），默认 10
const SMS_DELAY_MS = parseInt(process.env.SMS_DELAY_MS || '1000', 10);
const SMS_DELAY_JITTER_MS = parseInt(process.env.SMS_DELAY_JITTER_MS || '2000', 10);
const SMS_MAX_RETRIES = parseInt(process.env.SMS_MAX_RETRIES || '2', 10);
const SMS_RATE_LIMIT_PER_MINUTE = parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE || '10', 10);
const SMS_RATE_LIMIT_WINDOW_MS = 60 * 1000;
// 同步波次并发：每台机器每波固定 1 条、波次间统一等待区间（4-5分钟）
const SMS_SYNC_WAVE_PAUSE_MIN_MS = parseInt(process.env.SMS_SYNC_WAVE_PAUSE_MIN_MS || '240000', 10);
const SMS_SYNC_WAVE_PAUSE_MAX_MS = parseInt(process.env.SMS_SYNC_WAVE_PAUSE_MAX_MS || '300000', 10);

interface TaskRiskProfile {
  ratePerMinute: number;
  delayMs: number;
  jitterMs: number;
  maxRetries: number;
  waveBatchMin: number;
  waveBatchMax: number;
  wavePauseMinMs: number;
  wavePauseMaxMs: number;
  tier: 'tiny' | 'small' | 'medium' | 'large' | 'xl';
}

class ExecutionEngine {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private executingTasks = new Set<string>();
  private prisma: PrismaClient | null = null;
  /** Mark running tasks that should stop ASAP (e.g., deleted by user) */
  private cancelledTasks = new Set<string>();
  /** 每台机器最近发送时间戳，用于限速 */
  private machineSendTimestamps = new Map<string, number[]>();

  async initialize(prisma: PrismaClient) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'executionEngine.ts:14',message:'ExecutionEngine.initialize called',data:{hasPrisma:!!prisma},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    this.prisma = prisma;

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'executionEngine.ts:20',message:'Starting resumeTasks',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Resume any scheduled or running tasks
      await this.resumeTasks();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'executionEngine.ts:24',message:'resumeTasks completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // Start polling for scheduled tasks
      this.startPolling();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'executionEngine.ts:27',message:'startPolling called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'executionEngine.ts:30',message:'ExecutionEngine.initialize error',data:{error:error?.message,stack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      throw error;
    }
  }

  private async resumeTasks() {
    if (!this.prisma) return;

    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'executionEngine.ts:50',message:'resumeTasks: querying database',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      // Find tasks that should be running
      const now = new Date();
      const tasksToResume = await this.prisma.task.findMany({
        where: {
          OR: [
            { status: 'running' },
            {
              status: 'scheduled',
              scheduledAt: { lte: now },
            },
          ],
        },
        include: { contacts: true },
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'executionEngine.ts:67',message:'resumeTasks: query completed',data:{taskCount:tasksToResume.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

      for (const task of tasksToResume) {
        if (task.status === 'scheduled') {
          await this.prisma.task.update({
            where: { id: task.id },
            data: {
              status: 'running',
              startedAt: new Date(),
            },
          });
        }
        this.executeTask(task.id, this.prisma);
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'executionEngine.ts:85',message:'resumeTasks: all tasks processed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/a2ffb004-65cf-46e4-b7fa-dd61e947ef3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'executionEngine.ts:88',message:'resumeTasks: error occurred',data:{error:error?.message,stack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('Error resuming tasks:', error);
    }
  }

  private startPolling() {
    // Check for scheduled tasks every 30 seconds
    this.intervalId = setInterval(async () => {
      await this.checkScheduledTasks();
    }, 30000);

    // Also check immediately
    this.checkScheduledTasks();
  }

  private async checkScheduledTasks() {
    if (!this.prisma || this.isRunning) return;

    try {
      const now = new Date();
      const scheduledTasks = await this.prisma.task.findMany({
        where: {
          status: 'scheduled',
          scheduledAt: { lte: now },
        },
        include: { contacts: true },
      });

      for (const task of scheduledTasks) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            status: 'running',
            startedAt: new Date(),
          },
        });
        this.executeTask(task.id, this.prisma);
      }
    } catch (error) {
      console.error('Error checking scheduled tasks:', error);
    }
  }

  async executeTask(taskId: string, prisma: PrismaClient) {
    if (this.executingTasks.has(taskId)) {
      console.log(`Task ${taskId} is already executing`);
      return;
    }

    this.executingTasks.add(taskId);

    // Execute in background
    this.executeTaskAsync(taskId, prisma).catch((error) => {
      console.error(`Error executing task ${taskId}:`, error);
      this.executingTasks.delete(taskId);
    });
  }

  cancelTask(taskId: string) {
    this.cancelledTasks.add(taskId)
    console.log(`Task ${taskId} marked for cancellation`)
  }

  private isTaskCancelled(taskId: string): boolean {
    return this.cancelledTasks.has(taskId)
  }

  private async executeTaskAsync(taskId: string, prisma: PrismaClient) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const taskRaw = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          contacts: true,
          taskMachines: { include: { machine: true } },
        } as any,
      });

      const task = taskRaw as TaskWithContactsAndMachines | null;

      if (!task) {
        console.error(`Task ${taskId} not found`);
        this.executingTasks.delete(taskId);
        this.cancelledTasks.delete(taskId);
        return;
      }

      if (task.status !== 'running') {
        console.log(`Task ${taskId} is not in running status`);
        this.executingTasks.delete(taskId);
        this.cancelledTasks.delete(taskId);
        return;
      }

      // Use selected machines only (apiToken + deviceIden are required on selected machines)
      type Machine = { id?: string; apiToken: string; deviceIden: string };
      let machines: Machine[] = [];
      if (task.taskMachines?.length > 0) {
        machines = task.taskMachines
          .map((tm: { machine: SenderMachineRef }) => tm.machine)
          .filter((m: SenderMachineRef) => m.apiToken?.trim() && m.deviceIden?.trim())
          .map((m: SenderMachineRef) => ({ id: m.id, apiToken: m.apiToken, deviceIden: m.deviceIden }));
      }
      if (machines.length === 0) {
        console.error(`Task ${taskId}: no valid sender machines configured (select machines and ensure apiToken/deviceIden are filled)`)
        await prisma.task.update({
          where: { id: taskId },
          data: { status: 'failed', completedAt: new Date() },
        })
        this.executingTasks.delete(taskId)
        return
      }

      console.log(`Executing task ${taskId} with ${task.contacts.length} contacts across ${machines.length} machine(s)`)

      const contacts = task.contacts
      const riskProfile = this.getTaskRiskProfile(contacts.length)

      console.log(
        `Task ${taskId} risk profile: tier=${riskProfile.tier}, contacts=${contacts.length}, rate=${riskProfile.ratePerMinute}/min, delay=${riskProfile.delayMs}ms(+${riskProfile.jitterMs}), retries=${riskProfile.maxRetries}`
      )

      // Split contacts across machines; each machine runs its own sequential worker in parallel.
      const machineBuckets: Contact[][] = machines.map(() => [])
      for (let i = 0; i < contacts.length; i++) {
        machineBuckets[i % machines.length].push(contacts[i])
      }

      // 同步波次并发：所有机器每波各发 1 条 -> 全局等待4-5分钟 -> 下一波
      const machineCursors = machines.map(() => 0)
      let successCount = 0
      let failedCount = 0
      let waveNumber = 0

      while (true) {
        if (this.isTaskCancelled(taskId)) break

        const wavePlans = machines
          .map((machine, machineIndex) => {
            const cursor = machineCursors[machineIndex]
            const bucket = machineBuckets[machineIndex]
            if (cursor >= bucket.length) return null

            const batchSize = 1
            const nextCursor = Math.min(bucket.length, cursor + batchSize)
            const contactsThisWave = bucket.slice(cursor, nextCursor)
            machineCursors[machineIndex] = nextCursor
            return { machine, contactsThisWave }
          })
          .filter((v): v is { machine: Machine; contactsThisWave: Contact[] } => v != null)

        if (wavePlans.length === 0) break
        waveNumber++
        const plannedCount = wavePlans.reduce((sum, p) => sum + p.contactsThisWave.length, 0)
        console.log(`Task ${taskId} wave ${waveNumber}: ${wavePlans.length} machine(s), ${plannedCount} contact(s)`)

        const waveResults = await Promise.all(
          wavePlans.map(async ({ machine, contactsThisWave }) => {
            let machineSuccess = 0
            let machineFailed = 0
            for (const contact of contactsThisWave) {
              if (this.isTaskCancelled(taskId)) break
              const selectedTemplate = this.pickTemplateForContact(task)
              await this.waitForRateLimit(machine, riskProfile.ratePerMinute, taskId)
              if (this.isTaskCancelled(taskId)) break
              const result = await this.sendSMS(task, contact, prisma, machine, riskProfile, selectedTemplate)
              if (result.success) {
                machineSuccess++
                this.recordMachineSend(machine)
              } else {
                machineFailed++
              }
              if (this.isTaskCancelled(taskId)) break
            }
            return { successCount: machineSuccess, failedCount: machineFailed }
          })
        )

        successCount += waveResults.reduce((acc, r) => acc + r.successCount, 0)
        failedCount += waveResults.reduce((acc, r) => acc + r.failedCount, 0)

        const hasRemaining = machineCursors.some((cursor, idx) => cursor < machineBuckets[idx].length)
        if (!hasRemaining || this.isTaskCancelled(taskId)) break

        const pauseMs = this.randomInt(SMS_SYNC_WAVE_PAUSE_MIN_MS, SMS_SYNC_WAVE_PAUSE_MAX_MS)
        console.log(`Task ${taskId} wave ${waveNumber} completed, waiting ${Math.round(pauseMs / 1000)}s before next wave`)
        await this.sleepWithCancellation(taskId, pauseMs)
      }

      if (this.isTaskCancelled(taskId)) {
        console.log(`Task ${taskId} cancelled by user`)
        return
      }

      // Update task status
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: failedCount === 0 ? 'completed' : 'failed',
          completedAt: new Date(),
        },
      });

      console.log(
        `Task ${taskId} completed: ${successCount} success, ${failedCount} failed`
      );
    } catch (error) {
      console.error(`Error executing task ${taskId}:`, error);
      try {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            completedAt: new Date(),
          },
        });
      } catch (_updateError) {
        // Task may already be deleted as part of cancellation.
      }
    } finally {
      this.executingTasks.delete(taskId);
      this.cancelledTasks.delete(taskId);
    }
  }

  private async sendSMS(
    task: TaskWithContacts,
    contact: Contact,
    prisma: PrismaClient,
    machine: { id?: string; apiToken: string; deviceIden: string },
    riskProfile: TaskRiskProfile,
    selectedTemplate: string,
    retryCount = 0,
    existingLogId: string | null = null
  ): Promise<{ success: boolean; error?: string; statusCode?: number }> {
    let logId: string | null = existingLogId;

    try {
      const message = selectedTemplate.replace(/{name}/g, contact.name || '');

      if (logId == null) {
        const log = await prisma.taskExecutionLog.create({
          data: {
            taskId: task.id,
            contactId: contact.id,
            status: 'pending',
            retryCount,
            ...(machine.id != null ? { machineId: machine.id } : {}),
          } as any,
        });
        logId = log.id;
      }

      const { apiToken, deviceIden } = machine;
      if (!apiToken?.trim()) {
        throw new Error('Sender machine apiToken not configured');
      }
      if (!deviceIden?.trim()) {
        throw new Error('Sender machine deviceIden not configured');
      }

      const response = await fetch('https://api.pushbullet.com/v2/texts', {
        method: 'POST',
        headers: {
          'Access-Token': apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            target_device_iden: deviceIden,
            addresses: [contact.phone],
            message,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`Pushbullet texts API error: ${response.status} - ${errorText}`) as Error & { statusCode?: number };
        err.statusCode = response.status;
        throw err;
      }

      await prisma.taskExecutionLog.update({
        where: { id: logId! },
        data: {
          status: 'success',
          sentAt: new Date(),
          retryCount,
        },
      });

      return { success: true, statusCode: response.status };
    } catch (error: any) {
      const statusCode = error?.statusCode as number | undefined;
      const isRateLimit = statusCode === 429;
      const isServerError = statusCode != null && statusCode >= 500 && statusCode < 600;
      const shouldRetry = (isRateLimit || isServerError) && retryCount < riskProfile.maxRetries;

      if (shouldRetry) {
        if (this.isTaskCancelled(task.id)) {
          return { success: false, error: 'Task cancelled' }
        }
        const backoffMs = 60 * 1000 * (retryCount + 1);
        console.warn(`Task ${task.id} send retry ${retryCount + 1}/${riskProfile.maxRetries} after ${statusCode}, backoff ${backoffMs}ms`);
        await this.sleepWithCancellation(task.id, backoffMs);
        if (this.isTaskCancelled(task.id)) {
          return { success: false, error: 'Task cancelled' }
        }
        return this.sendSMS(task, contact, prisma, machine, riskProfile, selectedTemplate, retryCount + 1, logId);
      }

      const errorMessage = error?.message || 'Unknown error';

      if (logId) {
        try {
          await prisma.taskExecutionLog.update({
            where: { id: logId },
            data: {
              status: 'failed',
              errorMessage,
              retryCount,
            },
          });
        } catch (updateError) {
          console.error('Error updating log:', updateError);
        }
      }

      return { success: false, error: errorMessage, statusCode };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sleepWithCancellation(taskId: string, ms: number): Promise<void> {
    const stepMs = 1000
    let remaining = ms
    while (remaining > 0) {
      if (this.isTaskCancelled(taskId)) return
      const chunk = Math.min(stepMs, remaining)
      await this.sleep(chunk)
      remaining -= chunk
    }
  }

  /** 基础延迟 + 随机抖动，降低固定节奏被风控识别的概率 */
  private getDelayWithJitter(riskProfile: TaskRiskProfile): number {
    const jitter = riskProfile.jitterMs > 0 ? Math.floor(Math.random() * (riskProfile.jitterMs + 1)) : 0;
    return Math.max(0, riskProfile.delayMs + jitter);
  }

  private machineKey(machine: { id?: string; apiToken: string }): string {
    return machine.id ?? machine.apiToken;
  }

  /** 单机限速：若过去 1 分钟内已发满 N 条，则等待到窗口内最早一条满 1 分钟后再发 */
  private async waitForRateLimit(machine: { id?: string; apiToken: string }, ratePerMinute: number, taskId: string): Promise<void> {
    const key = this.machineKey(machine);
    const now = Date.now();
    let timestamps = this.machineSendTimestamps.get(key) ?? [];
    timestamps = timestamps.filter((t) => now - t < SMS_RATE_LIMIT_WINDOW_MS);
    if (timestamps.length >= ratePerMinute) {
      const oldest = Math.min(...timestamps);
      const waitMs = oldest + SMS_RATE_LIMIT_WINDOW_MS - now;
      if (waitMs > 0) {
        console.log(`Rate limit: machine ${key} waiting ${Math.round(waitMs / 1000)}s (limit=${ratePerMinute}/min)`);
        await this.sleepWithCancellation(taskId, waitMs);
      }
    }
    this.machineSendTimestamps.set(key, timestamps);
  }

  private getTaskRiskProfile(contactCount: number): TaskRiskProfile {
    // N < 80
    if (contactCount < 80) {
      return this.withGlobalRiskBounds({
        ratePerMinute: 12,
        delayMs: 4500,
        jitterMs: 800,
        maxRetries: 2,
        waveBatchMin: 120,
        waveBatchMax: 200,
        wavePauseMinMs: 0,
        wavePauseMaxMs: 0,
        tier: 'tiny',
      });
    }

    // 80 <= N < 200
    if (contactCount < 200) {
      return this.withGlobalRiskBounds({
        ratePerMinute: 10,
        delayMs: 5500,
        jitterMs: 1000,
        maxRetries: 2,
        waveBatchMin: 100,
        waveBatchMax: 160,
        wavePauseMinMs: 0,
        wavePauseMaxMs: 0,
        tier: 'small',
      });
    }

    // 200 <= N <= 600
    if (contactCount <= 600) {
      return this.withGlobalRiskBounds({
        ratePerMinute: 8,
        delayMs: 6500,
        jitterMs: 1200,
        maxRetries: 1,
        waveBatchMin: 70,
        waveBatchMax: 70,
        wavePauseMinMs: 90 * 1000,
        wavePauseMaxMs: 150 * 1000,
        tier: 'medium',
      });
    }

    // 601 <= N <= 1000
    if (contactCount <= 1000) {
      return this.withGlobalRiskBounds({
        ratePerMinute: 7,
        delayMs: 8000,
        jitterMs: 1500,
        maxRetries: 1,
        waveBatchMin: 55,
        waveBatchMax: 55,
        wavePauseMinMs: 120 * 1000,
        wavePauseMaxMs: 180 * 1000,
        tier: 'large',
      });
    }

    // 1001 <= N <= 1500
    if (contactCount <= 1500) {
      return this.withGlobalRiskBounds({
        ratePerMinute: 6,
        delayMs: 9000,
        jitterMs: 1800,
        maxRetries: 1,
        waveBatchMin: 45,
        waveBatchMax: 45,
        wavePauseMinMs: 150 * 1000,
        wavePauseMaxMs: 240 * 1000,
        tier: 'xl',
      });
    }

    // N > 1500
    return this.withGlobalRiskBounds({
      ratePerMinute: 6,
      delayMs: 9500,
      jitterMs: 2000,
      maxRetries: 1,
      waveBatchMin: 30,
      waveBatchMax: 50,
      wavePauseMinMs: 120 * 1000,
      wavePauseMaxMs: 300 * 1000,
      tier: 'xl',
    });
  }

  /**
   * Keep env values as global hard bounds:
   * - SMS_RATE_LIMIT_PER_MINUTE: cap the tier speed
   * - SMS_DELAY_MS/SMS_DELAY_JITTER_MS: floor for delay/jitter
   * - SMS_MAX_RETRIES: cap the tier retries
   */
  private withGlobalRiskBounds(profile: TaskRiskProfile): TaskRiskProfile {
    const boundedRate = Math.max(1, Math.min(profile.ratePerMinute, SMS_RATE_LIMIT_PER_MINUTE));
    const boundedDelay = Math.max(profile.delayMs, SMS_DELAY_MS);
    const boundedJitter = Math.max(profile.jitterMs, SMS_DELAY_JITTER_MS);
    const boundedRetries = Math.max(0, Math.min(profile.maxRetries, SMS_MAX_RETRIES));
    return {
      ...profile,
      ratePerMinute: boundedRate,
      delayMs: boundedDelay,
      jitterMs: boundedJitter,
      maxRetries: boundedRetries,
    };
  }

  private randomInt(min: number, max: number): number {
    if (max < min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private pickTemplateForContact(task: TaskWithContacts): string {
    const templates = Array.isArray(task.messageTemplates)
      ? task.messageTemplates.map((t) => (typeof t === 'string' ? t.trim() : '')).filter((t) => t.length > 0)
      : []
    if (templates.length === 0) return task.message
    const index = this.randomInt(0, templates.length - 1)
    return templates[index]
  }

  private recordMachineSend(machine: { id?: string; apiToken: string }): void {
    const key = this.machineKey(machine);
    const now = Date.now();
    let timestamps = this.machineSendTimestamps.get(key) ?? [];
    timestamps = timestamps.filter((t) => now - t < SMS_RATE_LIMIT_WINDOW_MS);
    timestamps.push(now);
    this.machineSendTimestamps.set(key, timestamps);
  }

  async shutdown() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Wait for executing tasks to complete (with timeout)
    const maxWait = 30000; // 30 seconds
    const startTime = Date.now();
    while (this.executingTasks.size > 0 && Date.now() - startTime < maxWait) {
      await this.sleep(1000);
    }
    this.cancelledTasks.clear()
  }
}

export const executionEngine = new ExecutionEngine();
