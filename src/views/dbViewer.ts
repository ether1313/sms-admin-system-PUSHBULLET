import { renderLayout } from './layout'

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return String(text).replace(/[&<>"']/g, (c) => map[c] ?? c)
}

function formatCell(value: unknown): string {
  if (value == null) return '<span class="text-slate-400">-</span>'
  if (value instanceof Date) return escapeHtml(value.toISOString())
  if (typeof value === 'object') return escapeHtml(JSON.stringify(value))
  return escapeHtml(String(value))
}

function maskPassword(key: string, value: unknown): string {
  if (key.toLowerCase() === 'password' && value != null) return '••••••••'
  return formatCell(value)
}

export interface DbViewerTable {
  key: string
  label: string
}

export interface DbViewerOptions {
  tables: DbViewerTable[]
  selectedTable: string | null
  rows?: Record<string, unknown>[]
  total?: number
  page?: number
  limit?: number
  isSuperAdmin?: boolean
  taskExecutionLogSort?: { sortBy: string; order: 'asc' | 'desc' }
  taskExecutionLogDateFilter?: { dateFrom?: string; dateTo?: string }
  filterCol?: string
  filterVal?: string
  filterableColumns?: string[]
}

export interface TaskContactsOptions {
  task: { id: string; name: string; status: string; admin: string; company: string }
  rows: { id: string; phone: string; name: string; sendStatus: string; sentAt: string; machine: string; error: string }[]
  total: number
  page: number
  limit: number
  search: string
}

const TASK_EXECUTION_LOG_SORTABLE = ['id', 'createdAt', 'sentAt', 'status', 'retryCount']
const NON_EDITABLE_FIELDS = ['id', 'createdAt', 'updatedAt']

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') q.set(k, String(v))
  }
  return '/db-viewer?' + q.toString()
}

// ═══════════════════════════════════════════════════════════
//  Main DB Viewer page
// ═══════════════════════════════════════════════════════════
export function renderDbViewerPage(opts: DbViewerOptions): string {
  const {
    tables, selectedTable, rows = [], total = 0, page = 1, limit = 50,
    isSuperAdmin = false, taskExecutionLogSort, taskExecutionLogDateFilter,
    filterCol = '', filterVal = '', filterableColumns = [],
  } = opts
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseUrl = '/db-viewer'
  const isLogTable = selectedTable === 'taskExecutionLog'
  const isTaskTable = selectedTable === 'task'
  const logSort = taskExecutionLogSort ?? { sortBy: 'createdAt', order: 'desc' as const }
  const logDateFrom = taskExecutionLogDateFilter?.dateFrom ?? ''
  const logDateTo = taskExecutionLogDateFilter?.dateTo ?? ''

  // Build current query params for links
  const curParams: Record<string, string | number | undefined> = {
    table: selectedTable ?? undefined,
    limit,
    filterCol: filterCol || undefined,
    filterVal: filterVal || undefined,
  }
  if (isLogTable) {
    curParams.sortBy = logSort.sortBy
    curParams.order = logSort.order
    if (logDateFrom) curParams.dateFrom = logDateFrom
    if (logDateTo) curParams.dateTo = logDateTo
  }

  const tableLinks = tables
    .map((t) => {
      const isActive = selectedTable === t.key
      const href = buildQuery({ table: t.key, page: 1, limit })
      return `<a href="${href}" data-nav="${baseUrl}" class="block rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'}">${escapeHtml(t.label)}</a>`
    })
    .join('')

  let dataSection = ''
  if (selectedTable && (rows.length > 0 || total === 0)) {
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []

    const thead = columns
      .map((col) => {
        const sortable = isLogTable && TASK_EXECUTION_LOG_SORTABLE.includes(col)
        if (sortable) {
          const nextOrder = logSort.sortBy === col && logSort.order === 'asc' ? 'desc' : 'asc'
          const href = buildQuery({ ...curParams, page: 1, sortBy: col, order: nextOrder })
          const arrow = logSort.sortBy === col ? (logSort.order === 'asc' ? ' ↑' : ' ↓') : ''
          return `<th class="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap"><a href="${escapeHtml(href)}" class="hover:text-slate-900 transition-colors">${escapeHtml(col)}${escapeHtml(arrow)}</a></th>`
        }
        return `<th class="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">${escapeHtml(col)}</th>`
      })
      .join('')
    const actionsHeader = isSuperAdmin
      ? '<th class="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Actions</th>'
      : ''

    const tbody = rows.length === 0
      ? `<tr><td colspan="${columns.length + (isSuperAdmin ? 1 : 0)}" class="px-4 py-10 text-center text-slate-500">No rows</td></tr>`
      : rows.map((row) => {
          const rowId = String((row as any).id ?? '')
          const cells = columns
            .map((col) => `<td class="px-4 py-3 text-sm text-slate-800 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis" title="${escapeHtml(String((row as any)[col] ?? ''))}">${maskPassword(col, (row as any)[col])}</td>`)
            .join('')
          let actionsCells = ''
          if (isSuperAdmin) {
            const contactsBtn = isTaskTable
              ? `<a href="/db-viewer/task/${escapeHtml(rowId)}/contacts" class="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors">Contacts</a>`
              : ''
            actionsCells = `<td class="px-4 py-3 text-sm whitespace-nowrap">
                <div class="flex gap-1.5">
                  ${contactsBtn}
                  <button type="button" onclick="openEditModal('${escapeHtml(selectedTable)}', '${escapeHtml(rowId)}', ${escapeHtml(JSON.stringify(JSON.stringify(row)))})" class="rounded-md bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors">Edit</button>
                  <form method="post" action="/db-viewer/delete" onsubmit="return confirm('Delete this row?')" class="inline">
                    <input type="hidden" name="table" value="${escapeHtml(selectedTable)}" />
                    <input type="hidden" name="id" value="${escapeHtml(rowId)}" />
                    <input type="hidden" name="redirectTable" value="${escapeHtml(selectedTable)}" />
                    <input type="hidden" name="redirectPage" value="${page}" />
                    <button type="submit" class="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors">Delete</button>
                  </form>
                </div>
              </td>`
          }
          return `<tr class="border-t border-slate-100 transition-colors duration-150 hover:bg-slate-50/80">${cells}${actionsCells}</tr>`
        }).join('')

    const pageHref = (p: number) => buildQuery({ ...curParams, page: p })
    const prevPage = page > 1 ? page - 1 : null
    const nextPage = page < totalPages ? page + 1 : null
    const pagination = totalPages <= 1 ? '' : `
    <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 px-4 pb-3">
      <p class="text-sm text-slate-500">Page ${page} of ${totalPages} · ${total} row(s)</p>
      <div class="flex gap-2">
        ${prevPage ? `<a href="${escapeHtml(pageHref(prevPage))}" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900">Previous</a>` : ''}
        ${nextPage ? `<a href="${escapeHtml(pageHref(nextPage))}" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900">Next</a>` : ''}
      </div>
    </div>`

    // Filter bar for superadmin
    const filterBar = isSuperAdmin && filterableColumns.length > 0 ? `
    <form method="get" action="/db-viewer" class="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
      <input type="hidden" name="table" value="${escapeHtml(selectedTable)}" />
      <input type="hidden" name="limit" value="${limit}" />
      ${isLogTable ? `<input type="hidden" name="sortBy" value="${escapeHtml(logSort.sortBy)}" /><input type="hidden" name="order" value="${escapeHtml(logSort.order)}" />` : ''}
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Column</span>
        <select name="filterCol" class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 bg-white">
          ${filterableColumns.map((c) => `<option value="${escapeHtml(c)}" ${c === filterCol ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Value</span>
        <input type="text" name="filterVal" value="${escapeHtml(filterVal)}" placeholder="Search..." class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 w-48" />
      </label>
      <button type="submit" class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors">Filter</button>
      ${filterVal ? `<a href="${buildQuery({ table: selectedTable, page: 1, limit })}" class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Clear</a>` : ''}
    </form>` : ''

    // Date filter for log table
    const dateFilterBar = isLogTable ? `
    <form method="get" action="/db-viewer" class="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
      <input type="hidden" name="table" value="taskExecutionLog" />
      <input type="hidden" name="limit" value="${escapeHtml(String(limit))}" />
      <input type="hidden" name="sortBy" value="${escapeHtml(logSort.sortBy)}" />
      <input type="hidden" name="order" value="${escapeHtml(logSort.order)}" />
      ${filterCol ? `<input type="hidden" name="filterCol" value="${escapeHtml(filterCol)}" />` : ''}
      ${filterVal ? `<input type="hidden" name="filterVal" value="${escapeHtml(filterVal)}" />` : ''}
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">From date</span>
        <input type="date" name="dateFrom" value="${escapeHtml(logDateFrom)}" class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">To date</span>
        <input type="date" name="dateTo" value="${escapeHtml(logDateTo)}" class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800" />
      </label>
      <button type="submit" class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors">Filter</button>
    </form>` : ''

    dataSection = `
    <div class="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div class="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h2 class="text-lg font-semibold text-slate-900">${escapeHtml(selectedTable)}</h2>
        <span class="text-sm text-slate-500">${total} row(s)${filterVal ? ' (filtered)' : ''}</span>
      </div>
      ${filterBar}
      ${dateFilterBar}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100">
          <thead class="bg-slate-50/80">
            <tr>${thead}${actionsHeader}</tr>
          </thead>
          <tbody class="divide-y divide-slate-100">${tbody}</tbody>
        </table>
      </div>
      ${pagination}
    </div>`
  } else if (selectedTable) {
    dataSection = '<div class="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-sm">Loading or no data.</div>'
  }

  const emptyState = `
  <div class="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
    <div class="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    </div>
    <p class="text-sm font-medium text-slate-700">Select a table</p>
    <p class="mt-1 text-sm text-slate-500">Choose a table from the list to view its data.</p>
  </div>`

  const editModal = isSuperAdmin ? `
  <div id="editModal" class="fixed inset-0 z-50 hidden">
    <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" onclick="closeEditModal()"></div>
    <div class="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto pointer-events-auto border border-slate-200">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
          <h3 class="text-lg font-semibold text-slate-900" id="editModalTitle">Edit Row</h3>
          <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div id="editModalBody" class="px-6 py-4 space-y-3"></div>
      </div>
    </div>
  </div>
  <script>
    const NON_EDITABLE = ${JSON.stringify(NON_EDITABLE_FIELDS)};
    function openEditModal(table, rowId, rowJson) {
      const data = JSON.parse(rowJson);
      const modal = document.getElementById('editModal');
      const body = document.getElementById('editModalBody');
      const title = document.getElementById('editModalTitle');
      title.textContent = 'Edit ' + table + ' #' + (rowId.length > 12 ? rowId.slice(0,12) + '...' : rowId);
      let html = '';
      for (const [key, val] of Object.entries(data)) {
        const isReadonly = NON_EDITABLE.includes(key);
        const displayVal = val == null ? '' : String(val);
        if (isReadonly) {
          html += '<div class="space-y-1"><label class="block text-xs font-medium text-slate-500 uppercase tracking-wide">' + escH(key) + '</label><div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-600">' + escH(displayVal) + '</div></div>';
        } else if (key.toLowerCase() === 'password') {
          html += '<div class="space-y-1"><label class="block text-xs font-medium text-slate-500 uppercase tracking-wide">' + escH(key) + ' (hashed)</label><div class="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-400">••••••••</div></div>';
        } else {
          html += '<form method="post" action="/db-viewer/update" class="space-y-1">' +
            '<input type="hidden" name="table" value="' + escH(table) + '" />' +
            '<input type="hidden" name="id" value="' + escH(rowId) + '" />' +
            '<input type="hidden" name="field" value="' + escH(key) + '" />' +
            '<input type="hidden" name="redirectTable" value="' + escH(table) + '" />' +
            '<input type="hidden" name="redirectPage" value="${page}" />' +
            '<label class="block text-xs font-medium text-slate-500 uppercase tracking-wide">' + escH(key) + '</label>' +
            '<div class="flex gap-2">' +
            '<input type="text" name="value" value="' + escH(displayVal) + '" class="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-colors" />' +
            '<button type="submit" class="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 transition-colors whitespace-nowrap">Save</button>' +
            '</div></form>';
        }
      }
      body.innerHTML = html;
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    function closeEditModal() { document.getElementById('editModal').classList.add('hidden'); document.body.style.overflow = ''; }
    function escH(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeEditModal(); });
  </script>` : ''

  const roleBadge = isSuperAdmin
    ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">Super Admin</span>'
    : ''

  const content = `
  <div class="mb-8">
    <div class="flex items-center gap-3">
      <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">DB Viewer</h1>
      ${roleBadge}
    </div>
    <p class="mt-1.5 text-sm text-slate-500">${isSuperAdmin ? 'Full access — all tables, all data. You can edit and delete rows.' : 'Read-only view of database tables. Select a table below.'}</p>
  </div>
  <div class="flex flex-col lg:flex-row gap-6">
    <aside class="lg:w-52 flex-shrink-0">
      <nav class="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm space-y-0.5">
        ${tableLinks}
      </nav>
    </aside>
    <div class="flex-1 min-w-0">
      ${dataSection || emptyState}
    </div>
  </div>
  ${editModal}`

  return renderLayout('DB Viewer', content, true, isSuperAdmin)
}

// ═══════════════════════════════════════════════════════════
//  Task Contacts page (superadmin only)
// ═══════════════════════════════════════════════════════════
export function renderTaskContactsPage(opts: TaskContactsOptions): string {
  const { task, rows, total, page, limit, search } = opts
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const baseUrl = `/db-viewer/task/${escapeHtml(task.id)}/contacts`

  const pageHref = (p: number) => {
    const q = new URLSearchParams()
    q.set('page', String(p))
    q.set('limit', String(limit))
    if (search) q.set('search', search)
    return `${baseUrl}?${q.toString()}`
  }

  const statusColor: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  const thead = `
    <tr>
      <th class="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone</th>
      <th class="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
      <th class="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
      <th class="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Sent At</th>
      <th class="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Machine</th>
      <th class="px-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Error</th>
    </tr>`

  const tbody = rows.length === 0
    ? '<tr><td colspan="6" class="px-4 py-10 text-center text-slate-500">No contacts</td></tr>'
    : rows.map((r) => {
        const sc = statusColor[r.sendStatus] || 'bg-slate-50 text-slate-600 border-slate-200'
        return `<tr class="border-t border-slate-100 transition-colors duration-150 hover:bg-slate-50/80">
          <td class="px-4 py-3 text-sm text-slate-800 font-mono">${escapeHtml(r.phone)}</td>
          <td class="px-4 py-3 text-sm text-slate-800">${escapeHtml(r.name)}</td>
          <td class="px-4 py-3 text-sm"><span class="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sc}">${escapeHtml(r.sendStatus)}</span></td>
          <td class="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">${escapeHtml(r.sentAt)}</td>
          <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(r.machine)}</td>
          <td class="px-4 py-3 text-sm text-slate-500 max-w-xs overflow-hidden text-ellipsis" title="${escapeHtml(r.error)}">${escapeHtml(r.error)}</td>
        </tr>`
      }).join('')

  const prevPage = page > 1 ? page - 1 : null
  const nextPage = page < totalPages ? page + 1 : null
  const pagination = totalPages <= 1 ? '' : `
  <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 px-4 pb-3">
    <p class="text-sm text-slate-500">Page ${page} of ${totalPages} · ${total} contact(s)</p>
    <div class="flex gap-2">
      ${prevPage ? `<a href="${escapeHtml(pageHref(prevPage))}" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Previous</a>` : ''}
      ${nextPage ? `<a href="${escapeHtml(pageHref(nextPage))}" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Next</a>` : ''}
    </div>
  </div>`

  const taskStatusColor: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700',
    running: 'bg-blue-50 text-blue-700',
    scheduled: 'bg-amber-50 text-amber-700',
    failed: 'bg-rose-50 text-rose-700',
    draft: 'bg-slate-100 text-slate-600',
  }
  const tsc = taskStatusColor[task.status] || 'bg-slate-100 text-slate-600'

  const content = `
  <div class="mb-6">
    <a href="/db-viewer?table=task&page=1&limit=50" class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Back to Tasks
    </a>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight text-slate-900">${escapeHtml(task.name)}</h1>
          <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tsc}">${escapeHtml(task.status)}</span>
        </div>
        <p class="mt-1 text-sm text-slate-500">${escapeHtml(task.company)} · ${escapeHtml(task.admin)} · ${total} contacts</p>
      </div>
      <a href="/db-viewer/task/${escapeHtml(task.id)}/contacts/export" class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Export Excel
      </a>
    </div>
  </div>

  <div class="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
    <form method="get" action="${baseUrl}" class="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
      <input type="hidden" name="limit" value="${limit}" />
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Search phone / name</span>
        <input type="text" name="search" value="${escapeHtml(search)}" placeholder="Search..." class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 w-56" />
      </label>
      <button type="submit" class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors">Search</button>
      ${search ? `<a href="${baseUrl}?page=1&limit=${limit}" class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Clear</a>` : ''}
    </form>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-100">
        <thead class="bg-slate-50/80">${thead}</thead>
        <tbody class="divide-y divide-slate-100">${tbody}</tbody>
      </table>
    </div>
    ${pagination}
  </div>`

  return renderLayout('Task Contacts', content, true, true)
}
