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

  const pbModal = isSuperAdmin ? `
  <div id="pbModal" class="fixed inset-0 z-50 hidden">
    <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" onclick="closePbModal()"></div>
    <div class="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto border border-slate-200 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div class="flex items-center gap-2.5">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3"/></svg>
            </span>
            <h3 class="text-base font-semibold text-slate-900">Pushbullet Device Lookup</h3>
          </div>
          <button onclick="closePbModal()" class="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="px-5 py-4">
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Pushbullet API Token</label>
          <div class="flex gap-2">
            <input type="text" id="pb-token" placeholder="o.xxxxxxxxxxxxxxxxxxxxxxx" class="flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-colors font-mono" />
            <button type="button" id="pb-check-btn" onclick="checkPbDevices()" class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm">Check</button>
          </div>
          <div id="pb-result" class="mt-4 hidden"></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    function closePbModal() { document.getElementById('pbModal').classList.add('hidden'); document.body.style.overflow = ''; }
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && !document.getElementById('pbModal').classList.contains('hidden')) closePbModal(); });
    async function checkPbDevices() {
      var token = document.getElementById('pb-token').value.trim();
      var rd = document.getElementById('pb-result');
      var btn = document.getElementById('pb-check-btn');
      if (!token) { rd.innerHTML = '<p class="text-sm text-rose-600">Please enter a token</p>'; rd.classList.remove('hidden'); return; }
      btn.disabled = true; btn.textContent = 'Checking...'; rd.innerHTML = ''; rd.classList.add('hidden');
      try {
        var res = await fetch('/db-viewer/pushbullet-devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) });
        var data = await res.json();
        if (!res.ok) { rd.innerHTML = '<p class="text-sm text-rose-600">' + _e(data.error || 'Error') + '</p>'; rd.classList.remove('hidden'); return; }
        if (!data.devices || data.devices.length === 0) { rd.innerHTML = '<p class="text-sm text-slate-500">No active devices found.</p>'; rd.classList.remove('hidden'); return; }
        var h = '<div class="space-y-3">';
        h += '<p class="text-xs text-slate-500">' + data.devices.length + ' device(s) found</p>';
        for (var i = 0; i < data.devices.length; i++) {
          var d = data.devices[i];
          h += '<div class="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">' +
            '<div class="flex items-start justify-between gap-3">' +
            '<div class="min-w-0">' +
            '<p class="text-sm font-semibold text-slate-800 truncate">' + _e(d.nickname) + '</p>' +
            '<p class="text-xs text-slate-500 mt-0.5">' + _e(d.manufacturer) + ' · ' + _e(d.model) + '</p>' +
            '</div>' +
            '</div>' +
            '<div class="mt-2.5 flex items-center gap-2">' +
            '<label class="text-xs text-slate-400 shrink-0">iden</label>' +
            '<code class="flex-1 min-w-0 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-xs font-mono text-violet-700 select-all truncate block">' + _e(d.iden) + '</code>' +
            '<button type="button" onclick="cpIden(this,\\'' + _e(d.iden) + '\\')" class="shrink-0 rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-100 transition-colors">Copy</button>' +
            '</div></div>';
        }
        h += '</div>';
        rd.innerHTML = h; rd.classList.remove('hidden');
      } catch (err) { rd.innerHTML = '<p class="text-sm text-rose-600">Network error</p>'; rd.classList.remove('hidden'); }
      finally { btn.disabled = false; btn.textContent = 'Check'; }
    }
    function cpIden(btn, val) { navigator.clipboard.writeText(val).then(function() { var orig = btn.textContent; btn.textContent = 'Copied!'; btn.classList.add('bg-emerald-50','text-emerald-600','border-emerald-200'); setTimeout(function() { btn.textContent = orig; btn.classList.remove('bg-emerald-50','text-emerald-600','border-emerald-200'); }, 1500); }); }
    function _e(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  </script>` : ''

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
  <div id="editToast" class="fixed top-6 right-6 z-[60] hidden transition-all duration-300 translate-y-[-8px] opacity-0">
    <div class="flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-lg text-sm font-medium" id="editToastInner"></div>
  </div>
  <script>
    const NON_EDITABLE = ${JSON.stringify(NON_EDITABLE_FIELDS)};
    var _editDirty = false;
    function openEditModal(table, rowId, rowJson) {
      const data = JSON.parse(rowJson);
      const modal = document.getElementById('editModal');
      const body = document.getElementById('editModalBody');
      const title = document.getElementById('editModalTitle');
      _editDirty = false;
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
          var fieldId = 'ef_' + key;
          html += '<div class="space-y-1" id="wrap_' + escH(key) + '">' +
            '<label class="block text-xs font-medium text-slate-500 uppercase tracking-wide">' + escH(key) + '</label>' +
            '<div class="flex gap-2">' +
            '<input type="text" id="' + fieldId + '" value="' + escH(displayVal) + '" class="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none transition-colors" />' +
            '<button type="button" onclick="saveField(\\'' + escH(table) + '\\',\\'' + escH(rowId) + '\\',\\'' + escH(key) + '\\',\\'' + fieldId + '\\',this)" class="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 transition-colors whitespace-nowrap">Save</button>' +
            '</div></div>';
        }
      }
      body.innerHTML = html;
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    async function saveField(table, id, field, inputId, btn) {
      var input = document.getElementById(inputId);
      var value = input.value;
      btn.disabled = true; btn.textContent = 'Saving...';
      try {
        var res = await fetch('/db-viewer/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'table=' + encodeURIComponent(table) + '&id=' + encodeURIComponent(id) + '&field=' + encodeURIComponent(field) + '&value=' + encodeURIComponent(value) + '&ajax=1',
          redirect: 'manual',
        });
        if (res.ok || res.type === 'opaqueredirect' || res.status === 302 || res.status === 200) {
          _editDirty = true;
          showToast('Successfully updated ' + field, 'success');
          btn.textContent = 'Saved!'; btn.classList.remove('bg-violet-600','hover:bg-violet-700'); btn.classList.add('bg-emerald-600');
          setTimeout(function() { btn.textContent = 'Save'; btn.classList.remove('bg-emerald-600'); btn.classList.add('bg-violet-600','hover:bg-violet-700'); btn.disabled = false; }, 1500);
        } else {
          showToast('Update failed', 'error'); btn.textContent = 'Save'; btn.disabled = false;
        }
      } catch (e) { showToast('Network error', 'error'); btn.textContent = 'Save'; btn.disabled = false; }
    }
    function closeEditModal() {
      document.getElementById('editModal').classList.add('hidden');
      document.body.style.overflow = '';
      if (_editDirty) { _editDirty = false; location.reload(); }
    }
    function showToast(msg, type) {
      var toast = document.getElementById('editToast');
      var inner = document.getElementById('editToastInner');
      var isOk = type === 'success';
      inner.className = 'flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-lg text-sm font-medium ' +
        (isOk ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700');
      var icon = isOk
        ? '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
        : '<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>';
      inner.innerHTML = icon + '<span>' + escH(msg) + '</span>';
      toast.classList.remove('hidden');
      requestAnimationFrame(function() { requestAnimationFrame(function() { toast.classList.remove('translate-y-[-8px]','opacity-0'); toast.classList.add('translate-y-0','opacity-100'); }); });
      clearTimeout(window._toastTimer);
      window._toastTimer = setTimeout(function() {
        toast.classList.remove('translate-y-0','opacity-100'); toast.classList.add('translate-y-[-8px]','opacity-0');
        setTimeout(function() { toast.classList.add('hidden'); }, 300);
      }, 3000);
    }
    function escH(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && !document.getElementById('editModal').classList.contains('hidden')) closeEditModal(); });
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
    <aside class="lg:w-52 flex-shrink-0 space-y-4">
      <nav class="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm space-y-0.5">
        ${tableLinks}
      </nav>
      ${isSuperAdmin ? `
      <button type="button" onclick="document.getElementById('pbModal').classList.remove('hidden');document.body.style.overflow='hidden';" class="w-full rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm hover:shadow-md transition-shadow text-left group">
        <div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3"/></svg>
          </span>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-800">Pushbullet</p>
            <p class="text-[11px] text-slate-400 leading-tight">Device Lookup</p>
          </div>
        </div>
      </button>` : ''}
    </aside>
    <div class="flex-1 min-w-0">
      ${dataSection || emptyState}
    </div>
  </div>
  ${pbModal}
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
