import { ArrowDown, ArrowUp, CheckSquare, Copy, Globe, GripVertical, LayoutDashboard, Link, Pin, PinOff, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { assetDomain, assetWebsite, useAssetActions } from '../../components/assetActions';
import { CategoryIcon } from '../../components/icons';
import { Checkbox, Countdown, EmptyState, IconButton, useContextMenu } from '../../components/ui';
import { useUI } from '../../components/ui-context';
import { setPinOrder, togglePin, toggleTask } from '../../lib/actions';
import { formatDate } from '../../lib/dates';
import type { DB } from '../../lib/types';
import { clsx, isSafeHttpUrl, moveItem, normalizeUrl } from '../../lib/util';

import { pinnedKeys } from '../../lib/logic';

import { t as tr } from '../../lib/i18n';
export function QuickAccessPage({ db, today }: { db: DB; today: string }) {
  const ui = useUI();
  const ctx = useContextMenu();
  const { items, copy, open, providerDashboard } = useAssetActions(db);
  const keys = useMemo(() => pinnedKeys(db), [db]);
  const [drag, setDrag] = useState<number | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const shown = order || keys;
  const cats = new Map(db.categories.map((c) => [c.id, c]));
  const suggestions = db.assets
    .filter((a) => !a.pinned)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);

  const commit = (next: string[]) => {
    setOrder(null);
    setPinOrder(next);
  };

  return (
    <div className="page !max-w-[1100px]">
      <div className="mb-3 flex items-end">
        <div className="flex-1">
          <h2 className="text-[20px] font-semibold tracking-tight">{tr("Quick Access")}</h2>
          <p className="text-sm text-ink2">{tr("Pinned assets and tasks. Drag to reorder.")}</p>
        </div>
      </div>
      <div className="card overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState icon={<Zap size={22} />} title={tr("Nothing pinned yet")} body={tr("Pin assets or tasks from their menu to keep them one click away.")} />
        ) : (
          shown.map((k, i) => {
            const [kind, id] = k.split(':');
            const rowProps = {
              draggable: true,
              onDragStart: () => (setDrag(i), setOrder(keys)),
              onDragOver: (e: React.DragEvent) => {
                e.preventDefault();
                if (drag === null || drag === i) return;
                setOrder(moveItem(shown, drag, i));
                setDrag(i);
              },
              onDragEnd: () => {
                setDrag(null);
                if (order) commit(order);
              },
            };
            const arrows = (
              <span className="flex opacity-0 group-hover:opacity-100">
                <IconButton label={tr("Move up")} className="h-6 w-6" disabled={i === 0} onClick={() => commit(moveItem(shown, i, i - 1))}>
                  <ArrowUp size={12} />
                </IconButton>
                <IconButton label={tr("Move down")} className="h-6 w-6" disabled={i === shown.length - 1} onClick={() => commit(moveItem(shown, i, i + 1))}>
                  <ArrowDown size={12} />
                </IconButton>
              </span>
            );
            if (kind === 'asset') {
              const a = db.assets.find((x) => x.id === id);
              if (!a) return null;
              const prov = db.providers.find((p) => p.id === a.providerId);
              return (
                <div key={k} {...rowProps} onContextMenu={(e) => ctx(e, items(a))} className={clsx('group flex h-11 items-center gap-2.5 border-b border-line/[0.05] px-3 last:border-0 hov', drag === i && 'opacity-40')}>
                  <GripVertical size={13} className="cursor-grab text-ink3" />
                  <CategoryIcon category={cats.get(a.categoryId)} size={12} />
                  <button className="min-w-0 flex-1 text-start" onClick={() => ui.openAsset(a.id)}>
                    <div className="truncate text-sm font-medium">{a.name}</div>
                    <div className="truncate text-2xs text-ink2">{[cats.get(a.categoryId)?.name, prov?.name].filter(Boolean).join(' · ')}</div>
                  </button>
                  {arrows}
                  <IconButton label={tr("Open website")} onClick={() => open(a)} disabled={!isSafeHttpUrl(assetWebsite(a))}>
                    <Globe size={14} />
                  </IconButton>
                  <IconButton label={tr("Copy URL")} onClick={() => copy(assetWebsite(a) ? normalizeUrl(assetWebsite(a)) : '', 'URL')}>
                    <Link size={14} />
                  </IconButton>
                  <IconButton label={tr("Copy domain")} onClick={() => copy(assetDomain(a), 'domain')}>
                    <Copy size={14} />
                  </IconButton>
                  <IconButton label={tr("Provider dashboard")} onClick={() => providerDashboard(a)} disabled={!prov}>
                    <LayoutDashboard size={14} />
                  </IconButton>
                  <div className="w-[120px] text-end">
                    <Countdown date={a.expirationDate} today={today} />
                  </div>
                  <IconButton label={tr("Unpin")} onClick={() => togglePin('asset', a.id)}>
                    <PinOff size={14} />
                  </IconButton>
                </div>
              );
            }
            const t = db.tasks.find((x) => x.id === id);
            if (!t) return null;
            return (
              <div key={k} {...rowProps} className={clsx('group flex h-11 items-center gap-2.5 border-b border-line/[0.05] px-3 last:border-0 hov', drag === i && 'opacity-40')}>
                <GripVertical size={13} className="cursor-grab text-ink3" />
                <span className="flex w-[22px] justify-center">
                  <Checkbox round checked={t.done} onChange={() => toggleTask(t.id)} />
                </span>
                <button className="min-w-0 flex-1 text-start" onClick={() => ui.openTask(t.id)}>
                  <div className={clsx('truncate text-sm font-medium', t.done && 'text-ink2 line-through')}>{t.title}</div>
                  <div className="truncate text-2xs text-ink2">{tr("Task")}{t.dueDate ? ` · ${tr('due {date}', { date: formatDate(t.dueDate, db.settings.dateFormat) })}` : ''}</div>
                </button>
                {arrows}
                <CheckSquare size={14} className="text-ink3" />
                <IconButton label={tr("Unpin")} onClick={() => togglePin('task', t.id)}>
                  <PinOff size={14} />
                </IconButton>
              </div>
            );
          })
        )}
      </div>

      {suggestions.length > 0 && (
        <>
          <div className="section-title mb-1.5 mt-6">{tr("Recently used")}</div>
          <div className="card overflow-hidden">
            {suggestions.map((a) => (
              <div key={a.id} className="group flex h-10 items-center gap-2.5 border-b border-line/[0.05] px-3 last:border-0 hov">
                <CategoryIcon category={cats.get(a.categoryId)} size={11} />
                <button className="flex-1 truncate text-start text-sm" onClick={() => ui.openAsset(a.id)}>
                  {a.name}
                </button>
                <Countdown date={a.expirationDate} today={today} short />
                <IconButton label={tr("Pin")} onClick={() => togglePin('asset', a.id)}>
                  <Pin size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
