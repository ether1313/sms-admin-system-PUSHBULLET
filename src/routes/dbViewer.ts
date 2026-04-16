import express, { Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { renderDbViewerPage, renderTaskContactsPage } from '../views/dbViewer'
import { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'

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

const FILTERABLE_COLUMNS: Record<string, string[]> = {
  company: ['id', 'code', 'name'],
  admin: ['id', 'username', 'role', 'companyId'],
  senderMachine: ['id', 'name', 'companyId'],
  task: ['id', 'name', 'status', 'adminId'],
  contact: ['id', 'taskId', 'phone', 'name'],
  taskMachine: ['id', 'taskId', 'machineId'],
  taskExecutionLog: ['id', 'taskId', 'contactId', 'status'],
}

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

    const filterCol = ((req.query.filterCol as string) || '').trim()
    const filterVal = ((req.query.filterVal as string) || '').trim()

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

    const baseWhere = superAdmin ? {} : getWhereForModel(model, adminId, companyId!)
    const filterWhere = buildFilterWhere(model, filterCol, filterVal, superAdmin)
    const where = mergeWhere(baseWhere, filterWhere)

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
    } else if (model === 'admin' && superAdmin) {
      const orderBy = { id: 'asc' as const }
      const [rawRows, totalCount] = await Promise.all([
        prisma.admin.findMany({
          where,
          take: limit,
          skip,
          orderBy,
          include: { _count: { select: { tasks: true } }, company: { select: { name: true } } },
        }),
        prisma.admin.count({ where }),
      ])
      total = totalCount
      rows = rawRows.map(({ password: _pw, _count, company, ...rest }) => ({
        ...rest,
        company: company?.name ?? '-',
        taskCount: _count?.tasks ?? 0,
      }))
    } else if (model === 'task') {
      const orderBy = { createdAt: 'desc' as const }
      const [rawRows, totalCount] = await Promise.all([
        prisma.task.findMany({
          where,
          take: limit,
          skip,
          orderBy,
          include: { _count: { select: { contacts: true } }, admin: { select: { username: true, company: { select: { name: true } } } } },
        }),
        prisma.task.count({ where }),
      ])
      total = totalCount
      rows = rawRows.map(({ admin, _count, adminId: aId, ...rest }) => ({
        ...rest,
        adminId: aId,
        admin: admin?.username ?? '-',
        company: admin?.company?.name ?? '-',
        contactCount: _count?.contacts ?? 0,
      }))
    } else {
      const orderBy = { id: 'asc' as const }
      const { rows: r, total: t } = await queryModel(prisma, model, where, limit, skip, orderBy)
      rows = r
      total = t
    }

    const filterableColumns = superAdmin ? (FILTERABLE_COLUMNS[model] || []) : []

    return res.send(renderDbViewerPage({
      tables, selectedTable: model, rows, total, page, limit, isSuperAdmin: superAdmin,
      taskExecutionLogSort: model === 'taskExecutionLog' ? { sortBy: logSortBy, order: logOrder } : undefined,
      taskExecutionLogDateFilter: model === 'taskExecutionLog' ? { dateFrom: logDateFrom, dateTo: logDateTo } : undefined,
      filterCol, filterVal, filterableColumns,
    }))
  } catch (error) {
    console.error('DB Viewer error:', error)
    res.status(500).send('Error loading database view')
  }
})

// ─── GET /task/:taskId/contacts ──────────────────────────
router.get('/task/:taskId/contacts', async (req: AuthRequest, res: Response) => {
  if (!isSuperAdmin(req)) { res.status(403).send('Forbidden'); return }
  try {
    const prisma = req.app.locals.prisma as PrismaClient
    const { taskId } = req.params
    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1)
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(String(req.query.limit), 10) || PAGE_SIZE))
    const skip = (page - 1) * limit
    const search = ((req.query.search as string) || '').trim()

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, name: true, status: true, admin: { select: { username: true, company: { select: { name: true } } } } },
    })
    if (!task) { res.status(404).send('Task not found'); return }

    const contactWhere: any = { taskId }
    if (search) {
      contactWhere.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({ where: contactWhere, take: limit, skip, orderBy: { id: 'asc' }, include: { logs: { select: { status: true, sentAt: true, errorMessage: true, machine: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 1 } } }),
      prisma.contact.count({ where: contactWhere }),
    ])

    const rows = contacts.map((c) => {
      const lastLog = c.logs[0]
      return {
        id: c.id,
        phone: c.phone,
        name: c.name ?? '-',
        sendStatus: lastLog?.status ?? 'pending',
        sentAt: lastLog?.sentAt?.toISOString() ?? '-',
        machine: lastLog?.machine?.name ?? '-',
        error: lastLog?.errorMessage ?? '-',
      }
    })

    return res.send(renderTaskContactsPage({
      task: { id: task.id, name: task.name, status: task.status, admin: task.admin?.username ?? '-', company: task.admin?.company?.name ?? '-' },
      rows, total, page, limit, search,
    }))
  } catch (error) {
    console.error('DB Viewer task contacts error:', error)
    res.status(500).send('Error loading contacts')
  }
})

// ─── GET /task/:taskId/contacts/export ───────────────────
router.get('/task/:taskId/contacts/export', async (req: AuthRequest, res: Response) => {
  if (!isSuperAdmin(req)) { res.status(403).send('Forbidden'); return }
  try {
    const prisma = req.app.locals.prisma as PrismaClient
    const { taskId } = req.params

    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { name: true } })
    if (!task) { res.status(404).send('Task not found'); return }

    const contacts = await prisma.contact.findMany({
      where: { taskId },
      orderBy: { id: 'asc' },
      include: { logs: { select: { status: true, sentAt: true, errorMessage: true, machine: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Contacts')

    sheet.columns = [
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Send Status', key: 'sendStatus', width: 15 },
      { header: 'Sent At', key: 'sentAt', width: 25 },
      { header: 'Machine', key: 'machine', width: 15 },
      { header: 'Error', key: 'error', width: 35 },
    ]

    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }

    for (const c of contacts) {
      const lastLog = c.logs[0]
      sheet.addRow({
        phone: c.phone,
        name: c.name ?? '',
        sendStatus: lastLog?.status ?? 'pending',
        sentAt: lastLog?.sentAt?.toISOString() ?? '',
        machine: lastLog?.machine?.name ?? '',
        error: lastLog?.errorMessage ?? '',
      })
    }

    const safeName = task.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
    const filename = `contacts_${safeName}_${taskId.slice(0, 8)}.xlsx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('DB Viewer export error:', error)
    res.status(500).send('Export failed')
  }
})

// ─── POST /pushbullet-devices (superadmin only) ─────────
router.post('/pushbullet-devices', async (req: AuthRequest, res: Response) => {
  if (!isSuperAdmin(req)) { res.status(403).send('Forbidden'); return }
  const token = ((req.body.token as string) || '').trim()
  if (!token) { res.status(400).send('Missing API token'); return }

  try {
    const resp = await fetch('https://api.pushbullet.com/v2/devices', {
      headers: { 'Access-Token': token },
    })
    if (!resp.ok) {
      const text = await resp.text()
      res.status(resp.status).json({ error: `Pushbullet API error: ${resp.status}`, detail: text })
      return
    }
    const data = await resp.json() as { devices?: { iden: string; nickname?: string; model?: string; active?: boolean; manufacturer?: string }[] }
    const devices = (data.devices || [])
      .filter((d) => d.active !== false)
      .map((d) => ({ iden: d.iden, nickname: d.nickname || '-', model: d.model || '-', manufacturer: d.manufacturer || '-' }))
    res.json({ devices })
  } catch (error) {
    console.error('Pushbullet API error:', error)
    res.status(500).json({ error: 'Failed to fetch devices' })
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

    if (req.body.ajax === '1') {
      res.json({ ok: true })
    } else {
      const redirectTable = req.body.redirectTable || table
      const redirectPage = req.body.redirectPage || '1'
      res.redirect(`/db-viewer?table=${encodeURIComponent(redirectTable)}&page=${redirectPage}`)
    }
  } catch (error) {
    console.error('DB Viewer update error:', error)
    if (req.body.ajax === '1') {
      res.status(500).json({ ok: false, error: 'Update failed' })
    } else {
      res.status(500).send('Update failed')
    }
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

function buildFilterWhere(model: string, col: string, val: string, superAdmin: boolean): object {
  if (!superAdmin || !col || !val) return {}
  const allowed = FILTERABLE_COLUMNS[model] || []
  if (!allowed.includes(col)) return {}
  if (col === 'status' || col === 'role') {
    return { [col]: val }
  }
  return { [col]: { contains: val, mode: 'insensitive' } }
}

function mergeWhere(a: object, b: object): object {
  const keys = [...Object.keys(a), ...Object.keys(b)]
  if (keys.length === 0) return {}
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length === 0) return b
  if (bKeys.length === 0) return a
  return { AND: [a, b] }
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
