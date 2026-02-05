import express, { Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import {
  renderTaskList,
  renderTaskCreate,
  renderTaskDetail,
} from '../views/tasks'
import { parseContacts } from '../utils/contacts'
import { executionEngine } from '../services/executionEngine'

const router = express.Router()

// 🔐 auth
router.use(requireAuth)

// ================= Task list =================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma

    const allowedStatuses = [
      'all',
      'draft',
      'scheduled',
      'running',
      'completed',
      'failed',
    ] as const
    const allowedSorts = [
      'name',
      'status',
      'contacts',
      'scheduledAt',
      'createdAt',
    ] as const
    const allowedDirs = ['asc', 'desc'] as const

    const statusRaw = (req.query.status as string | undefined) || 'all'
    const sortRaw = (req.query.sort as string | undefined) || 'createdAt'
    const dirRaw = (req.query.dir as string | undefined) || 'desc'

    const status = (allowedStatuses as readonly string[]).includes(statusRaw)
      ? statusRaw
      : 'all'
    const sort = (allowedSorts as readonly string[]).includes(sortRaw)
      ? sortRaw
      : 'createdAt'
    const dir = (allowedDirs as readonly string[]).includes(dirRaw) ? dirRaw : 'desc'

    const adminId = req.session?.adminId
    if (!adminId) {
      return res.status(401).send('Unauthorized')
    }

    const where: any = {
      adminId,
      ...(status !== 'all' ? { status } : {}),
    }

    // Prisma typing for relation-count ordering is a bit finicky; keep this minimal and safe.
    const orderBy: any =
      sort === 'name'
        ? { name: dir }
        : sort === 'status'
        ? { status: dir }
        : sort === 'scheduledAt'
        ? { scheduledAt: dir }
        : sort === 'contacts'
        ? { contacts: { _count: dir } }
        : { createdAt: dir }

    const tasks = await prisma.task.findMany({
      where,
      orderBy,
      include: {
        _count: {
          select: { contacts: true, logs: true },
        },
      },
    })

    res.send(renderTaskList(tasks, { status, sort, dir }))
  } catch (error) {
    console.error(error)
    res.status(500).send('Error fetching tasks')
  }
})

// ================= Create page =================
router.get('/create', async (req: AuthRequest, res: Response) => {
  const prisma = req.app.locals.prisma
  const list = await prisma.senderMachine.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  // Sort by number in name so SIM 1, SIM 2, ..., SIM 10 (not SIM 1, SIM 10, SIM 2)
  const machines = [...list].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0
    const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0
    return numA - numB
  })
  res.send(renderTaskCreate(machines))
})

// ================= Create handler =================
router.post('/', async (req: AuthRequest, res: Response) => {
  const adminId = req.session?.adminId
  if (!adminId) {
    return res.status(401).send('Unauthorized')
  }

  const prisma = req.app.locals.prisma
  const name = req.body.name
  const message = req.body.message
  const scheduledAt = req.body.scheduledAt

  // machineIds: array from form (machineIds[] or single machineIds)
  const machineIdsRaw = req.body.machineIds
  const machineIds = Array.isArray(machineIdsRaw)
    ? machineIdsRaw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : typeof machineIdsRaw === 'string' && machineIdsRaw.length > 0
    ? [machineIdsRaw]
    : []

  if (machineIds.length === 0) {
    return res.status(400).send('Select at least one sender machine')
  }

  // ✅ 兼容不同 textarea name
  const contactsRaw =
    req.body.contacts ||
    req.body.contactsText ||
    req.body.contacts_input

  if (!name || !message || !contactsRaw) {
    return res.status(400).send('Missing required fields')
  }

  try {
    const parsedContacts = parseContacts(contactsRaw)

    if (parsedContacts.length === 0) {
      return res.status(400).send('No valid contacts provided')
    }

    // Validate machine IDs exist
    const machines = await prisma.senderMachine.findMany({
      where: { id: { in: machineIds } },
      select: { id: true },
    })
    if (machines.length !== machineIds.length) {
      return res.status(400).send('Invalid sender machine selected')
    }

    // If no time selected, schedule immediately (now).
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : new Date()

    const task = await prisma.task.create({
      data: {
        name,
        message,
        status: 'scheduled',
        scheduledAt: scheduledDate,
        adminId,
        contacts: {
          create: parsedContacts.map((c) => ({
            phone: c.phone,
            name: c.name || null,
          })),
        },
        taskMachines: {
          create: machineIds.map((machineId) => ({ machineId })),
        },
      },
    })

    // If scheduled time is now/past, execute immediately.
    if (scheduledDate <= new Date()) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      })
      executionEngine.executeTask(task.id, prisma)
    }

    res.redirect(`/tasks/${task.id}`)
  } catch (error) {
    console.error(error)
    res.status(500).send('Error creating task')
  }
})

// ================= Task detail =================
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma
    const adminId = req.session?.adminId

    if (!adminId) {
      return res.status(401).send('Unauthorized')
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        contacts: {
          include: {
            logs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        logs: {
          orderBy: { createdAt: 'desc' },
          include: { contact: true },
        },
      },
    })

    if (!task) return res.status(404).send('Task not found')
    if (task.adminId !== adminId) return res.status(403).send('Forbidden: This task belongs to another admin')

    res.send(renderTaskDetail(task))
  } catch (error) {
    console.error(error)
    res.status(500).send('Error fetching task')
  }
})

// ================= Manual trigger =================
router.post('/:id/trigger', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma
    const adminId = req.session?.adminId

    if (!adminId) {
      return res.status(401).send('Unauthorized')
    }

    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: { contacts: true },
    })

    if (!task) return res.status(404).send('Task not found')
    if (task.adminId !== adminId) return res.status(403).send('Forbidden: This task belongs to another admin')
    if (task.status === 'running')
      return res.status(400).send('Task already running')

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    })

    executionEngine.executeTask(task.id, prisma)
    res.redirect(`/tasks/${task.id}`)
  } catch (error) {
    console.error(error)
    res.status(500).send('Error triggering task')
  }
})

export { router as tasksRouter }
