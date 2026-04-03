import express, { Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { renderDbViewerPage } from '../views/dbViewer'
import { PrismaClient } from '@prisma/client'

const router = express.Router()

const ADMIN_MODELS = [
  'admin',
  'senderMachine',
  'task',
  'taskExecutionLog',
] as const

const SUPERADMIN_MODELS = [
  'company',
  'admin',
  'senderMachine',
  'task',
  'contact',
  'taskMachine',
  'taskExecutionLog',
] as const

const PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

const TASK_EXECUTION_LOG_SORTABLE = ['id', 'createdAt', 'sentAt', 'status', 'retryCount'] as const

router.use(requireAuth)

function isSuperAdmin(req: AuthRequest): boolean {
  return req.session?.role === 'superadmin'
}

function getAllowedModels(req: AuthRequest) {
  return isSuperAdmin(req) ? [...SUPERADMIN_MODELS] : [...ADMIN_MODELS]
}

function labelForModel(m: string): string {
  return m.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim()
}

// ─── GET / ───────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const prisma = req.app.locals.prisma as PrismaClient
    const superAdmin = isSuperAdmin(req)
    const allowedModels = getAllowedModels(req)

    const tableParamRaw = (req.query.table as string)?.trim() || ''
    const tableParam = allowedModels.includes(tableParamRaw as any) ? tableParamRaw : ''
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1)
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(req.query.limit), 10) || PAGE_SIZE))

    const tables = allowedModels.map((m) => ({ key: m, label: labelForModel(m) }))

    if (!tableParam) {
      return res.send(renderDbViewerPage({ tables, selectedTable: null, isSuperAdmin: superAdmin }))
    }

    const adminId = req.session?.adminId
    if (!adminId) { res.status(403).send('Forbidden'); return }

    const model = tableParam
    const skip = (page - 1) * limit

    let companyId = req.session?.companyId
    if (!companyId && !superAdmin) {
      const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { companyId: true } })
      if (!admin) { res.status(403).send('Forbidden'); return }
      companyId = admin.companyId
      req.session.companyId = companyId
    }

    const where = superAdmin ? {} : getWhereForModel(model, adminId, companyId!)

    let rows: Record<string, unknown>[]
    let total: number
    let logSortBy = 'createdAt'
    let logOrder: 'asc' | 'desc' = 'desc'
    let logDateFrom: string | undefined
    let logDateTo: string | undefined

    if (model === 'taskExecutionLog') {
      const sortByRaw = (req.query.sortBy as string)?.trim() || ''
      const orderRaw = ((req.query.order as string)?.toLowerCase() || '') as 'asc' | 'desc'
      logSortBy = TASK_EXECUTION_LOG_SORTABLE.includes(sortByRaw as any) ? sortByRaw : 'createdAt'
      logOrder = orderRaw === 'asc' || orderRaw === 'desc' ? orderRaw : 'desc'

      const dateFromRaw = (req.query.dateFrom as string)?.trim()
      const dateToRaw = (req.query.dateTo as string)?.trim()
      if (dateFromRaw) { const d = new Date(dateFromRaw); if (!Number.isNaN(d.getTime())) logDateFrom = dateFromRaw }
      if (dateToRaw) { const d = new Date(dateToRaw); if (!Number.isNaN(d.getTime())) logDateTo = dateToRaw }

      const logWhere: any = { ...where }
      if (logDateFrom || logDateTo) {
        logWhere.createdAt = {}
        if (logDateFrom) logWhere.createdAt.gte = new Date(logDateFrom)
        if (logDateTo) { const end = new Date(logDateTo); end.setHours(23, 59, 59, 999); logWhere.createdAt.lte = end }
      }

      const [rawRows, totalCount] = await Promise.all([
        prisma.taskExecutionLog.findMany({ where: logWhere, include: { machine: { select: { name: true } } }, take: limit, skip, orderBy: { [logSortBy]: logOrder } }),
        prisma.taskExecutionLog.count({ where: logWhere }),
      ])
      total = totalCount
      rows = rawRows.map(({ machineId, machine, ...rest }) => ({ ...rest, machine: machine?.name ?? '-' }))
    } else {
      const orderBy = { id: 'asc' as const }
      const { rows: r, total: t } = await queryModel(prisma, model, where, limit, skip, orderBy)
      rows = r
      total = t
    }

    return res.send(renderDbViewerPage({
      tables, selectedTable: model, rows, total, page, limit, isSuperAdmin: superAdmin,
      taskExecutionLogSort: model === 'taskExecutionLog' ? { sortBy: logSortBy, order: logOrder } : undefined,
      taskExecutionLogDateFilter: model === 'taskExecutionLog' ? { dateFrom: logDateFrom, dateTo: logDateTo } : undefined,
    }))
  } catch (error) {
    console.error('DB Viewer error:', error)
    res.status(500).send('Error loading database view')
  }
})

// ─── POST /update (superadmin only) ──────────────────────
router.post('/update', async (req: AuthRequest, res: Response) => {
  if (!isSuperAdmin(req)) { res.status(403).send('Forbidden'); return }
  try {
    const prisma = req.app.locals.prisma as PrismaClient
    const { table, id, field, value } = req.body
    const allowedModels = getAllowedModels(req)
    if (!allowedModels.includes(table)) { res.status(400).send('Invalid table'); return }
    if (!id || !field) { res.status(400).send('Missing id or field'); return }

    const delegate = (prisma as any)[table]
    if (!delegate) { res.status(400).send('Invalid table'); return }

    await delegate.update({ where: { id }, data: { [field]: value } })
    const redirectTable = req.body.redirectTable || table
    const redirectPage = req.body.redirectPage || '1'
    res.redirect(`/db-viewer?table=${encodeURIComponent(redirectTable)}&page=${redirectPage}`)
  } catch (error) {
    console.error('DB Viewer update error:', error)
    res.status(500).send('Update failed')
  }
})

// ─── POST /delete (superadmin only) ─────────────────────
router.post('/delete', async (req: AuthRequest, res: Response) => {
  if (!isSuperAdmin(req)) { res.status(403).send('Forbidden'); return }
  try {
    const prisma = req.app.locals.prisma as PrismaClient
    const { table, id } = req.body
    const allowedModels = getAllowedModels(req)
    if (!allowedModels.includes(table)) { res.status(400).send('Invalid table'); return }
    if (!id) { res.status(400).send('Missing id'); return }

    const delegate = (prisma as any)[table]
    if (!delegate) { res.status(400).send('Invalid table'); return }

    await delegate.delete({ where: { id } })
    const redirectTable = req.body.redirectTable || table
    const redirectPage = req.body.redirectPage || '1'
    res.redirect(`/db-viewer?table=${encodeURIComponent(redirectTable)}&page=${redirectPage}`)
  } catch (error) {
    console.error('DB Viewer delete error:', error)
    res.status(500).send('Delete failed')
  }
})

// ─── Helpers ─────────────────────────────────────────────

function getWhereForModel(model: string, adminId: string, companyId: string): object {
  switch (model) {
    case 'admin': return { id: adminId }
    case 'senderMachine': return { companyId }
    case 'task': return { adminId }
    case 'taskExecutionLog': return { task: { adminId } }
    default: return {}
  }
}

async function queryModel(
  prisma: PrismaClient,
  model: string,
  where: object,
  limit: number,
  skip: number,
  orderBy: object,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  try {
    const delegate = (prisma as any)[model]
    if (!delegate) return { rows: [], total: 0 }
    const [rows, total] = await Promise.all([
      delegate.findMany({ where, take: limit, skip, orderBy }),
      delegate.count({ where }),
    ])
    return { rows, total }
  } catch {
    return { rows: [], total: 0 }
  }
}

export { router as dbViewerRouter }
