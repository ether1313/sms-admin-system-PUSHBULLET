import { renderLayout } from './layout';
import { Task, Contact, TaskExecutionLog } from '@prisma/client';

interface TaskWithCounts extends Task {
  _count: {
    contacts: number;
    logs: number;
  };
}

interface TaskWithDetails extends Task {
  contacts: (Contact & {
    logs: TaskExecutionLog[];
  })[];
  logs: (TaskExecutionLog & {
    contact: Contact;
  })[];
}

type TaskListStatus = 'all' | 'draft' | 'scheduled' | 'running' | 'completed' | 'failed';
type TaskListSort = 'name' | 'status' | 'contacts' | 'scheduledAt' | 'createdAt';
type TaskListDir = 'asc' | 'desc';

export function renderTaskList(
  tasks: TaskWithCounts[],
  opts?: { status?: string; sort?: string; dir?: string }
): string {
  const status = (opts?.status as TaskListStatus) || 'all';
  const sort = (opts?.sort as TaskListSort) || 'createdAt';
  const dir = (opts?.dir as TaskListDir) || 'desc';

  const statusOptions: Array<{ value: TaskListStatus; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'running', label: 'Running' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  function q(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }

  function tasksUrl(next: Partial<{ status: TaskListStatus; sort: TaskListSort; dir: TaskListDir }>): string {
    const merged = {
      status,
      sort,
      dir,
      ...next,
    };
    return `/tasks?${q({
      status: merged.status,
      sort: merged.sort,
      dir: merged.dir,
    })}`;
  }

  function sortLink(label: string, key: TaskListSort): string {
    const isActive = sort === key;
    const nextDir: TaskListDir = isActive && dir === 'asc' ? 'desc' : 'asc';
    const arrow = isActive ? (dir === 'asc' ? '↑' : '↓') : '';
    return `
      <a
        href="${tasksUrl({ sort: key, dir: nextDir })}"
        class="inline-flex items-center gap-2 text-slate-600 hover:text-violet-600 transition-colors"
      >
        <span>${label}</span>
        <span class="text-slate-400">${arrow}</span>
      </a>
    `;
  }

  const content = `
    <div class="mb-8 flex flex-col gap-5">
      <div>
        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Tasks</h1>
        <p class="mt-1.5 text-sm text-slate-500">Create, schedule, and track bulk message runs.</p>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form method="GET" action="/tasks" class="flex flex-wrap items-center gap-2">
          <input type="hidden" name="sort" value="${escapeHtml(sort)}" />
          <input type="hidden" name="dir" value="${escapeHtml(dir)}" />
          <label for="status" class="text-sm font-medium text-slate-700 whitespace-nowrap">Status</label>
          <select
            id="status"
            name="status"
            class="min-w-[140px] rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            onchange="this.form.submit()"
          >
            ${statusOptions
              .map(
                (o) =>
                  `<option value="${o.value}" ${o.value === status ? 'selected' : ''}>${o.label}</option>`
              )
              .join('')}
          </select>
          <a
            href="/tasks"
            class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
          >
            Reset
          </a>
        </form>
        <a
          href="/tasks/create"
          class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-violet-600 hover:to-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 whitespace-nowrap"
        >
          Create Task
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>

    <!-- Mobile Card View -->
    <div class="md:hidden space-y-3">
      ${tasks.length === 0 ? `
      <div class="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
        <div class="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
          <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3l8 4v5c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V7l8-4z"></path>
            <path d="M9.5 12l1.8 1.8L14.8 10.3"></path>
          </svg>
          <span class="sr-only">Tasks</span>
        </div>
        <p class="text-sm font-medium text-slate-800">No tasks yet.</p>
        <p class="mt-1 text-sm text-slate-500">Create your first task to start sending.</p>
        <a href="/tasks/create" class="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-violet-600 hover:to-indigo-700">
          Create Task <span aria-hidden="true">→</span>
        </a>
      </div>
      ` : tasks.map((task) => `
      <div class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
        <div class="flex items-start justify-between mb-3">
          <a href="/tasks/${task.id}" class="flex-1 font-semibold text-slate-900 hover:text-violet-600 text-base transition-colors">
            ${escapeHtml(task.name)}
          </a>
          <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ml-2 ${getStatusColor(task.status)}">
            ${task.status}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-xs text-slate-500">Contacts</p>
            <p class="font-semibold text-slate-900">${task._count.contacts}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Scheduled</p>
            <p class="font-semibold text-slate-900">${task.scheduledAt ? formatDate(task.scheduledAt) : '-'}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Created</p>
            <p class="font-semibold text-slate-900">${formatDate(task.createdAt)}</p>
          </div>
          <div class="flex items-end">
            <a href="/tasks/${task.id}" class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-violet-600 hover:to-indigo-700">
              View <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
      `).join('')}
    </div>

    <!-- Desktop Table View -->
    <div class="hidden md:block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200">
        <thead class="bg-slate-50/80">
          <tr>
            <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              ${sortLink('Name', 'name')}
            </th>
            <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              ${sortLink('Status', 'status')}
            </th>
            <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              ${sortLink('Contacts', 'contacts')}
            </th>
            <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              ${sortLink('Scheduled', 'scheduledAt')}
            </th>
            <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              ${sortLink('Created', 'createdAt')}
            </th>
            <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${tasks.length === 0 ? `
          <tr>
            <td colspan="6" class="px-6 py-12 text-center">
              <div class="mx-auto max-w-md">
                <div class="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
                  <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 3l8 4v5c0 5-3.5 9.4-8 10-4.5-.6-8-5-8-10V7l8-4z"></path>
                    <path d="M9.5 12l1.8 1.8L14.8 10.3"></path>
                  </svg>
                  <span class="sr-only">Tasks</span>
                </div>
                <p class="text-sm font-medium text-slate-800">No tasks yet.</p>
                <p class="mt-1 text-sm text-slate-500">Create your first task to start sending.</p>
                <a href="/tasks/create" class="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-violet-600 hover:to-indigo-700">
                  Create Task <span aria-hidden="true">→</span>
                </a>
              </div>
            </td>
          </tr>
          ` : tasks.map((task) => `
          <tr class="transition-colors duration-150 hover:bg-slate-50/80">
            <td class="px-4 lg:px-6 py-4">
              <a href="/tasks/${task.id}" class="font-semibold text-slate-900 hover:text-violet-600 transition-colors">
                ${escapeHtml(task.name)}
              </a>
            </td>
            <td class="px-4 lg:px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusColor(task.status)}">
                ${task.status}
              </span>
            </td>
            <td class="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
              ${task._count.contacts}
            </td>
            <td class="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
              ${task.scheduledAt ? formatDate(task.scheduledAt) : '-'}
            </td>
            <td class="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
              ${formatDate(task.createdAt)}
            </td>
            <td class="px-4 lg:px-6 py-4 whitespace-nowrap text-sm">
              <a href="/tasks/${task.id}" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900">
                View <span aria-hidden="true">→</span>
              </a>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
  return renderLayout('Tasks', content);
}

export function renderTaskCreate(machines: { id: string; name: string }[] = []): string {
  const machinesSection =
    machines.length > 0
      ? `
            <div class="sm:col-span-2">
              <span class="block text-sm font-semibold text-slate-700 mb-2">
                Sender machines <span class="text-rose-600">*</span>
              </span>
              <p class="mt-1 mb-2 text-sm text-slate-600">
                Select one or more machines to share the send. Contacts are split across selected machines.
              </p>
              <div class="mt-2 flex flex-wrap gap-4">
                ${machines
                  .map(
                    (m) => `
                <label class="inline-flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 transition-colors hover:bg-slate-50">
                  <input type="checkbox" name="machineIds" value="${m.id.replace(/"/g, '&quot;')}" class="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  <span class="text-sm font-medium text-slate-800">${escapeHtml(m.name)}</span>
                </label>`
                  )
                  .join('')}
              </div>
            </div>`
      : ''

  const content = `
    <div class="mb-8">
      <a href="/tasks" class="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-violet-600 transition-colors">
        <span aria-hidden="true">←</span> Back to Tasks
      </a>
      <h1 class="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Create Task</h1>
      <p class="mt-1.5 text-sm text-slate-500">Send to many contacts with a scheduled start time.</p>
    </div>
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
        <form method="POST" action="/tasks" class="space-y-6">
          <div class="grid gap-6 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label for="name" class="block text-sm font-medium text-slate-700">
                Task Name <span class="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                placeholder="e.g., Welcome Bonus..."
              />
            </div>

            <div class="sm:col-span-2">
              <label for="message" class="block text-sm font-medium text-slate-700">
                Message Template <span class="text-rose-500">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows="5"
                class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                placeholder="Hello {name}, this is your message..."
              ></textarea>
              <p class="mt-2 text-sm text-slate-500">
                Tip: use <span class="font-mono text-slate-800">{name}</span> to insert the contact name.
              </p>
            </div>

            <div class="sm:col-span-2">
              <label for="scheduledAt" class="block text-sm font-medium text-slate-700 mb-2">
                Scheduled At <span class="text-slate-400">(optional)</span>
              </label>
              <input
                type="datetime-local"
                id="scheduledAt"
                name="scheduledAt"
                class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 sm:px-3.5 sm:py-2.5 text-base sm:text-sm text-slate-900 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 min-h-[48px] sm:min-h-0"
                style="font-size: 16px; -webkit-appearance: none; appearance: none; touch-action: manipulation;"
              />
              <p class="mt-2 text-sm text-slate-500">
                Leave empty to schedule now (executes automatically).
              </p>
            </div>
            ${machinesSection}
            <div class="sm:col-span-2">
              <label for="contacts" class="block text-sm font-medium text-slate-700">
                Contacts <span class="text-rose-500">*</span>
              </label>
              <textarea
                id="contacts"
                name="contacts"
                required
                rows="10"
                class="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                placeholder="+61412345678&#10;+61412345679 John Doe&#10"
              ></textarea>
              <p class="mt-2 text-sm text-slate-500">
                One per line. Format: <span class="font-mono text-slate-800">phone</span> or <span class="font-mono text-slate-800">phone name</span>. Numbers normalize to <span class="font-mono text-slate-800">+61</span>.
              </p>
            </div>
          </div>

          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-2">
            <a
              href="/tasks"
              class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </a>
            <button
              type="submit"
              class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-violet-600 hover:to-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Create Task <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </div>

      <div class="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
        <h2 class="text-sm font-semibold text-slate-900">Quick Guide</h2>
        <ul class="mt-3 space-y-3 text-sm text-slate-600">
          <li><span class="font-medium text-slate-800">Machines:</span> select one or more; contacts are split across them.</li>
          <li><span class="font-medium text-slate-800">Contacts:</span> paste multiple lines, one contact per line.</li>
          <li><span class="font-medium text-slate-800">Names:</span> optional, used by <span class="font-mono text-slate-800">{name}</span>.</li>
          <li><span class="font-medium text-slate-800">Schedule:</span> blank = run now; set a time to run later.</li>
        </ul>
      </div>
    </div>
  `;
  return renderLayout('Create Task', content);
}

export function renderTaskDetail(task: TaskWithDetails): string {
  const statusColors = {
    draft: 'bg-slate-100 text-slate-800 ring-slate-200',
    scheduled: 'bg-amber-100 text-amber-800 ring-amber-200',
    running: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
    completed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    failed: 'bg-rose-100 text-rose-800 ring-rose-200',
  };

  const canTrigger = task.status === 'draft' || task.status === 'scheduled';

  // Calculate execution stats
  const totalLogs = task.logs.length;
  const successLogs = task.logs.filter((log) => log.status === 'success').length;
  const failedLogs = task.logs.filter((log) => log.status === 'failed').length;
  const pendingLogs = task.logs.filter((log) => log.status === 'pending').length;

  const content = `
    <div class="mb-8">
      <a href="/tasks" class="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-violet-600 transition-colors">
        <span aria-hidden="true">←</span> Back to Tasks
      </a>
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm mb-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex-1 min-w-0">
          <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 break-words">${escapeHtml(task.name)}</h1>
          <span class="inline-flex items-center mt-3 px-3 py-1 text-sm font-semibold rounded-full ring-1 ring-inset ${statusColors[task.status as keyof typeof statusColors] || statusColors.draft}">
            ${task.status}
          </span>
        </div>
        ${canTrigger ? `
        <form method="POST" action="/tasks/${task.id}/trigger" class="inline sm:ml-4">
          <button
            type="submit"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Trigger Execution
          </button>
        </form>
        ` : ''}
      </div>

      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">${formatDate(task.createdAt)}</p>
        </div>
        ${task.scheduledAt ? `
        <div class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scheduled</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">${formatDate(task.scheduledAt)}</p>
        </div>
        ` : ''}
        ${task.startedAt ? `
        <div class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Started</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">${formatDate(task.startedAt)}</p>
        </div>
        ` : ''}
        ${task.completedAt ? `
        <div class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Completed</p>
          <p class="mt-1 text-sm font-semibold text-slate-900">${formatDate(task.completedAt)}</p>
        </div>
        ` : ''}
      </div>

      <div class="mt-6">
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Message Template</p>
        <div class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
          <pre class="whitespace-pre-wrap text-sm text-slate-900">${escapeHtml(task.message)}</pre>
        </div>
      </div>

      ${totalLogs > 0 ? `
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-violet-200/80 bg-violet-50/50 p-3.5">
          <p class="text-xs font-semibold text-violet-700 uppercase tracking-wide">Total</p>
          <p class="mt-1 text-2xl font-bold text-violet-700">${totalLogs}</p>
        </div>
        <div class="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5">
          <p class="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Success</p>
          <p class="mt-1 text-2xl font-bold text-emerald-700">${successLogs}</p>
        </div>
        <div class="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3.5">
          <p class="text-xs font-semibold text-rose-700 uppercase tracking-wide">Failed</p>
          <p class="mt-1 text-2xl font-bold text-rose-700">${failedLogs}</p>
        </div>
        <div class="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5">
          <p class="text-xs font-semibold text-amber-800 uppercase tracking-wide">Pending</p>
          <p class="mt-1 text-2xl font-bold text-amber-800">${pendingLogs}</p>
        </div>
      </div>
      ` : ''}
    </div>

    <div class="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
      <h2 class="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Contacts <span class="text-slate-500 font-normal">(${task.contacts.length})</span></h2>
      
      <!-- Mobile Card View -->
      <div class="mt-4 md:hidden space-y-3">
        ${task.contacts.map((contact) => {
          const latestLog = contact.logs[0];
          return `
          <div class="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-mono font-semibold text-slate-900 break-all">${escapeHtml(contact.phone)}</p>
                ${contact.name ? `<p class="text-sm text-slate-700 mt-1">${escapeHtml(contact.name)}</p>` : ''}
              </div>
              ${latestLog ? `
              <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ml-2 flex-shrink-0 ${getLogStatusColor(latestLog.status)}">
                ${latestLog.status}
              </span>
              ` : '<span class="text-slate-400 text-xs ml-2 flex-shrink-0">-</span>'}
            </div>
            ${latestLog?.sentAt ? `
            <div class="mt-2 pt-2 border-t border-slate-200">
              <p class="text-xs text-slate-500">Sent At</p>
              <p class="text-sm text-slate-700">${formatDate(latestLog.sentAt)}</p>
            </div>
            ` : ''}
            ${latestLog?.errorMessage ? `
            <div class="mt-2 pt-2 border-t border-slate-200">
              <p class="text-xs text-slate-500">Error</p>
              <p class="text-sm text-rose-700 break-words">${escapeHtml(latestLog.errorMessage)}</p>
            </div>
            ` : ''}
          </div>
          `;
        }).join('')}
      </div>

      <!-- Desktop Table View -->
      <div class="mt-4 hidden md:block overflow-x-auto rounded-xl border border-slate-200/80">
        <table class="min-w-full divide-y divide-slate-100">
          <thead class="bg-slate-50/80">
            <tr>
              <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone</th>
              <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
              <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Sent At</th>
              <th class="px-4 lg:px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Error</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            ${task.contacts.map((contact) => {
              const latestLog = contact.logs[0];
              return `
              <tr class="transition-colors duration-150 hover:bg-slate-50/80">
                <td class="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900">${escapeHtml(contact.phone)}</td>
                <td class="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-700">${contact.name ? escapeHtml(contact.name) : '<span class="text-slate-400">-</span>'}</td>
                <td class="px-4 lg:px-6 py-4 whitespace-nowrap">
                  ${latestLog ? `
                  <span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getLogStatusColor(latestLog.status)}">
                    ${latestLog.status}
                  </span>
                  ` : '<span class="text-slate-400">-</span>'}
                </td>
                <td class="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  ${latestLog?.sentAt ? formatDate(latestLog.sentAt) : '-'}
                </td>
                <td class="px-4 lg:px-6 py-4 text-sm text-rose-700 max-w-xs">
                  ${latestLog?.errorMessage ? `<span class="break-words">${escapeHtml(latestLog.errorMessage)}</span>` : '-'}
                </td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  return renderLayout('Task Detail', content);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-800 ring-slate-200',
    scheduled: 'bg-amber-100 text-amber-800 ring-amber-200',
    running: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
    completed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    failed: 'bg-rose-100 text-rose-800 ring-rose-200',
  };
  return colors[status] || colors.draft;
}

function getLogStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 ring-amber-200',
    success: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    failed: 'bg-rose-100 text-rose-800 ring-rose-200',
  };
  return colors[status] || colors.pending;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
