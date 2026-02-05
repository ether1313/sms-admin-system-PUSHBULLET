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
// SMS_DELAY_MS: 每条之间的基础间隔(ms)，默认 1000
// SMS_DELAY_JITTER_MS: 随机抖动上限(ms)，实际间隔 = 基础 + [0, jitter]，默认 2000
// SMS_MAX_RETRIES: 遇 429/5xx 时最多重试次数，默认 2
// SMS_RATE_LIMIT_PER_MINUTE: 单台机器每分钟最多发送条数，默认 10
const SMS_DELAY_MS = parseInt(process.env.SMS_DELAY_MS || '1000', 10);
const SMS_DELAY_JITTER_MS = parseInt(process.env.SMS_DELAY_JITTER_MS || '2000', 10);
const SMS_MAX_RETRIES = parseInt(process.env.SMS_MAX_RETRIES || '2', 10);
const SMS_RATE_LIMIT_PER_MINUTE = parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE || '10', 10);
const SMS_RATE_LIMIT_WINDOW_MS = 60 * 1000;

class ExecutionEngine {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private executingTasks = new Set<string>();
  private prisma: PrismaClient | null = null;
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
        return;
      }

      if (task.status !== 'running') {
        console.log(`Task ${taskId} is not in running status`);
        this.executingTasks.delete(taskId);
        return;
      }

      // Use selected machines (with apiToken + deviceIden) or fallback to env
      type Machine = { id?: string; apiToken: string; deviceIden: string };
      let machines: Machine[] = [];
      if (task.taskMachines?.length > 0) {
        machines = task.taskMachines
          .map((tm: { machine: SenderMachineRef }) => tm.machine)
          .filter((m: SenderMachineRef) => m.apiToken?.trim() && m.deviceIden?.trim())
          .map((m: SenderMachineRef) => ({ id: m.id, apiToken: m.apiToken, deviceIden: m.deviceIden }));
      }
      if (machines.length === 0) {
        const token = process.env.PUSHBULLET_API_TOKEN
        const deviceIden = process.env.PUSHBULLET_DEVICE_IDEN
        if (token?.trim() && deviceIden?.trim()) {
          machines = [{ apiToken: token, deviceIden }]
        }
      }
      if (machines.length === 0) {
        console.error(`Task ${taskId}: no sender machines configured (fill apiToken/deviceIden in Prisma Studio or set env)`)
        await prisma.task.update({
          where: { id: taskId },
          data: { status: 'failed', completedAt: new Date() },
        })
        this.executingTasks.delete(taskId)
        return
      }

      console.log(`Executing task ${taskId} with ${task.contacts.length} contacts across ${machines.length} machine(s)`)

      let successCount = 0
      let failedCount = 0
      const contacts = task.contacts

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i]
        const machineIndex = i % machines.length
        const machine = machines[machineIndex]
        await this.waitForRateLimit(machine)
        const result = await this.sendSMS(task, contact, prisma, machine)
        if (result.success) {
          successCount++
          this.recordMachineSend(machine)
        } else {
          failedCount++
        }
        const delayMs = this.getDelayWithJitter()
        await this.sleep(delayMs)
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
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          completedAt: new Date(),
        },
      });
    } finally {
      this.executingTasks.delete(taskId);
    }
  }

  private async sendSMS(
    task: TaskWithContacts,
    contact: Contact,
    prisma: PrismaClient,
    machine: { id?: string; apiToken: string; deviceIden: string },
    retryCount = 0,
    existingLogId: string | null = null
  ): Promise<{ success: boolean; error?: string }> {
    let logId: string | null = existingLogId;

    try {
      const message = task.message.replace(/{name}/g, contact.name || '');

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

      return { success: true };
    } catch (error: any) {
      const statusCode = error?.statusCode as number | undefined;
      const isRateLimit = statusCode === 429;
      const isServerError = statusCode != null && statusCode >= 500 && statusCode < 600;
      const shouldRetry = (isRateLimit || isServerError) && retryCount < SMS_MAX_RETRIES;

      if (shouldRetry) {
        const backoffMs = 60 * 1000 * (retryCount + 1);
        console.warn(`Task ${task.id} send retry ${retryCount + 1}/${SMS_MAX_RETRIES} after ${statusCode}, backoff ${backoffMs}ms`);
        await this.sleep(backoffMs);
        return this.sendSMS(task, contact, prisma, machine, retryCount + 1, logId);
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

      return { success: false, error: errorMessage };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** 基础延迟 + 随机抖动，降低固定节奏被风控识别的概率 */
  private getDelayWithJitter(): number {
    const jitter = SMS_DELAY_JITTER_MS > 0 ? Math.floor(Math.random() * (SMS_DELAY_JITTER_MS + 1)) : 0;
    return Math.max(0, SMS_DELAY_MS + jitter);
  }

  private machineKey(machine: { id?: string; apiToken: string }): string {
    return machine.id ?? machine.apiToken;
  }

  /** 单机限速：若过去 1 分钟内已发满 N 条，则等待到窗口内最早一条满 1 分钟后再发 */
  private async waitForRateLimit(machine: { id?: string; apiToken: string }): Promise<void> {
    const key = this.machineKey(machine);
    const now = Date.now();
    let timestamps = this.machineSendTimestamps.get(key) ?? [];
    timestamps = timestamps.filter((t) => now - t < SMS_RATE_LIMIT_WINDOW_MS);
    if (timestamps.length >= SMS_RATE_LIMIT_PER_MINUTE) {
      const oldest = Math.min(...timestamps);
      const waitMs = oldest + SMS_RATE_LIMIT_WINDOW_MS - now;
      if (waitMs > 0) {
        console.log(`Rate limit: machine ${key} waiting ${Math.round(waitMs / 1000)}s`);
        await this.sleep(waitMs);
      }
    }
    this.machineSendTimestamps.set(key, timestamps);
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
  }
}

export const executionEngine = new ExecutionEngine();
