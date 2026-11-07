import { ArrowRightLeft, CalendarClock, CheckCircle2, Circle, Download, FolderInput, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { clearActivity } from '../lib/actions';
import { formatRelativeTime, toISODate, formatDate } from '../lib/dates';
import type { Activity, DB } from '../lib/types';
import { Button, EmptyState, Modal, Segmented, useConfirm } from './ui';
import { useUI } from './ui-context';

import { t as tr } from '../lib/i18n';
export function activityIcon(t: Activity['type']) {
  if (t.endsWith('created')) return <Plus size={12} className="text-accent" />;
  if (t === 'asset.renewed') return <RefreshCw size={12} className="text-ok" />;
  if (t === 'task.completed') return <CheckCircle2 size={12} className="text-ok" />;
  if (t === 'task.reopened') return <Circle size={12} className="text-ink2" />;
  if (t.endsWith('deleted')) return <Trash2 size={12} className="text-crit" />;
  if (t === 'asset.expiration') return <CalendarClock size={12} className="text-warn-ink" />;
  if (t === 'asset.provider' || t === 'asset.category') return <ArrowRightLeft size={12} className="text-[#AF52DE]" />;
  if (t === 'data.imported') return <FolderInput size={12} className="text-accent" />;
  return <Pencil size={12} className="text-ink2" />;
}

export function ActivityRow({ a, onOpen }: { a: Activity; onOpen?: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 hov">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/[0.05]">{activityIcon(a.type)}</span>
      <div className="min-w-0 flex-1 text-sm">
        <button className="font-medium hover:underline disabled:no-underline" onClick={onOpen} disabled={!onOpen}>
          {a.itemName}
        </button>
        <span className="text-ink2"> · {a.summary}</span>
      </div>
      <span className="shrink-0 text-2xs text-ink2 tabular">{formatRelativeTime(a.at)}</span>
    </div>
  );
}

export function ActivityModal({ db, onClose }: { db: DB; onClose: () => void }) {
  const [filter, setFilter] = useState<'all' | 'asset' | 'task' | 'provider'>('all');
  const ui = useUI();
  const confirm = useConfirm();
  const list = useMemo(() => db.activity.filter((a) => filter === 'all' || a.itemType === filter), [db.activity, filter]);
  const groups = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of list.slice(0, 500)) {
      const d = toISODate(new Date(a.at));
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(a);
    }
    return Array.from(m.entries());
  }, [list]);
  const opener = (a: Activity) => {
    if (a.itemType === 'asset' && a.itemId && db.assets.some((x) => x.id === a.itemId)) return () => (onClose(), ui.openAsset(a.itemId!));
    if (a.itemType === 'task' && a.itemId && db.tasks.some((x) => x.id === a.itemId)) return () => (onClose(), ui.openTask(a.itemId!));
    if (a.itemType === 'provider' && a.itemId && db.providers.some((x) => x.id === a.itemId)) return () => (onClose(), ui.openProvider(a.itemId!));
    return undefined;
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      title={tr("Activity history")}
      footer={
        <>
          <span className="me-auto text-xs text-ink2">{db.activity.length} {tr("events · passwords are never recorded")}</span>
          <Button
            variant="ghost"
            onClick={async () => {
              if (await confirm({ title: tr("Clear activity history?"), body: tr("Assets, tasks and renewal history are not affected."), danger: true, confirmLabel: tr("Clear") })) clearActivity();
            }}
            disabled={!db.activity.length}
          >
            {tr("Clear history")}
          </Button>
          <Button onClick={onClose}>{tr("Done")}</Button>
        </>
      }
    >
      <div className="mb-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: tr("All") },
            { value: 'asset', label: tr("Assets") },
            { value: 'task', label: tr("Tasks") },
            { value: 'provider', label: tr("Providers") },
          ]}
        />
      </div>
      {groups.length === 0 ? (
        <EmptyState compact icon={<Download size={18} />} title={tr("No activity yet")} body={tr("Changes you make will be tracked here.")} />
      ) : (
        groups.map(([d, items]) => (
          <div key={d} className="mb-3">
            <div className="sticky top-0 bg-surface py-1 text-xs font-semibold text-ink2">{formatDate(d, db.settings.dateFormat)}</div>
            {items.map((a) => (
              <ActivityRow key={a.id} a={a} onOpen={opener(a)} />
            ))}
          </div>
        ))
      )}
    </Modal>
  );
}
