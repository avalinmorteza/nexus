import { ArrowLeft, CheckSquare, Copy, ExternalLink, Globe, Layers, ListTodo, Maximize2, Plus, Search, Zap } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { assetDomain, assetWebsite } from '../components/assetActions';
import { DateInput } from '../components/DateInput';
import { useApplyLocale, useApplyTheme } from '../components/hooks';
import { CategoryIcon } from '../components/icons';
import { Button, Checkbox, Countdown, EmptyState, Field, Highlight, IconButton, Input, Segmented, Select, Skeleton, ToastProvider, useToast } from '../components/ui';
import { createAsset, createTask, toggleTask } from '../lib/actions';
import { localizeDB } from '../lib/defaults';
import { daysUntil, expiryStatus } from '../lib/dates';
import { filterTasks, pinnedKeys, sortTasks, stats } from '../lib/logic';
import { search } from '../lib/search';
import { useDB, useToday } from '../lib/store';
import type { DB } from '../lib/types';
import { clsx, copyText, isSafeHttpUrl, normalizeUrl } from '../lib/util';

import { t as tr } from '../lib/i18n';
const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

/** Reuses an already-open dashboard tab (handled by the service worker) instead of opening duplicates. */
function openDashboard(hash = '') {
  if (!hasChrome) {
    window.open('dashboard.html' + hash, '_blank');
    return;
  }
  chrome.runtime.sendMessage({ type: 'nexus:open-dashboard', hash }, () => {
    if (chrome.runtime.lastError) chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') + hash });
    window.close();
  });
}

export function Popup() {
  return (
    <ToastProvider>
      <PopupInner />
    </ToastProvider>
  );
}

function PopupInner() {
  const rawDb = useDB();
  const today = useToday();
  useApplyTheme(rawDb?.settings.theme);
  useApplyLocale(rawDb?.settings.language, rawDb?.settings.calendar);
  const db = useMemo(() => rawDb && localizeDB(rawDb), [rawDb, rawDb?.settings.language]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState<null | 'task' | 'asset'>(null);

  if (!db)
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-8" />
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-surface px-3">
        {adding ? (
          <IconButton label={tr("Back")} onClick={() => setAdding(null)}>
            <ArrowLeft size={15} className="rtl:rotate-180" />
          </IconButton>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-accent to-[#5856D6] text-[11px] font-bold text-white">N</div>
        )}
        <span className="flex-1 text-[13.5px] font-semibold">{adding ? (adding === 'task' ? tr("Quick task") : tr("Quick asset")) : 'NEXUS'}</span>
        {!adding && (
          <>
            <IconButton label={tr("Quick add task")} onClick={() => setAdding('task')}>
              <Plus size={15} />
            </IconButton>
            <IconButton label={tr("Open full dashboard")} onClick={() => openDashboard()}>
              <Maximize2 size={14} />
            </IconButton>
          </>
        )}
      </header>
      {adding ? <QuickAdd db={db} kind={adding} setKind={setAdding} today={today} /> : <Home db={db} today={today} q={q} setQ={setQ} />}
    </div>
  );
}

function Home({ db, today, q, setQ }: { db: DB; today: string; q: string; setQ: (s: string) => void }) {
  const toast = useToast();
  const s = stats(db, today);
  const cats = new Map(db.categories.map((c) => [c.id, c]));
  const hits = useMemo(() => (q.trim() ? search(db, q, 12) : []), [db, q]);
  const attention = db.assets
    .filter((a) => a.status === 'active' && a.expirationDate && ['critical', 'expired', 'warning'].includes(expiryStatus(a.expirationDate, today)) && daysUntil(a.expirationDate, today) >= -30)
    .sort((a, b) => a.expirationDate!.localeCompare(b.expirationDate!))
    .slice(0, 6);
  const todays = sortTasks(filterTasks(db.tasks, 'today', today)).slice(0, 6);
  const pins = pinnedKeys(db)
    .filter((k) => k.startsWith('asset:'))
    .map((k) => db.assets.find((a) => a.id === k.slice(6)))
    .filter(Boolean)
    .slice(0, 6) as DB['assets'];

  const copy = async (t: string, what: string) => (t && (await copyText(t)) ? toast(tr('Copied {what}', { what: tr(what) }), 'success') : toast(tr('No {what} to copy', { what: tr(what) }), 'error'));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="p-3 pb-2">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-ink2" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search assets, tasks, providers…")} className="h-8 ps-8" />
        </div>
      </div>
      {q.trim() ? (
        <div className="px-2">
          {hits.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink2">{tr("No results")}</div>
          ) : (
            hits.map((h) => (
              <button
                key={h.kind + h.id}
                onClick={() => openDashboard(h.kind === 'asset' ? `#/assets?open=${h.id}` : h.kind === 'task' ? `#/tasks?open=${h.id}` : h.kind === 'provider' ? `#/providers?id=${h.id}` : `#/assets?category=${h.id}`)}
                className="flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-start hov"
              >
                {h.kind === 'asset' ? <CategoryIcon category={cats.get(h.asset!.categoryId)} size={10} /> : h.kind === 'task' ? <CheckSquare size={14} className="mx-[2px] text-ink2" /> : <Layers size={14} className="mx-[2px] text-ink2" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <Highlight text={h.title} query={q} />
                  </span>
                  <span className="block truncate text-2xs text-ink2">{h.subtitle}</span>
                </span>
                {h.asset?.expirationDate && <Countdown date={h.asset.expirationDate} today={today} short />}
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 px-3">
            {[
              { l: 'Expiring', v: s.expiring, c: 'text-warn-ink', h: '#/assets?filter=30' },
              { l: 'Critical', v: s.critical, c: 'text-crit', h: '#/assets?filter=critical' },
              { l: 'Expired', v: s.expired, c: 'text-expired', h: '#/assets?filter=expired' },
            ].map((x) => (
              <button key={x.l} onClick={() => openDashboard(x.h)} className="card px-2.5 py-1.5 text-start hov">
                <div className={clsx('text-[17px] font-semibold tabular', x.v > 0 ? x.c : 'text-ink')}>{x.v}</div>
                <div className="text-2xs text-ink2">{tr(x.l)}</div>
              </button>
            ))}
          </div>

          <PopupSection title={tr("Needs attention")} action={() => openDashboard('#/assets?filter=30')}>
            {attention.length === 0 ? (
              <div className="px-3 py-3 text-xs text-ink2">{tr("Nothing expiring in the next 30 days 🎉")}</div>
            ) : (
              attention.map((a) => (
                <button key={a.id} onClick={() => openDashboard(`#/assets?open=${a.id}`)} className="flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-start hov">
                  <CategoryIcon category={cats.get(a.categoryId)} size={10} />
                  <span className="flex-1 truncate text-sm">{a.name}</span>
                  <Countdown date={a.expirationDate} today={today} />
                </button>
              ))
            )}
          </PopupSection>

          <PopupSection title={`${tr('Today')} · ${todays.length}`} action={() => openDashboard('#/tasks?section=today')}>
            {todays.length === 0 ? (
              <div className="px-3 py-3 text-xs text-ink2">{tr("No tasks due today")}</div>
            ) : (
              todays.map((t) => (
                <div key={t.id} className="flex h-8 items-center gap-2 rounded-[6px] px-2 hov">
                  <Checkbox round checked={t.done} onChange={() => toggleTask(t.id)} />
                  <button className={clsx('flex-1 truncate text-start text-sm', t.done && 'text-ink2 line-through')} onClick={() => openDashboard(`#/tasks?open=${t.id}`)}>
                    {t.title}
                  </button>
                  {t.dueDate && daysUntil(t.dueDate, today) < 0 && <span className="text-2xs font-medium text-crit">{tr("Overdue")}</span>}
                </div>
              ))
            )}
          </PopupSection>

          <PopupSection title={tr("Quick Access")} action={() => openDashboard('#/quick')}>
            {pins.length === 0 ? (
              <div className="px-3 py-3 text-xs text-ink2">{tr("Pin assets in the dashboard to see them here")}</div>
            ) : (
              pins.map((a) => (
                <div key={a.id} className="group flex h-8 items-center gap-2 rounded-[6px] px-2 hov">
                  <CategoryIcon category={cats.get(a.categoryId)} size={10} />
                  <button className="flex-1 truncate text-start text-sm" onClick={() => openDashboard(`#/assets?open=${a.id}`)}>
                    {a.name}
                  </button>
                  <span className="flex opacity-0 group-hover:opacity-100">
                    <IconButton label={tr("Open website")} className="h-6 w-6" disabled={!isSafeHttpUrl(assetWebsite(a))} onClick={() => hasChrome && chrome.tabs.create({ url: normalizeUrl(assetWebsite(a)) })}>
                      <Globe size={12} />
                    </IconButton>
                    <IconButton label={tr("Copy domain")} className="h-6 w-6" onClick={() => copy(assetDomain(a), 'domain')}>
                      <Copy size={12} />
                    </IconButton>
                  </span>
                </div>
              ))
            )}
          </PopupSection>
          <div className="h-2" />
        </>
      )}
    </div>
  );
}

function PopupSection({ title, action, children }: { title: string; action: () => void; children: React.ReactNode }) {
  return (
    <section className="mx-3 mt-2.5">
      <div className="mb-1 flex items-center px-1">
        <span className="flex-1 section-title">{title}</span>
        <button onClick={action} className="flex items-center gap-0.5 text-2xs text-accent hover:underline">
          {tr("Open")} <ExternalLink size={9} />
        </button>
      </div>
      <div className="card p-1">{children}</div>
    </section>
  );
}

function QuickAdd({ db, kind, setKind, today }: { db: DB; kind: 'task' | 'asset'; setKind: (k: 'task' | 'asset' | null) => void; today: string }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(kind === 'task' ? today : '');
  const [categoryId, setCategoryId] = useState(db.categories[0]?.id || '');
  const [assetId, setAssetId] = useState('');
  const [err, setErr] = useState('');
  const save = async () => {
    if (!title.trim()) return setErr(kind === 'task' ? tr("Title is required") : tr("Name is required"));
    if (kind === 'task') {
      await createTask({ title: title.trim(), description: '', dueDate: date || undefined, priority: 'medium', tags: [], recurrence: 'none', subtasks: [], assetId: assetId || undefined });
      toast(tr("Task added"), 'success');
    } else {
      await createAsset({
        name: title.trim(),
        categoryId,
        purchaseUrl: '',
        currency: db.settings.currency,
        expirationDate: date || undefined,
        loginUrl: '',
        username: '',
        notes: '',
        tags: [],
        status: 'active',
        custom: {},
        attachments: [],
        notificationsEnabled: true,
        reminderDays: null,
      });
      toast(tr("Asset added"), 'success');
    }
    setTitle('');
    setErr('');
    setTimeout(() => setKind(null), 500);
  };
  return (
    <div className="space-y-3 p-3" onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && (e.target as HTMLElement).tagName === 'INPUT' && save()}>
      <Segmented
        value={kind}
        onChange={(k) => (setKind(k), setDate(k === 'task' ? today : ''))}
        options={[
          { value: 'task', label: <><ListTodo size={12} /> {tr("Task")}</> },
          { value: 'asset', label: <><Zap size={12} /> {tr("Asset")}</> },
        ]}
      />
      <Field label={kind === 'task' ? tr("Title") : tr("Name")} hint={err && <span className="text-crit">{err}</span>}>
        <Input autoFocus value={title} onChange={(e) => (setTitle(e.target.value), setErr(''))} placeholder={kind === 'task' ? tr("Renew SSL certificate") : 'example.com'} />
      </Field>
      {kind === 'asset' && (
        <Field label={tr("Category")}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={kind === 'task' ? tr("Due date") : tr("Expiration date")}>
        <DateInput value={date} onChange={setDate} />
      </Field>
      {kind === 'task' && db.assets.length > 0 && (
        <Field label={tr("Linked asset")}>
          <Select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">{tr("None")}</option>
            {db.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="primary" className="flex-1" onClick={save}>
          {tr(kind === 'task' ? tr("Add task") : tr("Add asset"))}
        </Button>
        <Button onClick={() => openDashboard(kind === 'task' ? '#/tasks' : '#/assets')}>{tr("More options")}</Button>
      </div>
      {db.assets.length === 0 && kind === 'task' && <EmptyState compact icon={<Layers size={16} />} title={tr("Tip")} body={tr("Add assets in the dashboard to link tasks to them.")} />}
    </div>
  );
}
