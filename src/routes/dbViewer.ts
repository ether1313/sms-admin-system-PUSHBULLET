import express, { Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { renderDbViewerPage } from '../views/dbViewer'
import { PrismaClient } from '@prisma/client'

const router = express.Router()

// Whitelist of Prisma model names (camelCase) — read-only, no arbitrary access
const ALLOWED_MODELS = [
  'admin',
  'senderMachine',
  'task',
  'taskExecutionLog',
] as const

const PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const TASK_EXECUTION_LOG_SORTABLE = ['id', 'createdAt', 'sentAt', 'status', 'retryCount'] as const

router.use(requireAuth)

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient
    const tableParamRaw = (req.query.table as string)?.trim() || ''
    const tableParam = ALLOWED_MODELS.includes(tableParamRaw as (typeof ALLOWED_MODELS)[number])
      ? tableParamRaw
      : ''
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1)
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(String(req.query.limit), 10) || PAGE_SIZE)
    )

    const tables = ALLOWED_MODELS.map((m) => ({
      key: m,
      label: m.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim(),
    }))

    if (!tableParam) {
      return res.send(renderDbViewerPage({ tables, selectedTable: null }))
    }

    const adminId = req.session?.adminId
    if (!adminId) {
      res.status(403).send('Forbidden: not authenticated')
      return
    }

    const model = tableParam as (typeof ALLOWED_MODELS)[number]
    const skip = (page - 1) * limit

    const sessionCompanyId = req.session?.companyId
    let companyId = sessionCompanyId
    if (!companyId) {
      const admin = await prisma.admin.findUnique({
        where: { id: adminId },
        select: { companyId: true },
      })
      if (!admin) {
        res.status(403).send('Forbidden: invalid admin')
        return
      }
      companyId = admin.companyId
      req.session.companyId = companyId
    }

    // Restrict each table to rows belonging to the current admin/company.
    const whereByModel: Record<string, object> = {
      admin: { id: adminId },
      senderMachine: { companyId },
      task: { adminId },
      taskExecutionLog: { task: { adminId } },
    }
    const where = whereByModel[model] ?? {}

    let rows: Record<string, unknown>[]
    let total: number
    let logSortBy = 'createdAt'
    let logOrder: 'asc' | 'desc' = 'desc'
    let logDateFrom: string | undefined
    let logDateTo: string | undefined

    if (model === 'taskExecutionLog') {
      const sortByRaw = (req.query.sortBy as string)?.trim() || ''
      const orderRaw = ((req.query.order as string)?.toLowerCase() || '') as 'asc' | 'desc'
      logSortBy = TASK_EXECUTION_LOG_SORTABLE.includes(sortByRaw as (typeof TASK_EXECUTION_LOG_SORTABLE)[number])
        ? sortByRaw
        : 'createdAt'
      logOrder = orderRaw === 'asc' || orderRaw === 'desc' ? orderRaw : 'desc'

      const dateFromRaw = (req.query.dateFrom as string)?.trim()
      const dateToRaw = (req.query.dateTo as string)?.trim()
      if (dateFromRaw) {
        const d = new Date(dateFromRaw)
        if (!Number.isNaN(d.getTime())) logDateFrom = dateFromRaw
      }
      if (dateToRaw) {
        const d = new Date(dateToRaw)
        if (!Number.isNaN(d.getTime())) logDateTo = dateToRaw
      }

      const logWhere = { ...(where as { task: { adminId: string } }) } as {
        task: { adminId: string }
        createdAt?: { gte?: Date; lte?: Date }
      }
      if (logDateFrom || logDateTo) {
        logWhere.createdAt = {}
        if (logDateFrom) logWhere.createdAt.gte = new Date(logDateFrom)
        if (logDateTo) {
          const end = new Date(logDateTo)
          end.setHours(23, 59, 59, 999)
          logWhere.createdAt.lte = end
        }
      }

      const [rawRows, totalCount] = await Promise.all([
        prisma.taskExecutionLog.findMany({
          where: logWhere,
          include: { machine: { select: { name: true } } },
          take: limit,
          skip,
          orderBy: { [logSortBy]: logOrder },
        }),
        prisma.taskExecutionLog.count({ where: logWhere }),
      ])
      total = totalCount
      rows = rawRows.map(({ machineId, machine, ...rest }) => ({
        ...rest,
        machine: machine?.name ?? '-',
      }))
    } else {
      const delegate = prisma[model] as any
      const [rowsResult, totalCount] = await Promise.all([
        delegate.findMany({ where, take: limit, skip, orderBy: { id: 'asc' as const } }).catch(() => []),
        delegate.count({ where }).catch(() => 0),
      ])
      rows = rowsResult
      total = totalCount
    }

    return res.send(
      renderDbViewerPage({
        tables,
        selectedTable: model,
        rows,
        total,
        page,
        limit,
        taskExecutionLogSort: model === 'taskExecutionLog' ? { sortBy: logSortBy, order: logOrder } : undefined,
        taskExecutionLogDateFilter: model === 'taskExecutionLog' ? { dateFrom: logDateFrom, dateTo: logDateTo } : undefined,
      })
    )
  } catch (error) {
    console.error('DB Viewer error:', error)
    res.status(500).send('Error loading database view')
  }
})

export { router as dbViewerRouter }
