import { ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, Copy, Eye, EyeOff, Globe, Plus, SlidersHorizontal, Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { ActivityRow } from '../../components/Activity';
import { assetWebsite, useAssetActions } from '../../components/assetActions';
import { go } from '../../components/hooks';
import { Ico, type IconlyName } from '../../components/Iconly';
import { Panel } from '../../components/Page';
import { PriorityMark } from '../../components/TaskForm';
import { Button, Checkbox, Countdown, EmptyState, IconButton, Modal, Switch, useContextMenu } from '../../components/ui';
import { useUI } from '../../components/ui-context';
import { toggleTask, updateSettings } from '../../lib/actions';
import { addDays, calAddMonths, calMonthRange, calParts, daysUntil, expiryStatus, formatDate, formatLongDate, greeting, monthName, toISODate } from '../../lib/dates';
import { filterTasks, sortTasks, stats } from '../../lib/logic';
import type { DashboardSectionId, DB } from '../../lib/types';
import { clsx, isSafeHttpUrl, money } from '../../lib/util';
import { AssetTile, ProviderAvatar } from './Assets';

import { getLang, t as tr, tn } from '../../lib/i18n';
const SECTION_LABEL: Record<DashboardSectionId, string> = {
  expirations: 'Upcoming Expirations',
  today: "Today's Tasks",
  activity: 'Recent Activity',
  quick: 'Quick Access',
  monthly: 'Monthly Overview',
};

/** Column span of each dashboard section on the 12-column grid. */
const SPAN: Record<DashboardSectionId, string> = {
  expirations: 'col-span-12 xl:col-span-8',
  today: 'col-span-12 md:col-span-6 xl:col-span-4',
  monthly: 'col-span-12 md:col-span-6 xl:col-span-4',
  quick: 'col-span-12 md:col-span-6 xl:col-span-4',
  activity: 'col-span-12 md:col-span-6 xl:col-span-4',
};

const TONES = {
  accent: { tile: 'bg-accent/10 text-accent', num: 'text-ink' },
  violet: { tile: 'bg-[#5856D6]/10 text-[#5856D6]', num: 'text-ink' },
  warn: { tile: 'bg-warn/20 text-warn-ink', num: 'text-warn-ink' },
  crit: { tile: 'bg-crit/10 text-crit', num: 'text-crit' },
  expired: { tile: 'bg-expired/10 text-expired', num: 'text-expired' },
  calm: { tile: 'bg-ink/[0.05] text-ink2', num: 'text-ink' },
} as const;

function Kpi({ label, value, hint, icon, tone, onClick }: { label: string; value: number; hint?: string; icon: IconlyName; tone: keyof typeof TONES; onClick: () => void }) {
  // alert tones stay calm when there's nothing to act on
  const t = TONES[value === 0 && ['warn', 'crit', 'expired'].includes(tone) ? 'calm' : tone];
  return (
    <button onClick={onClick} className="card group flex flex-col gap-4 p-5 text-start transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className={clsx('flex h-11 w-11 items-center justify-center rounded-[13px]', t.tile)}>
          <Ico name={icon} set="bulk" size={24} />
        </span>
        <ChevronLeft size={16} className="text-ink3 opacity-0 transition-opacity group-hover:opacity-100 ltr:rotate-180" />
      </div>
      <div>
        <div className={clsx('text-[30px] font-bold leading-9 tracking-tight tabular', value > 0 ? t.num : 'text-ink')}>{value}</div>
        <div className="mt-1 text-sm font-medium text-ink/80">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-ink2">{hint}</div>}
      </div>
    </button>
  );
}

export function OverviewPage({ db, today }: { db: DB; today: string }) {
  const s = stats(db, today);
  const ui = useUI();
  const [customize, setCustomize] = useState(false);
  const sections = db.settings.dashboardSections.filter((x) => x.visible).map((x) => x.id);
  const date = new Date();
  const name = db.settings.userName.trim();

  const spend30 = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of db.assets) {
      if (a.status !== 'active' || !a.expirationDate) continue;
      const d = daysUntil(a.expirationDate, today);
      const p = a.renewalPrice ?? a.purchasePrice;
      if (d >= 0 && d <= 30 && p) m.set(a.currency, (m.get(a.currency) || 0) + p);
    }
    return Array.from(m.entries()).map(([c, v]) => money(v, c)).join(' + ');
  }, [db.assets, today]);

  const header = (
    <div className="mb-7 flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink2">{formatLongDate(toISODate(date))}</div>
        <h1 className="mt-1 text-[30px] font-bold leading-10 tracking-tight">
          {greeting(date)}
          {name ? `${getLang() === 'fa' ? '،' : ','} ${name}` : ''} <span className="inline-block origin-bottom-right">👋</span>
        </h1>
      </div>
      <Button variant="ghost" icon={<SlidersHorizontal size={15} />} onClick={() => setCustomize(true)}>
        {tr('Customize')}
      </Button>
      <Button variant="primary" icon={<Plus size={16} />} onClick={() => ui.editAsset()}>
        {tr('Add asset')}
      </Button>
    </div>
  );

  if (db.assets.length === 0 && db.tasks.length === 0) {
    return (
      <div className="page">
        {header}
        <div className="card">
          <EmptyState
            icon={<Sparkles size={24} />}
            title={tr('Welcome to NEXUS')}
            body={tr('Your personal control center for domains, hosting, subscriptions, licenses and tasks. Everything stays on this device.')}
            action={
              <div className="flex gap-2">
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => ui.editAsset()}>
                  {tr('Add first asset')}
                </Button>
                <Button onClick={() => ui.editTask()}>{tr('Add a task')}</Button>
                <Button variant="ghost" onClick={() => go('settings', { section: 'data' })}>
                  {tr('Import backup')}
                </Button>
              </div>
            }
          />
        </div>
        {customize && <CustomizeModal db={db} onClose={() => setCustomize(false)} />}
      </div>
    );
  }

  const render = (id: DashboardSectionId) => {
    const props = { db, today };
    const el = {
      expirations: <Expirations {...props} />,
      today: <TodayTasks {...props} />,
      activity: <RecentActivity db={db} />,
      quick: <QuickAccessCard {...props} />,
      monthly: <MonthlyOverview {...props} />,
    }[id];
    return (
      <div key={id} className={clsx('flex', SPAN[id])}>
        {el}
      </div>
    );
  };

  return (
    <div className="page">
      {header}
      <div className="mb-5 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label={tr('Total assets')} value={s.total} hint={tr('{n} providers', { n: db.providers.length })} icon="assets" tone="accent" onClick={() => go('assets')} />
        <Kpi label={tr('Active tasks')} value={s.activeTasks} hint={tr('{n} due today', { n: filterTasks(db.tasks, 'today', today).length })} icon="tasks" tone="violet" onClick={() => go('tasks', { section: 'all' })} />
        <Kpi label={tr('Expiring in 30 days')} value={s.expiring} hint={spend30 || tr('No costs')} icon="clock" tone="warn" onClick={() => go('assets', { filter: '30' })} />
        <Kpi label={tr('Critical (≤ 3 days)')} value={s.critical} hint={s.critical ? tr('Renew now') : tr('All good')} icon="danger" tone="crit" onClick={() => go('assets', { filter: 'critical' })} />
        <Kpi label={tr('Expired')} value={s.expired} hint={tr('in the last 30 days or earlier')} icon="expired" tone="expired" onClick={() => go('assets', { filter: 'expired' })} />
      </div>
      <div className="grid-12 grid-flow-row-dense items-stretch">{sections.map(render)}</div>
      {sections.length === 0 && (
        <div className="mt-6 text-center text-sm text-ink2">
          {tr('All sections are hidden.')}{' '}
          <Button variant="plain" onClick={() => setCustomize(true)}>
            {tr('Customize dashboard')}
          </Button>
        </div>
      )}
      {customize && <CustomizeModal db={db} onClose={() => setCustomize(false)} />}
    </div>
  );
}

function Expirations({ db, today }: { db: DB; today: string }) {
  const ui = useUI();
  const ctx = useContextMenu();
  const { items } = useAssetActions(db);
  const cats = new Map(db.categories.map((c) => [c.id, c]));
  const provs = new Map(db.providers.map((p) => [p.id, p.name]));
  const list = db.assets
    .filter((a) => a.status === 'active' && a.expirationDate && daysUntil(a.expirationDate, today) <= 90 && daysUntil(a.expirationDate, today) >= -30)
    .sort((a, b) => a.expirationDate!.localeCompare(b.expirationDate!))
    .slice(0, 8);
  return (
    <Panel
      title={tr('Upcoming Expirations')}
      icon="clock"
      tone="orange"
      className="w-full"
      action={
        <Button size="sm" variant="ghost" onClick={() => go('assets', { filter: '30' })}>
          {tr('View all')}
        </Button>
      }
    >
      {list.length === 0 ? (
        <EmptyState compact icon={<CheckCircle2 size={18} />} title={tr('Nothing expiring soon')} body={tr('No active assets expire within the next 90 days.')} />
      ) : (
        <div className="px-2 pb-2">
          {list.map((a) => {
            const st = expiryStatus(a.expirationDate, today);
            const cat = cats.get(a.categoryId);
            const prov = a.providerId ? provs.get(a.providerId) : undefined;
            return (
              <button
                key={a.id}
                onClick={() => ui.openAsset(a.id)}
                onContextMenu={(e) => ctx(e, items(a))}
                className={clsx('flex h-[60px] w-full items-center gap-3 rounded-[12px] px-3 text-start transition-colors hover:bg-ink/[0.035]', st === 'critical' && 'bg-crit/[0.035]')}
              >
                <AssetTile category={cat} color={cat?.color} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {a.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink2">
                    {prov && <ProviderAvatar name={prov} size={16} />}
                    {[prov, cat?.name].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="hidden w-[120px] text-end text-sm font-medium tabular text-ink/80 sm:block">{formatDate(a.expirationDate, db.settings.dateFormat)}</div>
                <div className="hidden w-[130px] text-end text-sm font-semibold tabular md:block">{money(a.renewalPrice ?? a.purchasePrice, a.currency)}</div>
                <div className="flex w-[130px] justify-end">
                  <Countdown date={a.expirationDate} today={today} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function TodayTasks({ db, today }: { db: DB; today: string }) {
  const ui = useUI();
  const list = sortTasks(filterTasks(db.tasks, 'today', today));
  const doneToday = db.tasks.filter((t) => t.done && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length;
  return (
    <Panel
      title={tr("Today's Tasks")}
      icon="tasks"
      tone="violet"
      className="w-full"
      action={
        <>
          {doneToday > 0 && <span className="text-xs text-ink2">{tr('{n} done', { n: doneToday })}</span>}
          <IconButton label={tr('Add task')} className="h-8 w-8" onClick={() => ui.editTask(undefined, { dueDate: today })}>
            <Plus size={16} />
          </IconButton>
        </>
      }
    >
      {list.length === 0 ? (
        <EmptyState compact icon={<CheckCircle2 size={18} />} title={tr('All clear for today')} body={tr('Tasks due today or overdue appear here.')} />
      ) : (
        <div className="max-h-[360px] overflow-y-auto px-2 pb-2">
          {list.map((t) => {
            const overdue = t.dueDate && daysUntil(t.dueDate, today) < 0;
            const asset = t.assetId ? db.assets.find((a) => a.id === t.assetId) : undefined;
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors hover:bg-ink/[0.035]">
                <Checkbox round checked={t.done} onChange={() => toggleTask(t.id)} color={t.priority === 'urgent' ? '#FF3B30' : undefined} />
                <button className="min-w-0 flex-1 text-start" onClick={() => ui.openTask(t.id)}>
                  <span className="flex items-center gap-1.5">
                    <PriorityMark p={t.priority} />
                    <span className="truncate text-sm font-medium">{t.title}</span>
                  </span>
                  {(asset || overdue) && (
                    <span className="mt-0.5 block truncate text-xs text-ink2">
                      {overdue && <span className="text-crit">{tr('Overdue')} · {formatDate(t.dueDate, db.settings.dateFormat)}</span>}
                      {overdue && asset && ' · '}
                      {asset?.name}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function RecentActivity({ db }: { db: DB }) {
  const ui = useUI();
  return (
    <Panel
      title={tr('Recent Activity')}
      icon="activity"
      tone="gray"
      className="w-full"
      action={
        <Button size="sm" variant="ghost" onClick={() => ui.openActivity()}>
          {tr('View all')}
        </Button>
      }
    >
      {db.activity.length === 0 ? (
        <EmptyState compact icon={<Sparkles size={18} />} title={tr('No activity yet')} />
      ) : (
        <div className="max-h-[360px] overflow-y-auto px-3 pb-3">
          {db.activity.slice(0, 10).map((a) => (
            <ActivityRow
              key={a.id}
              a={a}
              onOpen={
                a.itemType === 'asset' && a.itemId && db.assets.some((x) => x.id === a.itemId)
                  ? () => ui.openAsset(a.itemId!)
                  : a.itemType === 'task' && a.itemId && db.tasks.some((x) => x.id === a.itemId)
                    ? () => ui.openTask(a.itemId!)
                    : undefined
              }
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function QuickAccessCard({ db, today }: { db: DB; today: string }) {
  const ui = useUI();
  const { copy, open } = useAssetActions(db);
  const order = db.settings.pinOrder;
  const pinned = db.assets.filter((a) => a.pinned).sort((a, b) => order.indexOf(`asset:${a.id}`) - order.indexOf(`asset:${b.id}`));
  const recent = db.assets
    .filter((a) => !a.pinned && a.status === 'active')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(0, 6 - pinned.length));
  const cats = new Map(db.categories.map((c) => [c.id, c]));
  const row = (a: DB['assets'][number], pin: boolean) => (
    <div key={a.id} className="group flex h-[52px] items-center gap-3 rounded-[12px] px-3 transition-colors hover:bg-ink/[0.035]">
      <AssetTile category={cats.get(a.categoryId)} color={cats.get(a.categoryId)?.color} />
      <button className="min-w-0 flex-1 text-start" onClick={() => ui.openAsset(a.id)}>
        <span className="block truncate text-sm font-semibold">
          {a.name}
        </span>
        {!pin && <span className="block text-2xs text-ink3">{tr('recent')}</span>}
      </button>
      <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
        <IconButton label={tr('Open website')} className="h-8 w-8" onClick={() => open(a)} disabled={!isSafeHttpUrl(assetWebsite(a))}>
          <Globe size={15} />
        </IconButton>
        <IconButton label={tr('Copy URL')} className="h-8 w-8" onClick={() => copy(assetWebsite(a), 'URL')}>
          <Copy size={15} />
        </IconButton>
      </span>
      {a.expirationDate && <Countdown date={a.expirationDate} today={today} short />}
    </div>
  );
  return (
    <Panel
      title={tr('Quick Access')}
      icon="quick"
      tone="orange"
      className="w-full"
      action={
        <Button size="sm" variant="ghost" onClick={() => go('quick')}>
          {tr('Manage')}
        </Button>
      }
    >
      {pinned.length + recent.length === 0 ? (
        <EmptyState compact icon={<Sparkles size={18} />} title={tr('Nothing pinned')} body={tr('Pin assets to reach them instantly.')} />
      ) : (
        <div className="px-2 pb-2">
          {pinned.map((a) => row(a, true))}
          {recent.map((a) => row(a, false))}
        </div>
      )}
    </Panel>
  );
}

function MonthlyOverview({ db, today }: { db: DB; today: string }) {
  const ui = useUI();
  const months = useMemo(() => {
    const { y, m } = calParts(today);
    return Array.from({ length: 6 }, (_, i) => {
      const cm = calAddMonths(y, m, i);
      const { start, end } = calMonthRange(cm.y, cm.m);
      const inRange = (d?: string) => !!d && d >= start && d <= end;
      const assets = db.assets.filter((a) => a.status === 'active' && inRange(a.expirationDate)).sort((a, b) => a.expirationDate!.localeCompare(b.expirationDate!));
      const tasks = db.tasks.filter((t) => !t.done && inRange(t.dueDate));
      const cost = new Map<string, number>();
      for (const a of assets) {
        const p = a.renewalPrice ?? a.purchasePrice;
        if (p) cost.set(a.currency, (cost.get(a.currency) || 0) + p);
      }
      return { key: start, label: monthName(cm.m, true), name: monthName(cm.m), year: cm.y, assets, tasks, cost };
    });
  }, [db.assets, db.tasks, today]);
  const max = Math.max(1, ...months.map((x) => x.assets.length + x.tasks.length));
  const [sel, setSel] = useState(0);
  const cur = months[sel];
  const week = db.assets.filter((a) => a.status === 'active' && a.expirationDate && daysUntil(a.expirationDate, today) >= 0 && a.expirationDate <= addDays(today, 7)).length;
  return (
    <Panel title={tr('Monthly Overview')} icon="chart" tone="violet" className="w-full" action={<span className="text-xs text-ink2">{tn(week, '{n} renewal this week', '{n} renewals this week')}</span>}>
      <div className="px-5 pb-5">
        <div className="flex h-[110px] items-end gap-2 rounded-[12px] bg-bg/70 px-3 pb-2 pt-3 dark:bg-white/[0.03]">
          {months.map((mo, i) => {
            const n = mo.assets.length + mo.tasks.length;
            const crit = mo.assets.some((a) => ['critical', 'expired'].includes(expiryStatus(a.expirationDate, today)));
            const warn = mo.assets.some((a) => expiryStatus(a.expirationDate, today) === 'warning');
            return (
              <button key={mo.key} onClick={() => setSel(i)} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={tr('{a} renewals, {t} tasks', { a: mo.assets.length, t: mo.tasks.length })}>
                <span className="text-[11px] font-semibold text-ink2 tabular">{n || ''}</span>
                <span
                  className={clsx('w-full max-w-[30px] rounded-[7px] transition-all', i === sel ? 'opacity-100' : 'opacity-40 group-hover:opacity-75', crit ? 'bg-crit' : warn ? 'bg-warn' : n ? 'bg-gradient-to-t from-accent to-[#5AC8FA]' : 'bg-ink/10')}
                  style={{ height: `${Math.max(6, (n / max) * 56)}px` }}
                />
                <span className={clsx('text-[11px]', i === sel ? 'font-bold text-ink' : 'text-ink2')}>{mo.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm font-semibold">
            {cur.name} {cur.year}
          </span>
          <span className="text-sm font-bold tabular">{Array.from(cur.cost.entries()).map(([c, v]) => money(v, c)).join(' + ') || <span className="font-normal text-ink2">{tr('No costs')}</span>}</span>
        </div>
        <div className="mt-2 max-h-[150px] space-y-0.5 overflow-y-auto">
          {cur.assets.length + cur.tasks.length === 0 ? (
            <div className="py-3 text-center text-xs text-ink3">{tr('No renewals or deadlines')}</div>
          ) : (
            <>
              {cur.assets.map((a) => (
                <button key={a.id} onClick={() => ui.openAsset(a.id)} className="flex h-9 w-full items-center gap-3 rounded-[10px] px-2 text-start text-sm transition-colors hover:bg-ink/[0.035]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-ink/[0.05] text-xs font-bold tabular">{calParts(a.expirationDate!).d}</span>
                  <span className="flex-1 truncate">
                    {a.name}
                  </span>
                  <Countdown date={a.expirationDate} today={today} short />
                </button>
              ))}
              {cur.tasks.map((t) => (
                <button key={t.id} onClick={() => ui.openTask(t.id)} className="flex h-9 w-full items-center gap-3 rounded-[10px] px-2 text-start text-sm transition-colors hover:bg-ink/[0.035]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent/10 text-xs font-bold text-accent tabular">{calParts(t.dueDate!).d}</span>
                  <span className="flex-1 truncate text-ink2">{t.title}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function CustomizeModal({ db, onClose }: { db: DB; onClose: () => void }) {
  const [secs, setSecs] = useState(db.settings.dashboardSections);
  const [drag, setDrag] = useState<number | null>(null);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= secs.length) return;
    const n = secs.slice();
    [n[i], n[j]] = [n[j], n[i]];
    setSecs(n);
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={400}
      title={tr("Customize dashboard")}
      footer={
        <>
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button variant="primary" onClick={() => updateSettings({ dashboardSections: secs }).then(onClose)}>
            {tr("Save")}
          </Button>
        </>
      }
    >
      <p className="mb-2 text-xs text-ink2">{tr("Drag or use arrows to reorder. Toggle to show or hide.")}</p>
      <div className="space-y-1">
        {secs.map((s, i) => (
          <div
            key={s.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => {
              e.preventDefault();
              if (drag === null || drag === i) return;
              const n = secs.slice();
              const [it] = n.splice(drag, 1);
              n.splice(i, 0, it);
              setSecs(n);
              setDrag(i);
            }}
            onDragEnd={() => setDrag(null)}
            className={clsx('flex h-9 cursor-grab items-center gap-2 rounded-[8px] border bg-surface px-2.5', drag === i && 'opacity-50')}
          >
            {s.visible ? <Eye size={13} className="text-ink2" /> : <EyeOff size={13} className="text-ink3" />}
            <span className={clsx('flex-1 text-sm', !s.visible && 'text-ink2')}>{tr(SECTION_LABEL[s.id])}</span>
            <IconButton label={tr("Move up")} className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp size={12} />
            </IconButton>
            <IconButton label={tr("Move down")} className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === secs.length - 1}>
              <ArrowDown size={12} />
            </IconButton>
            <Switch checked={s.visible} onChange={(v) => setSecs(secs.map((x) => (x.id === s.id ? { ...x, visible: v } : x)))} label={tr(SECTION_LABEL[s.id])} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
