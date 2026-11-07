import { GripVertical, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { createTask, deleteTasks, updateTask } from '../lib/actions';
import { addDays, formatDate, formatRelativeTime, isValidISODate, todayISO } from '../lib/dates';
import type { DB, Priority, Recurrence, Subtask, Task } from '../lib/types';
import { clsx, parseTags, uid } from '../lib/util';
import { DateInput, DateTimeInput } from './DateInput';
import { Button, Checkbox, Field, Input, Modal, Select, Textarea, useConfirm, useToast } from './ui';

import { t as tr } from '../lib/i18n';
export const PRIORITY_META: Record<Priority, { label: string; color: string; flags: number }> = {
  low: { label: 'Low', color: '#8E8E93', flags: 1 },
  medium: { label: 'Medium', color: '#007AFF', flags: 2 },
  high: { label: 'High', color: '#FF9500', flags: 3 },
  urgent: { label: 'Urgent', color: '#FF3B30', flags: 4 },
};

export function PriorityMark({ p }: { p: Priority }) {
  if (p === 'low') return null;
  const m = PRIORITY_META[p];
  return (
    <span className="text-[11px] font-bold tracking-tighter" style={{ color: m.color }} title={tr('{p} priority', { p: tr(m.label) })}>
      {'!'.repeat(m.flags - 1)}
    </span>
  );
}

export function TaskForm({ db, taskId, defaults, onClose }: { db: DB; taskId?: string; defaults?: Partial<Task>; onClose: () => void }) {
  const existing = taskId ? db.tasks.find((t) => t.id === taskId) : undefined;
  const src = existing || defaults;
  const [title, setTitle] = useState(src?.title || '');
  const [description, setDescription] = useState(src?.description || '');
  const [dueDate, setDueDate] = useState(src?.dueDate || '');
  const [reminderAt, setReminderAt] = useState(src?.reminderAt || '');
  const [priority, setPriority] = useState<Priority>(src?.priority || 'medium');
  const [tags, setTags] = useState((src?.tags || []).join(', '));
  const [assetId, setAssetId] = useState(src?.assetId || '');
  const [recurrence, setRecurrence] = useState<Recurrence>(src?.recurrence || 'none');
  const [subtasks, setSubtasks] = useState<Subtask[]>(src?.subtasks || []);
  const [newSub, setNewSub] = useState('');
  const [error, setError] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const save = async () => {
    if (!title.trim()) return setError(tr("Title is required"));
    if (dueDate && !isValidISODate(dueDate)) return setError(tr("Invalid due date"));
    const extra = newSub.trim() ? [{ id: uid(), title: newSub.trim(), done: false }] : [];
    const data = {
      title: title.trim(),
      description,
      dueDate: dueDate || undefined,
      reminderAt: reminderAt || undefined,
      priority,
      tags: parseTags(tags),
      assetId: assetId || undefined,
      recurrence,
      subtasks: [...subtasks, ...extra].filter((s) => s.title.trim()),
    };
    try {
      if (existing) await updateTask(existing.id, data);
      else await createTask({ ...data, autoRenewal: defaults?.autoRenewal });
      toast(existing ? tr("Task updated") : tr("Task added"), 'success');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr("Could not save task"), 'error');
    }
  };

  const asset = db.assets.find((a) => a.id === assetId);
  const quickDates: [string, string][] = [
    ['Today', todayISO()],
    ['Tomorrow', addDays(todayISO(), 1)],
    ['Next week', addDays(todayISO(), 7)],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      title={existing ? tr("Edit Task") : tr("New Task")}
      footer={
        <>
          {existing && (
            <Button
              variant="ghost"
              className="me-auto !text-crit"
              icon={<Trash2 size={13} />}
              onClick={async () => {
                if (await confirm({ title: tr("Delete this task?"), body: existing.title, danger: true, confirmLabel: tr("Delete") })) {
                  await deleteTasks([existing.id]);
                  toast(tr("Task deleted"));
                  onClose();
                }
              }}
            >
              {tr("Delete")}
            </Button>
          )}
          {existing && <span className={clsx('text-xs text-ink2', !existing && 'me-auto')}>{tr("Updated")} {formatRelativeTime(existing.updatedAt)}</span>}
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button variant="primary" onClick={save}>
            {existing ? tr("Save") : tr("Add Task")}
          </Button>
        </>
      }
    >
      <div
        className="grid grid-cols-2 gap-3"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
        }}
      >
        <Field label={tr("Title")} className="col-span-2" hint={error && <span className="text-crit">{error}</span>}>
          <Input
            autoFocus
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && save()}
            placeholder={tr("Renew example.com")}
          />
        </Field>
        <Field label={tr("Notes")} className="col-span-2">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={tr("Add details…")} />
        </Field>
        <Field
          label={tr("Due date")}
          hint={
            <span className="flex gap-2">
              {quickDates.map(([l, d]) => (
                <button key={l} type="button" className="text-accent hover:underline" onClick={() => setDueDate(d)}>
                  {l}
                </button>
              ))}
              {dueDate && (
                <button type="button" className="text-ink2 hover:underline" onClick={() => setDueDate('')}>
                  {tr("Clear")}
                </button>
              )}
            </span>
          }
        >
          <DateInput value={dueDate} onChange={setDueDate} />
        </Field>
        <Field label={tr("Remind me at")} hint={reminderAt ? tr("Chrome notification at this time") : tr("Optional")}>
          <DateTimeInput value={reminderAt} onChange={setReminderAt} />
        </Field>
        <Field label={tr("Priority")}>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {tr(PRIORITY_META[p].label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr("Repeat")}>
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="none">{tr("Never")}</option>
            <option value="daily">{tr("Daily")}</option>
            <option value="weekly">{tr("Weekly")}</option>
            <option value="monthly">{tr("Monthly")}</option>
            <option value="yearly">{tr("Yearly")}</option>
          </Select>
        </Field>
        <Field label={tr("Linked asset")} hint={asset?.expirationDate ? `${tr('Expires')} ${formatDate(asset.expirationDate, db.settings.dateFormat)}` : undefined}>
          <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">{tr("None")}</option>
            {db.assets
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label={tr("Tags")}>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={tr("billing, urgent")} />
        </Field>
        {asset?.expirationDate && !dueDate && (
          <div className="col-span-2 -mt-1 text-xs">
            <button type="button" className="text-accent hover:underline" onClick={() => setDueDate(addDays(asset.expirationDate!, -db.settings.renewalTaskDays))}>
              {tr('Set due {n} days before {name} expires', { n: db.settings.renewalTaskDays, name: asset.name })}
            </button>
          </div>
        )}

        <div className="col-span-2">
          <div className="label mb-1.5">{tr("Subtasks")}</div>
          <div className="space-y-0.5">
            {subtasks.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDrag(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (drag === null || drag === i) return;
                  const next = subtasks.slice();
                  const [it] = next.splice(drag, 1);
                  next.splice(i, 0, it);
                  setSubtasks(next);
                  setDrag(i);
                }}
                onDragEnd={() => setDrag(null)}
                className={clsx('group flex items-center gap-2 rounded-[6px] px-1 py-0.5 hov', drag === i && 'opacity-50')}
              >
                <GripVertical size={12} className="cursor-grab text-ink3 opacity-0 group-hover:opacity-100" />
                <Checkbox round checked={s.done} onChange={(v) => setSubtasks(subtasks.map((x) => (x.id === s.id ? { ...x, done: v } : x)))} />
                <input className={clsx('flex-1 bg-transparent text-sm outline-none', s.done && 'text-ink2 line-through')} value={s.title} onChange={(e) => setSubtasks(subtasks.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} />
                <button type="button" className="text-ink3 opacity-0 hover:text-crit group-hover:opacity-100" onClick={() => setSubtasks(subtasks.filter((x) => x.id !== s.id))} aria-label={tr("Remove subtask")}>
                  <X size={12} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 px-1">
              <Plus size={12} className="ms-[18px] text-ink3" />
              <input
                className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-ink3"
                placeholder={tr("Add subtask and press Enter")}
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSub.trim()) {
                    e.preventDefault();
                    setSubtasks([...subtasks, { id: uid(), title: newSub.trim(), done: false }]);
                    setNewSub('');
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
