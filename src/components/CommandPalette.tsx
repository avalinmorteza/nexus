import { AlertTriangle, Building2, CalendarDays, CheckSquare, ChevronRight, Clock, CornerDownLeft, LayoutGrid, ListTodo, Moon, Pin, Plus, Search, Settings, Sun, Zap } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { updateSettings } from '../lib/actions';
import { daysUntil, expiryStatus } from '../lib/dates';
import { search } from '../lib/search';
import type { DB } from '../lib/types';
import { clsx } from '../lib/util';
import { go } from './hooks';
import { CategoryIcon } from './icons';
import { Countdown, Highlight, Kbd, useEscape } from './ui';
import { useUI } from './ui-context';

import { t as tr } from '../lib/i18n';
export type PaletteMode = 'all' | 'expiring' | 'critical' | 'pinned';

interface Cmd {
  id: string;
  group: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  right?: React.ReactNode;
  keywords?: string;
  run: () => void;
}

export function CommandPalette({ db, today, mode: initialMode, onClose }: { db: DB; today: string; mode: PaletteMode; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<PaletteMode>(initialMode);
  const [idx, setIdx] = useState(0);
  const ui = useUI();
  const listRef = useRef<HTMLDivElement>(null);
  const cats = useMemo(() => new Map(db.categories.map((c) => [c.id, c])), [db.categories]);

  const close = (fn: () => void) => () => {
    onClose();
    setTimeout(fn, 0);
  };

  const commands = useMemo<Cmd[]>(() => {
    const actions: Cmd[] = [
      { id: 'new-asset', group: 'Actions', title: tr("Add new asset"), icon: <Plus size={14} />, keywords: 'create add asset domain hosting', run: close(() => ui.editAsset()) },
      { id: 'new-task', group: 'Actions', title: tr("Add new task"), icon: <CheckSquare size={14} />, keywords: 'create add task todo reminder', run: close(() => ui.editTask()) },
      { id: 'new-provider', group: 'Actions', title: tr("Add new provider"), icon: <Building2 size={14} />, keywords: 'create provider company', run: close(() => ui.editProvider()) },
      { id: 'expiring', group: 'Actions', title: tr("Show expiring assets"), icon: <Clock size={14} />, keywords: 'expiring soon renew', run: () => (setMode('expiring'), setQ('')) },
      { id: 'critical', group: 'Actions', title: tr("Show critical assets"), icon: <AlertTriangle size={14} />, keywords: 'critical urgent expired red', run: () => (setMode('critical'), setQ('')) },
      { id: 'pinned', group: 'Actions', title: tr("Open pinned items"), icon: <Pin size={14} />, keywords: 'pinned favorites quick', run: () => (setMode('pinned'), setQ('')) },
      { id: 'go-overview', group: 'Navigation', title: tr("Open Overview"), icon: <LayoutGrid size={14} />, keywords: 'dashboard home', run: close(() => go('overview')) },
      { id: 'go-assets', group: 'Navigation', title: tr("Open Assets"), icon: <LayoutGrid size={14} />, keywords: 'table list', run: close(() => go('assets')) },
      { id: 'go-tasks', group: 'Navigation', title: tr("Open Tasks"), icon: <ListTodo size={14} />, run: close(() => go('tasks')) },
      { id: 'go-calendar', group: 'Navigation', title: tr("Open Calendar"), icon: <CalendarDays size={14} />, keywords: 'renewal month agenda', run: close(() => go('calendar')) },
      { id: 'go-providers', group: 'Navigation', title: tr("Open Providers"), icon: <Building2 size={14} />, run: close(() => go('providers')) },
      { id: 'go-quick', group: 'Navigation', title: tr("Open Quick Access"), icon: <Zap size={14} />, keywords: 'favorites pinned', run: close(() => go('quick')) },
      { id: 'go-settings', group: 'Navigation', title: tr("Open Settings"), icon: <Settings size={14} />, keywords: 'preferences config', run: close(() => go('settings')) },
      { id: 'activity', group: 'Navigation', title: tr("Show activity history"), icon: <Clock size={14} />, keywords: 'log timeline', run: close(() => ui.openActivity()) },
      {
        id: 'theme',
        group: 'Actions',
        title: tr("Toggle dark mode"),
        icon: document.documentElement.classList.contains('dark') ? <Sun size={14} /> : <Moon size={14} />,
        keywords: 'theme appearance light dark',
        run: close(() => updateSettings({ theme: document.documentElement.classList.contains('dark') ? 'light' : 'dark' })),
      },
    ];
    return actions;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const assetCmd = (a: DB['assets'][number], group: string): Cmd => ({
    id: 'a-' + a.id,
    group,
    title: <Highlight text={a.name} query={q} />,
    subtitle: [cats.get(a.categoryId)?.name, db.providers.find((p) => p.id === a.providerId)?.name].filter(Boolean).join(' · '),
    icon: <CategoryIcon category={cats.get(a.categoryId)} size={11} />,
    right: a.expirationDate ? <Countdown date={a.expirationDate} today={today} short /> : undefined,
    run: close(() => ui.openAsset(a.id)),
  });

  const items = useMemo<Cmd[]>(() => {
    const ql = q.trim().toLowerCase();
    if (mode !== 'all') {
      let list = db.assets.filter((a) => a.status === 'active');
      if (mode === 'expiring') list = list.filter((a) => a.expirationDate && daysUntil(a.expirationDate, today) >= 0 && daysUntil(a.expirationDate, today) <= 30);
      if (mode === 'critical') list = list.filter((a) => ['critical', 'expired'].includes(expiryStatus(a.expirationDate, today)));
      if (mode === 'pinned') {
        const pinnedTasks = db.tasks.filter((t) => t.pinned && (!ql || t.title.toLowerCase().includes(ql)));
        const pa = db.assets.filter((a) => a.pinned && (!ql || a.name.toLowerCase().includes(ql)));
        return [
          ...pa.map((a) => assetCmd(a, 'Pinned assets')),
          ...pinnedTasks.map((t) => ({ id: 't-' + t.id, group: 'Pinned tasks', title: <Highlight text={t.title} query={q} />, icon: <CheckSquare size={14} />, run: close(() => ui.openTask(t.id)) })),
        ];
      }
      if (ql) list = list.filter((a) => a.name.toLowerCase().includes(ql));
      list.sort((x, y) => (x.expirationDate || '').localeCompare(y.expirationDate || ''));
      return list.map((a) => assetCmd(a, mode === 'expiring' ? tr("Expiring in 30 days") : tr("Critical & expired")));
    }
    if (!ql) {
      const soon = db.assets
        .filter((a) => a.status === 'active' && a.expirationDate && ['critical', 'warning', 'expired'].includes(expiryStatus(a.expirationDate, today)))
        .sort((x, y) => (x.expirationDate || '').localeCompare(y.expirationDate || ''))
        .slice(0, 4);
      return [...soon.map((a) => assetCmd(a, 'Needs attention')), ...commands];
    }
    const hits = search(db, q, 30).map<Cmd>((h) => {
      if (h.kind === 'asset') return { ...assetCmd(h.asset!, 'Assets'), subtitle: h.matchField !== 'Name' && h.matchText ? <>{h.matchField}: <Highlight text={h.matchText} query={q} /></> : assetCmd(h.asset!, '').subtitle };
      if (h.kind === 'task') return { id: 't-' + h.id, group: 'Tasks', title: <Highlight text={h.title} query={q} />, subtitle: h.matchField !== 'Title' && h.matchText ? <Highlight text={h.matchText} query={q} /> : h.subtitle, icon: <CheckSquare size={14} />, run: close(() => ui.openTask(h.id)) };
      if (h.kind === 'provider') return { id: 'p-' + h.id, group: 'Providers', title: <Highlight text={h.title} query={q} />, subtitle: h.subtitle, icon: <Building2 size={14} />, run: close(() => ui.openProvider(h.id)) };
      return { id: 'c-' + h.id, group: 'Categories', title: <Highlight text={h.title} query={q} />, subtitle: h.subtitle, icon: <CategoryIcon category={cats.get(h.id)} size={11} />, run: close(() => go('assets', { category: h.id })) };
    });
    const cmds = commands.filter((c) => `${typeof c.title === 'string' ? c.title : ''} ${c.keywords || ''}`.toLowerCase().includes(ql));
    return [...hits, ...cmds];
  }, [q, mode, db, today, commands]); // eslint-disable-line react-hooks/exhaustive-deps

  useEscape(() => (mode !== 'all' ? setMode('all') : onClose()));
  useEffect(() => setIdx(0), [q, mode]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[idx]?.run();
    } else if (e.key === 'Backspace' && !q && mode !== 'all') setMode('all');
  };

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/20 pt-[14vh] animate-fade dark:bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-[640px] overflow-hidden rounded-[14px] border bg-surface/[0.98] shadow-pop backdrop-blur-2xl animate-in" onKeyDown={onKey}>
        <div className="flex h-[52px] items-center gap-3 border-b px-4">
          <Search size={17} className="text-ink2" />
          {mode !== 'all' && (
            <span className="flex items-center gap-1 rounded-[6px] bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {mode === 'expiring' ? tr("Expiring") : mode === 'critical' ? tr("Critical") : tr("Pinned")}
            </span>
          )}
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === 'all' ? tr("Search assets, tasks, providers, or type a command…") : tr("Filter…")} className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink3" />
          <Kbd>{tr("esc")}</Kbd>
        </div>
        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-1.5">
          {items.length === 0 && <div className="py-10 text-center text-sm text-ink2">{tr('No results for “{q}”', { q })}</div>}
          {items.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <React.Fragment key={c.id}>
                {header && <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-ink2">{tr(header)}</div>}
                <button
                  data-idx={i}
                  onMouseMove={() => setIdx(i)}
                  onClick={c.run}
                  className={clsx('flex h-10 w-full items-center gap-3 rounded-[8px] px-2.5 text-start', i === idx ? 'bg-accent/[0.12] dark:bg-white/[0.08]' : '')}
                >
                  <span className="flex w-5 justify-center text-ink2">{c.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]">{c.title}</span>
                  </span>
                  {c.subtitle && <span className="max-w-[40%] truncate text-xs text-ink2">{c.subtitle}</span>}
                  {c.right}
                  {i === idx && <CornerDownLeft size={13} className="text-ink2" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex h-9 items-center gap-4 border-t px-4 text-xs text-ink2">
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-gradient-to-br from-accent to-[#5856D6] text-[9px] font-bold text-white">N</span>{tr("NEXUS")}
          </span>
          <span className="ms-auto flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> {tr("navigate")}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> {tr("open")}
          </span>
          {mode !== 'all' && (
            <span className="flex items-center gap-1">
              <Kbd>⌫</Kbd> {tr("back")}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
