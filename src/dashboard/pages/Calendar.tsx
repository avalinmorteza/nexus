import { ChevronLeft, ChevronRight, ListTodo, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePersistentState } from '../../components/hooks';
import { Ico } from '../../components/Iconly';
import { CategoryIcon } from '../../components/icons';
import { PageHeader } from '../../components/Page';
import { Button, Countdown, EmptyState, IconButton, Segmented, StatusDot } from '../../components/ui';
import { useUI } from '../../components/ui-context';
import { addDays, calAddMonths, calMonthRange, calParts, calToISO, daysUntil, expiryStatus, formatDate, fromISO, getCalendar, monthMatrix, monthName, startOfWeek, weekdayName } from '../../lib/dates';
import { iranHoliday } from '../../lib/holidays';
import { getLang, t as tr, tn } from '../../lib/i18n';
import type { DB, ExpiryStatus, ISODate } from '../../lib/types';
import { clsx, money } from '../../lib/util';

type View = 'month' | 'week' | 'agenda' | 'year';

interface CalEvent {
  id: string;
  kind: 'asset' | 'task' | 'reminder';
  refId: string;
  date: ISODate;
  title: string;
  status: ExpiryStatus | 'task' | 'done';
  categoryId?: string;
  time?: string;
  price?: number;
  currency?: string;
}

const EVENT_STYLE: Record<CalEvent['status'], { chip: string; bar: string; dot: string }> = {
  normal: { chip: 'bg-ok/[0.1] text-[#1f7a3a] dark:text-ok', bar: 'bg-ok', dot: 'bg-ok' },
  warning: { chip: 'bg-warn/[0.18] text-warn-ink', bar: 'bg-warn', dot: 'bg-warn' },
  critical: { chip: 'bg-crit/[0.1] text-crit', bar: 'bg-crit', dot: 'bg-crit' },
  expired: { chip: 'bg-expired/[0.1] text-expired', bar: 'bg-expired', dot: 'bg-expired' },
  none: { chip: 'bg-ink/[0.05] text-ink2', bar: 'bg-ink3', dot: 'bg-ink3' },
  task: { chip: 'bg-accent/[0.09] text-accent', bar: 'bg-accent', dot: 'bg-accent' },
  done: { chip: 'bg-ink/[0.04] text-ink3 line-through', bar: 'bg-ink3', dot: 'bg-ink3' },
};
const RANK: Record<CalEvent['status'], number> = { expired: 0, critical: 1, warning: 2, task: 3, normal: 4, none: 5, done: 6 };

export function CalendarPage({ db, today }: { db: DB; today: string }) {
  const ui = useUI();
  const [view, setView] = usePersistentState<View>('cal.view', 'month');
  const [cursor, setCursor] = useState<ISODate>(today);
  const [hiddenCats, setHiddenCats] = usePersistentState<string[]>('cal.hiddenCats', []);
  const [showTasks, setShowTasks] = usePersistentState('cal.tasks', true);
  const [showDone, setShowDone] = usePersistentState('cal.done', false);
  const ws = db.settings.weekStart;
  const persian = getLang() === 'fa' || getCalendar() === 'jalali';
  const isOff = (d: ISODate) => {
    const dow = fromISO(d).getDay();
    return persian ? dow === 5 : dow === 0 || dow === 6;
  };
  const holiday = (d: ISODate) => (persian ? iranHoliday(d) : undefined);

  const events = useMemo(() => {
    const ev: CalEvent[] = [];
    for (const a of db.assets) {
      if (!a.expirationDate || hiddenCats.includes(a.categoryId)) continue;
      ev.push({
        id: 'a' + a.id,
        kind: 'asset',
        refId: a.id,
        date: a.expirationDate,
        title: a.name,
        status: a.status === 'active' ? expiryStatus(a.expirationDate, today) : 'none',
        categoryId: a.categoryId,
        price: a.status === 'active' ? (a.renewalPrice ?? a.purchasePrice) : undefined,
        currency: a.currency,
      });
    }
    if (showTasks)
      for (const t of db.tasks) {
        if (t.done && !showDone) continue;
        if (t.dueDate) ev.push({ id: 't' + t.id, kind: 'task', refId: t.id, date: t.dueDate, title: t.title, status: t.done ? 'done' : 'task' });
        else if (t.reminderAt && !t.done) ev.push({ id: 'r' + t.id, kind: 'reminder', refId: t.id, date: t.reminderAt.slice(0, 10), title: t.title, status: 'task', time: t.reminderAt.slice(11, 16) });
      }
    const map = new Map<ISODate, CalEvent[]>();
    for (const e of ev) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    for (const l of map.values()) l.sort((a, b) => RANK[a.status] - RANK[b.status] || a.title.localeCompare(b.title));
    return map;
  }, [db.assets, db.tasks, hiddenCats, showTasks, showDone, today]);

  const open = (e: CalEvent) => (e.kind === 'asset' ? ui.openAsset(e.refId) : ui.openTask(e.refId));
  const { y, m } = calParts(cursor);

  const nav = (dir: number) => {
    if (view === 'month') {
      const n = calAddMonths(y, m, dir);
      setCursor(calToISO(n.y, n.m, 1));
    } else if (view === 'year') setCursor(calToISO(y + dir, 1, 1));
    else setCursor(addDays(cursor, dir * (view === 'week' ? 7 : 30)));
  };

  // range summary (month in month view, year in year view, otherwise the visible month)
  const range = view === 'year' ? { start: calToISO(y, 1, 1), end: calMonthRange(y, 12).end } : calMonthRange(y, m);
  const summary = useMemo(() => {
    let renewals = 0,
      tasks = 0;
    const cost = new Map<string, number>();
    for (const [d, list] of events) {
      if (d < range.start || d > range.end) continue;
      for (const e of list) {
        if (e.kind === 'asset' && e.status !== 'none') {
          renewals++;
          if (e.price) cost.set(e.currency || 'USD', (cost.get(e.currency || 'USD') || 0) + e.price);
        } else if (e.kind !== 'asset' && e.status !== 'done') tasks++;
      }
    }
    return { renewals, tasks, cost: Array.from(cost.entries()).map(([c, v]) => money(v, c)).join(' + ') };
  }, [events, range.start, range.end]);
  const next = useMemo(() => {
    for (let i = 0; i <= 400; i++) {
      const d = addDays(today, i);
      const e = (events.get(d) || []).find((x) => x.kind === 'asset' && x.status !== 'none');
      if (e) return e;
    }
    return undefined;
  }, [events, today]);

  const title =
    view === 'month' ? `${monthName(m)} ${y}` : view === 'year' ? String(y) : view === 'week' ? tr('Week of {date}', { date: formatDate(startOfWeek(cursor, ws), db.settings.dateFormat) }) : tr('From {date}', { date: formatDate(cursor, db.settings.dateFormat) });
  const wdShort = getLang() !== 'fa';
  const weekdays = Array.from({ length: 7 }, (_, i) => (i + ws) % 7);
  const usedCats = db.categories.filter((c) => db.assets.some((a) => a.categoryId === c.id && a.expirationDate));

  const Chip = ({ e, wide }: { e: CalEvent; wide?: boolean }) => (
    <button
      onClick={(ev) => {
        ev.stopPropagation();
        open(e);
      }}
      title={`${e.title} — ${e.kind === 'asset' ? tr('expiration') : tr('task')}`}
      className={clsx('relative flex w-full items-center gap-1.5 overflow-hidden rounded-[7px] ps-2.5 pe-1.5 text-start font-medium transition-[filter] hover:brightness-95', wide ? 'h-8 text-sm' : 'h-[22px] text-[11.5px]', EVENT_STYLE[e.status].chip)}
    >
      <span className={clsx('absolute inset-y-1 start-1 w-[3px] rounded-full', EVENT_STYLE[e.status].bar)} />
      {e.kind !== 'asset' && <ListTodo size={wide ? 13 : 11} className="shrink-0" />}
      {e.time && <span className="opacity-70">{e.time}</span>}
      <span className="truncate" dir="ltr">
        {e.title}
      </span>
    </button>
  );

  const upcoming = useMemo(() => {
    const out: CalEvent[] = [];
    for (let i = -7; i <= 60; i++) {
      const d = addDays(today, i);
      for (const e of events.get(d) || []) if (e.status !== 'done' && (i >= 0 || e.status === 'expired' || e.status === 'task')) out.push(e);
    }
    return out.slice(0, 40);
  }, [events, today]);

  return (
    <div className="page !max-w-[1600px]">
      <PageHeader
        icon="calendar"
        tone="violet"
        title={tr('Renewal calendar')}
        subtitle={getCalendar() === 'jalali' ? tr('Shamsi calendar · official holidays and Fridays highlighted') : tr('Renewals, deadlines and reminders in one place')}
        actions={
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'month', label: tr('Month') },
              { value: 'week', label: tr('Week') },
              { value: 'agenda', label: tr('Agenda') },
              { value: 'year', label: tr('Year') },
            ]}
          />
        }
      />

      {/* summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <SummaryCard icon="calendar" tone="violet" label={view === 'year' ? tr('Renewals this year') : tr('Renewals this month')} value={String(summary.renewals)} />
        <SummaryCard icon="wallet" tone="green" label={view === 'year' ? tr('Renewal cost this year') : tr('Renewal cost this month')} value={summary.cost || '—'} />
        <SummaryCard icon="tasks" tone="accent" label={tr('Tasks in this period')} value={String(summary.tasks)} />
        <SummaryCard
          icon="clock"
          tone="orange"
          label={tr('Next renewal')}
          value={next ? next.title : '—'}
          hint={next ? `${formatDate(next.date, db.settings.dateFormat)} · ${tn(daysUntil(next.date, today), 'in {n} day', 'in {n} days')}` : undefined}
          onClick={next ? () => open(next) : undefined}
          ltrValue
        />
      </div>

      <div className="flex gap-5">
        <div className="min-w-0 flex-1">
          <div className="card overflow-hidden">
            {/* toolbar */}
            <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5">
              <div className="flex items-center gap-1">
                <IconButton label={tr('Previous')} onClick={() => nav(-1)} className="bg-ink/[0.04]">
                  <ChevronLeft size={18} className="rtl:rotate-180" />
                </IconButton>
                <IconButton label={tr('Next')} onClick={() => nav(1)} className="bg-ink/[0.04]">
                  <ChevronRight size={18} className="rtl:rotate-180" />
                </IconButton>
              </div>
              <h2 className="text-[19px] font-bold tracking-tight">{title}</h2>
              <Button size="sm" onClick={() => setCursor(today)}>
                {tr('Today')}
              </Button>
              <div className="ms-auto flex flex-wrap items-center gap-1.5">
                <FilterChip on={showTasks} onClick={() => setShowTasks(!showTasks)} color="#007AFF">
                  {tr('Tasks')}
                </FilterChip>
                {showTasks && (
                  <FilterChip on={showDone} onClick={() => setShowDone(!showDone)} color="#8E8E93">
                    {tr('Completed')}
                  </FilterChip>
                )}
                <span className="mx-1 h-5 w-px bg-line/10" />
                {usedCats.map((c) => {
                  const on = !hiddenCats.includes(c.id);
                  return (
                    <FilterChip key={c.id} on={on} color={c.color} onClick={() => setHiddenCats(on ? [...hiddenCats, c.id] : hiddenCats.filter((x) => x !== c.id))}>
                      {c.name}
                    </FilterChip>
                  );
                })}
              </div>
            </div>

            {view === 'month' && (
              <>
                <div className="grid grid-cols-7 border-b bg-surface2/60 dark:bg-white/[0.02]">
                  {weekdays.map((d) => (
                    <div key={d} className={clsx('px-3 py-2.5 text-xs font-semibold', (persian ? d === 5 : d === 0 || d === 6) ? 'text-crit/80' : 'text-ink2')}>
                      {weekdayName(d, wdShort)}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthMatrix(y, m, ws)
                    .flat()
                    .map((d, i) => {
                      const p = calParts(d);
                      const inMonth = p.m === m;
                      const evs = events.get(d) || [];
                      const isToday = d === today;
                      const hol = holiday(d);
                      const off = isOff(d) || !!hol;
                      return (
                        <div
                          key={d}
                          onDoubleClick={() => ui.editTask(undefined, { dueDate: d })}
                          className={clsx(
                            'group relative min-h-[118px] border-b border-e border-line/[0.06] p-2 transition-colors',
                            (i + 1) % 7 === 0 && 'border-e-0',
                            i >= 35 && 'border-b-0',
                            !inMonth ? 'bg-ink/[0.018] dark:bg-white/[0.01]' : off ? 'bg-crit/[0.022]' : 'hover:bg-ink/[0.015]',
                          )}
                        >
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <span
                              className={clsx(
                                'flex h-7 min-w-[28px] items-center justify-center rounded-full px-1 text-[13px] font-semibold tabular',
                                isToday ? 'bg-accent text-white shadow-[0_4px_10px_-3px_rgb(var(--accent)/0.6)]' : !inMonth ? 'text-ink3' : off ? 'text-crit' : 'text-ink',
                              )}
                            >
                              {p.d}
                            </span>
                            {hol && inMonth && <span className="truncate text-[10.5px] font-medium text-crit/80">{tr(hol)}</span>}
                            <button className="ms-auto rounded-md p-0.5 text-ink3 opacity-0 transition-opacity hover:bg-ink/5 hover:text-ink group-hover:opacity-100" onClick={() => ui.editTask(undefined, { dueDate: d })} title={tr('Add task on this day')}>
                              <Plus size={14} />
                            </button>
                          </div>
                          <div className="space-y-1">
                            {evs.slice(0, 3).map((e) => (
                              <Chip key={e.id} e={e} />
                            ))}
                            {evs.length > 3 && (
                              <button className="px-1.5 text-[11px] font-semibold text-ink2 hover:text-accent" onClick={() => (setCursor(d), setView('agenda'))}>
                                +{evs.length - 3} {tr('more')}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {view === 'week' && (
              <div className="grid min-h-[480px] grid-cols-7">
                {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor, ws), i)).map((d, i) => {
                  const evs = events.get(d) || [];
                  const isToday = d === today;
                  const hol = holiday(d);
                  const off = isOff(d) || !!hol;
                  return (
                    <div key={d} className={clsx('flex flex-col border-e border-line/[0.06]', i === 6 && 'border-e-0', off && 'bg-crit/[0.022]')}>
                      <div className={clsx('border-b px-3 py-3 text-center', isToday && 'bg-accent/[0.06]')}>
                        <div className={clsx('text-xs font-semibold', off ? 'text-crit/80' : 'text-ink2')}>{weekdayName(fromISO(d).getDay(), wdShort)}</div>
                        <div className={clsx('mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-[17px] font-bold tabular', isToday ? 'bg-accent text-white' : off ? 'text-crit' : '')}>{calParts(d).d}</div>
                        {hol && <div className="mt-1 truncate text-[10.5px] text-crit/80">{tr(hol)}</div>}
                      </div>
                      <div className="flex-1 space-y-1.5 p-2" onDoubleClick={() => ui.editTask(undefined, { dueDate: d })}>
                        {evs.map((e) => (
                          <Chip key={e.id} e={e} wide />
                        ))}
                        {evs.length === 0 && <div className="pt-6 text-center text-xs text-ink3">—</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {view === 'agenda' && (
              <div>
                {(() => {
                  const days = Array.from({ length: 60 }, (_, i) => addDays(cursor, i)).filter((d) => events.get(d)?.length);
                  if (!days.length) return <EmptyState icon={<ListTodo size={20} />} title={tr('Nothing scheduled')} body={tr('No renewals or tasks in the next 60 days from this date.')} />;
                  return days.map((d) => {
                    const dd = daysUntil(d, today);
                    return (
                      <div key={d} className="flex gap-5 border-b border-line/[0.06] px-5 py-4 last:border-0">
                        <div className="w-[110px] shrink-0">
                          <div className={clsx('flex h-12 w-12 flex-col items-center justify-center rounded-[13px] leading-none', d === today ? 'bg-accent text-white' : 'bg-ink/[0.05]')}>
                            <span className="text-[17px] font-bold tabular">{calParts(d).d}</span>
                            <span className="mt-0.5 text-[10px] font-medium opacity-80">{monthName(calParts(d).m, true)}</span>
                          </div>
                          <div className="mt-1.5 text-xs text-ink2">{d === today ? tr('Today') : dd > 0 ? tr('in {n}d', { n: dd }) : tr('{n}d ago', { n: -dd })}</div>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          {events.get(d)!.map((e) => (
                            <button key={e.id} onClick={() => open(e)} className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-start transition-colors hover:bg-ink/[0.035]">
                              {e.kind === 'asset' ? <CategoryIcon category={db.categories.find((c) => c.id === e.categoryId)} size={13} /> : <span className="flex h-[21px] w-[21px] items-center justify-center rounded-md bg-accent/10 text-accent"><ListTodo size={13} /></span>}
                              <span className={clsx('flex-1 truncate font-medium', e.status === 'done' && 'text-ink3 line-through')}>
                                {e.title}
                              </span>
                              {e.price ? <span className="text-sm font-semibold tabular">{money(e.price, e.currency || 'USD')}</span> : null}
                              <span className="w-[90px] text-end text-xs text-ink2">{e.kind === 'asset' ? tr('Expiration') : e.kind === 'reminder' ? `${tr('Reminder')} ${e.time}` : tr('Task due')}</span>
                              {e.kind === 'asset' && <Countdown date={e.date} today={today} short />}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {view === 'year' && (
              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mm) => {
                  const r = calMonthRange(y, mm);
                  let count = 0;
                  const cost = new Map<string, number>();
                  for (const [d, list] of events)
                    if (d >= r.start && d <= r.end)
                      for (const e of list)
                        if (e.kind === 'asset' && e.status !== 'none') {
                          count++;
                          if (e.price) cost.set(e.currency || 'USD', (cost.get(e.currency || 'USD') || 0) + e.price);
                        }
                  const isCur = calParts(today).y === y && calParts(today).m === mm;
                  return (
                    <div key={mm} className={clsx('rounded-[14px] border p-3.5 transition-shadow hover:shadow-lift', isCur ? 'border-accent/40 bg-accent/[0.03]' : 'border-line/[0.07]')}>
                      <button className="mb-2 flex w-full items-baseline justify-between text-start" onClick={() => (setCursor(calToISO(y, mm, 1)), setView('month'))}>
                        <span className={clsx('text-[15px] font-bold', isCur && 'text-accent')}>{monthName(mm)}</span>
                        <span className="text-xs text-ink2">{count ? tn(count, '{n} renewal', '{n} renewals') : ''}</span>
                      </button>
                      <div className="grid grid-cols-7 gap-y-0.5 text-center">
                        {weekdays.map((d) => (
                          <span key={d} className={clsx('pb-1 text-[10px] font-semibold', (persian ? d === 5 : d === 0 || d === 6) ? 'text-crit/70' : 'text-ink3')}>
                            {weekdayName(d, true).slice(0, getLang() === 'fa' ? 1 : 2)}
                          </span>
                        ))}
                        {monthMatrix(y, mm, ws)
                          .flat()
                          .map((d) => {
                            const p = calParts(d);
                            if (p.m !== mm) return <span key={d} />;
                            const evs = events.get(d) || [];
                            const top = evs[0];
                            const off = isOff(d) || !!holiday(d);
                            return (
                              <button
                                key={d}
                                title={[holiday(d) ? tr(holiday(d)!) : '', ...evs.map((e) => e.title)].filter(Boolean).join('\n')}
                                onClick={() => (evs.length === 1 ? open(evs[0]) : (setCursor(d), setView(evs.length ? 'agenda' : 'month')))}
                                className={clsx(
                                  'relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11.5px] tabular transition-colors',
                                  d === today ? 'bg-accent font-bold text-white' : top ? clsx(EVENT_STYLE[top.status].chip, 'font-bold') : off ? 'text-crit/80 hover:bg-ink/5' : 'text-ink/80 hover:bg-ink/5',
                                )}
                              >
                                {p.d}
                                {evs.length > 1 && <span className="absolute -top-0.5 end-0 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-ink px-0.5 text-[8px] font-bold text-surface">{evs.length}</span>}
                              </button>
                            );
                          })}
                      </div>
                      <div className="mt-2 border-t border-line/[0.06] pt-2 text-end text-xs font-semibold tabular text-ink/80">{Array.from(cost.entries()).map(([c, v]) => money(v, c)).join(' + ') || <span className="font-normal text-ink3">—</span>}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* legend */}
            <div className="flex flex-wrap items-center gap-4 border-t px-5 py-3 text-xs text-ink2">
              <span className="flex items-center gap-1.5">
                <StatusDot status="normal" /> {tr('More than 30 days')}
              </span>
              <span className="flex items-center gap-1.5">
                <StatusDot status="warning" /> {tr('30–4 days')}
              </span>
              <span className="flex items-center gap-1.5">
                <StatusDot status="critical" /> {tr('3–0 days')}
              </span>
              <span className="flex items-center gap-1.5">
                <StatusDot status="expired" /> {tr('Expired')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" /> {tr('Task')}
              </span>
              {persian && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-crit/20" /> {tr('Holiday / Friday')}
                </span>
              )}
              <span className="ms-auto text-ink3">{tr('Double-click a day to add a task')}</span>
            </div>
          </div>
        </div>

        {/* upcoming timeline */}
        <aside className="hidden w-[320px] shrink-0 xl:block">
          <div className="card sticky top-[88px] overflow-hidden">
            <div className="flex h-14 items-center gap-2.5 border-b px-5">
              <Ico name="clock" set="bulk" size={20} className="text-[#E08300]" />
              <span className="text-[15px] font-semibold">{tr('Upcoming')}</span>
              <span className="ms-auto text-xs text-ink2">{tr('next 60 days')}</span>
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-3">
              {upcoming.length === 0 ? (
                <EmptyState compact icon={<ListTodo size={16} />} title={tr('Clear horizon')} body={tr('Nothing in the next 60 days.')} />
              ) : (
                <ol className="relative ms-3 border-s-2 border-line/[0.07]">
                  {upcoming.map((e) => {
                    const dd = daysUntil(e.date, today);
                    return (
                      <li key={e.id} className="relative mb-1 ps-4">
                        <span className={clsx('absolute -start-[7px] top-[15px] h-3 w-3 rounded-full ring-[3px] ring-surface', EVENT_STYLE[e.status].dot)} />
                        <button onClick={() => open(e)} className="w-full rounded-[10px] px-2.5 py-2 text-start transition-colors hover:bg-ink/[0.035]">
                          <div className="truncate text-sm font-semibold">
                            {e.title}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink2">
                            <span className="tabular">{formatDate(e.date, db.settings.dateFormat)}</span>
                            <span>·</span>
                            <span className={clsx(dd <= 3 && e.kind === 'asset' && 'font-semibold text-crit')}>{dd === 0 ? tr('today') : dd === 1 ? tr('tomorrow') : dd < 0 ? tr('{n}d ago', { n: -dd }) : tr('in {n}d', { n: dd })}</span>
                            {e.price ? <span className="ms-auto font-semibold tabular text-ink/80">{money(e.price, e.currency || 'USD')}</span> : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryCard({ icon, tone, label, value, hint, onClick, ltrValue }: { icon: 'calendar' | 'wallet' | 'tasks' | 'clock'; tone: 'violet' | 'green' | 'accent' | 'orange'; label: string; value: string; hint?: string; onClick?: () => void; ltrValue?: boolean }) {
  const t = { violet: 'bg-[#5856D6]/10 text-[#5856D6]', green: 'bg-ok/12 text-[#1f8a3e] dark:text-ok', accent: 'bg-accent/10 text-accent', orange: 'bg-[#FF9500]/12 text-[#E08300]' }[tone];
  return (
    <button onClick={onClick} disabled={!onClick} className="card flex items-center gap-4 p-4 text-start transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-lift">
      <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]', t)}>
        <Ico name={icon} set="bulk" size={23} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-ink2">{label}</span>
        <span className="mt-0.5 block truncate text-[17px] font-bold tabular" dir={ltrValue ? 'ltr' : undefined} style={ltrValue ? { textAlign: 'start' } : undefined}>
          {value}
        </span>
        {hint && <span className="block truncate text-xs text-ink2">{hint}</span>}
      </span>
    </button>
  );
}

function FilterChip({ on, onClick, color, children }: { on: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={clsx('flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-all', on ? 'border-transparent bg-ink/[0.05] text-ink' : 'border-line/10 text-ink3')}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? color : 'transparent', boxShadow: `inset 0 0 0 2px ${color}` }} />
      {children}
    </button>
  );
}
