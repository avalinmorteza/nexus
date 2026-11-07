import { Bell, CalendarDays, CheckCircle2, ChevronRight, Inbox, Layers, Link2, ListTodo, MoreHorizontal, Pencil, Pin, PinOff, Plus, Repeat, Star, Sun, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { go } from '../../components/hooks';
import { PRIORITY_META, PriorityMark } from '../../components/TaskForm';
import { Badge, Button, Checkbox, Dropdown, EmptyState, IconButton, Select, useConfirm, useContextMenu, useToast, type MenuItem } from '../../components/ui';
import { useUI } from '../../components/ui-context';
import { createTask, deleteTasks, togglePin, toggleTask, updateTask } from '../../lib/actions';
import { addDays, calParts, daysUntil, formatDate, fromISO, monthName, toISODate, weekdayName } from '../../lib/dates';
import { t as tr } from '../../lib/i18n';
import { PageHeader } from '../../components/Page';
import { filterTasks, sortTasks, type TaskSection } from '../../lib/logic';
import type { DB, Priority, Task } from '../../lib/types';
import { clsx } from '../../lib/util';

const SECTIONS: { id: TaskSection; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'today', label: 'Today', icon: <Sun size={13} />, color: '#007AFF' },
  { id: 'upcoming', label: 'Upcoming', icon: <CalendarDays size={13} />, color: '#FF3B30' },
  { id: 'inbox', label: 'Inbox', icon: <Inbox size={13} />, color: '#8E8E93' },
  { id: 'linked', label: 'Asset-linked', icon: <Link2 size={13} />, color: '#AF52DE' },
  { id: 'all', label: 'All Tasks', icon: <Layers size={13} />, color: '#1D1D1F' },
  { id: 'completed', label: 'Completed', icon: <CheckCircle2 size={13} />, color: '#34C759' },
];

export function TasksPage({ db, today, params }: { db: DB; today: string; params: URLSearchParams }) {
  const section = (params.get('section') as TaskSection) || 'today';
  const [quick, setQuick] = useState('');
  const [prio, setPrio] = useState<'' | Priority>('');
  const [tag, setTag] = useState('');
  const ui = useUI();
  const toast = useToast();
  const meta = SECTIONS.find((s) => s.id === section) || SECTIONS[0];
  const allTags = useMemo(() => Array.from(new Set(db.tasks.flatMap((t) => t.tags))).sort(), [db.tasks]);

  const list = useMemo(() => {
    let l = filterTasks(db.tasks, section, today);
    if (prio) l = l.filter((t) => t.priority === prio);
    if (tag) l = l.filter((t) => t.tags.includes(tag));
    return sortTasks(l);
  }, [db.tasks, section, today, prio, tag]);

  const groups = useMemo(() => {
    if (section === 'completed') {
      const m = new Map<string, Task[]>();
      for (const t of list.slice(0, 300)) {
        const d = t.completedAt ? formatDate(toISODate(new Date(t.completedAt))) : tr('Earlier');
        if (!m.has(d)) m.set(d, []);
        m.get(d)!.push(t);
      }
      return Array.from(m.entries());
    }
    if (section === 'inbox') return [['', list] as [string, Task[]]];
    const g: [string, Task[]][] = [];
    const push = (k: string, t: Task) => {
      const last = g[g.length - 1];
      if (last && last[0] === k) last[1].push(t);
      else g.push([k, [t]]);
    };
    for (const t of list) {
      if (!t.dueDate) push('No date', t);
      else {
        const d = daysUntil(t.dueDate, today);
        if (d < 0) push('Overdue', t);
        else if (d === 0) push('Today', t);
        else if (d === 1) push('Tomorrow', t);
        else if (d <= 7) push(weekdayName(fromISO(t.dueDate).getDay()) + ' · ' + formatDate(t.dueDate, db.settings.dateFormat), t);
        else push(`${monthName(calParts(t.dueDate).m)} ${calParts(t.dueDate).y}`, t);
      }
    }
    return g;
  }, [list, section, today, db.settings.dateFormat]);

  const addQuick = async () => {
    const title = quick.trim();
    if (!title) return;
    await createTask({
      title,
      description: '',
      dueDate: section === 'today' ? today : section === 'upcoming' ? addDays(today, 1) : undefined,
      priority: 'medium',
      tags: [],
      recurrence: 'none',
      subtasks: [],
    });
    setQuick('');
    toast(tr("Task added"), 'success');
  };

  return (
    <div className="page">
      <PageHeader icon="tasks" tone="violet" title={tr('Tasks')} subtitle={tr('{n} open tasks', { n: filterTasks(db.tasks, 'all', today).length })} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => ui.editTask(undefined, section === 'today' ? { dueDate: today } : undefined)}>{tr('New task')}</Button>} />
      <div className="grid-12 items-start">
      <aside className="card col-span-12 space-y-4 p-4 lg:sticky lg:top-[88px] lg:col-span-3">
        <div className="grid grid-cols-2 gap-2">
          {SECTIONS.slice(0, 4).map((s) => (
            <SmartList key={s.id} s={s} active={section === s.id} count={filterTasks(db.tasks, s.id, today).length} />
          ))}
        </div>
        <div className="space-y-px">
          {SECTIONS.slice(4).map((s) => (
            <a key={s.id} href={`#/tasks?section=${s.id}`} className={clsx('flex h-7 items-center gap-2 rounded-[6px] px-2 text-sm', section === s.id ? 'bg-ink/[0.07] font-medium dark:bg-white/[0.08]' : 'hov')}>
              <span style={{ color: s.color }} className="dark:!text-ink2">
                {s.icon}
              </span>
              <span className="flex-1">{tr(s.label)}</span>
              <span className="text-xs text-ink2 tabular">{filterTasks(db.tasks, s.id, today).length}</span>
            </a>
          ))}
        </div>
        <div className="space-y-2 border-t pt-3">
          <div className="section-title">{tr("Filter")}</div>
          <Select value={prio} onChange={(e) => setPrio(e.target.value as any)}>
            <option value="">{tr("Any priority")}</option>
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {tr(PRIORITY_META[p].label)}
              </option>
            ))}
          </Select>
          <Select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">{tr("Any tag")}</option>
            {allTags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
      </aside>

      <div className="card col-span-12 min-w-0 lg:col-span-9">
        <div className="px-7 py-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[22px] font-bold tracking-tight" style={{ color: meta.color === '#1D1D1F' ? undefined : meta.color }}>
              {tr(meta.label)}
            </h2>
            <span className="text-[22px] font-semibold text-ink3 tabular">{list.length}</span>
            <div className="ms-auto">
              <IconButton label={tr("New task (T)")} onClick={() => ui.editTask(undefined, section === 'today' ? { dueDate: today } : undefined)}>
                <Plus size={16} />
              </IconButton>
            </div>
          </div>
          {section !== 'completed' && (
            <div className="mb-2 flex items-center gap-2.5 border-b border-line/[0.06] px-1 pb-2">
              <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full border-[1.5px] border-dashed border-ink3">
                <Plus size={10} className="text-ink3" />
              </span>
              <input
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && addQuick()}
                placeholder={section === 'today' ? tr("New task for today — press Enter") : tr("New task — press Enter")}
                className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-ink3"
              />
            </div>
          )}
          {list.length === 0 ? (
            <EmptyState icon={section === 'completed' ? <CheckCircle2 size={22} /> : <ListTodo size={22} />} title={section === 'completed' ? tr("No completed tasks") : tr("No tasks here")} body={section === 'today' ? tr("Nothing due today. Enjoy it.") : tr("Add a task above or link one to an asset.")} />
          ) : (
            groups.map(([g, items]) => (
              <div key={g || 'all'} className="mb-4">
                {g && <div className={clsx('mb-0.5 px-1 text-xs font-semibold', g === 'Overdue' ? 'text-crit' : 'text-ink2')}>{tr(g)}</div>}
                {items.map((t) => (
                  <TaskRow key={t.id} t={t} db={db} today={today} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function SmartList({ s, active, count }: { s: (typeof SECTIONS)[number]; active: boolean; count: number }) {
  return (
    <a href={`#/tasks?section=${s.id}`} className={clsx('rounded-[10px] p-2 transition-colors', active ? 'text-white' : 'bg-bg hov')} style={active ? { background: s.color } : undefined}>
      <div className="flex items-start justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: active ? 'rgba(255,255,255,.25)' : s.color, color: 'white' }}>
          {s.icon}
        </span>
        <span className="text-[18px] font-bold leading-6 tabular">{count}</span>
      </div>
      <div className={clsx('mt-1 text-xs font-semibold', active ? 'text-white' : 'text-ink2')}>{tr(s.label)}</div>
    </a>
  );
}

export function TaskRow({ t, db, today, compact }: { t: Task; db: DB; today: string; compact?: boolean }) {
  const ui = useUI();
  const ctx = useContextMenu();
  const confirm = useConfirm();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const asset = t.assetId ? db.assets.find((a) => a.id === t.assetId) : undefined;
  const overdue = !t.done && t.dueDate && daysUntil(t.dueDate, today) < 0;
  const menu: MenuItem[] = [
    { label: tr("Edit"), icon: <Pencil size={13} />, onClick: () => ui.openTask(t.id) },
    { label: t.done ? tr("Mark incomplete") : tr("Complete"), icon: <CheckCircle2 size={13} />, onClick: () => toggleTask(t.id) },
    { label: t.pinned ? tr("Unpin") : tr("Pin to Quick Access"), icon: t.pinned ? <PinOff size={13} /> : <Pin size={13} />, onClick: () => togglePin('task', t.id) },
    { separator: true, label: '' },
    { label: tr("Due today"), icon: <Sun size={13} />, onClick: () => updateTask(t.id, { dueDate: today }) },
    { label: tr("Due tomorrow"), icon: <CalendarDays size={13} />, onClick: () => updateTask(t.id, { dueDate: addDays(today, 1) }) },
    ...(['urgent', 'high', 'medium', 'low'] as Priority[]).map<MenuItem>((p) => ({ label: tr('Priority: {p}', { p: tr(PRIORITY_META[p].label) }), icon: <Star size={13} style={{ color: PRIORITY_META[p].color }} />, onClick: () => updateTask(t.id, { priority: p }), disabled: t.priority === p })),
    ...(asset ? [{ separator: true, label: '' }, { label: tr('Open {name}', { name: asset.name }), icon: <Link2 size={13} />, onClick: () => ui.openAsset(asset.id) }] : []),
    { separator: true, label: '' },
    {
      label: tr("Delete"),
      icon: <Trash2 size={13} />,
      danger: true,
      onClick: async () => {
        if (await confirm({ title: tr("Delete task?"), body: t.title, danger: true, confirmLabel: tr("Delete") })) {
          await deleteTasks([t.id]);
          toast(tr("Task deleted"));
        }
      },
    },
  ];
  const doneSubs = t.subtasks.filter((s) => s.done).length;
  return (
    <div onContextMenu={(e) => ctx(e, menu)}>
      <div className={clsx('group flex items-start gap-2.5 rounded-[8px] px-1', compact ? 'py-1' : 'py-[7px]', 'hov')}>
        <div className="pt-[1px]">
          <Checkbox round checked={t.done} onChange={() => toggleTask(t.id)} color={t.priority === 'urgent' ? '#FF3B30' : t.priority === 'high' ? '#FF9500' : undefined} />
        </div>
        <div className="min-w-0 flex-1 cursor-default" onClick={() => ui.openTask(t.id)}>
          <div className="flex items-center gap-1.5">
            <PriorityMark p={t.priority} />
            <span className={clsx('truncate text-sm', t.done && 'text-ink2 line-through decoration-ink3')}>{t.title}</span>
            {t.pinned && <Pin size={10} className="shrink-0 text-accent" />}
          </div>
          {(t.description || t.dueDate || asset || t.tags.length > 0 || t.recurrence !== 'none' || t.reminderAt) && !compact && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink2">
              {t.dueDate && <span className={clsx('tabular', overdue && 'font-medium text-crit')}>{formatDate(t.dueDate, db.settings.dateFormat)}</span>}
              {t.recurrence !== 'none' && (
                <span className="inline-flex items-center gap-0.5">
                  <Repeat size={10} /> {tr(t.recurrence)}
                </span>
              )}
              {t.reminderAt && !t.done && (
                <span className="inline-flex items-center gap-0.5">
                  <Bell size={10} /> {t.reminderAt.replace('T', ' ')}
                </span>
              )}
              {asset && (
                <button
                  className="inline-flex items-center gap-0.5 text-[#AF52DE] hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    ui.openAsset(asset.id);
                  }}
                >
                  <Link2 size={10} /> {asset.name}
                </button>
              )}
              {t.tags.map((x) => (
                <span key={x}>#{x}</span>
              ))}
              {t.description && <span className="max-w-[300px] truncate">{t.description}</span>}
            </div>
          )}
        </div>
        {t.subtasks.length > 0 && (
          <button className="flex items-center gap-0.5 pt-0.5 text-xs text-ink2 hover:text-ink tabular" onClick={() => setOpen(!open)}>
            {doneSubs}/{t.subtasks.length}
            <ChevronRight size={12} className={clsx('transition-transform', open && 'rotate-90')} />
          </button>
        )}
        <span className="opacity-0 group-hover:opacity-100">
          <Dropdown trigger={(o) => <IconButton label={tr("Task actions")} className="h-6 w-6" onClick={o}><MoreHorizontal size={13} /></IconButton>} items={menu} />
        </span>
      </div>
      {open && (
        <div className="mb-1 ms-8 space-y-0.5">
          {t.subtasks.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-0.5">
              <Checkbox round checked={s.done} onChange={(v) => updateTask(t.id, { subtasks: t.subtasks.map((x) => (x.id === s.id ? { ...x, done: v } : x)) })} />
              <span className={clsx('text-sm', s.done && 'text-ink2 line-through')}>{s.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

