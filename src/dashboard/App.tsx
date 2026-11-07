import { Bell, Building2, CalendarDays, CheckSquare, ChevronDown, LayoutGrid, Layers, ListTodo, Plus, Search, Settings as SettingsIcon, Zap } from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActivityModal } from '../components/Activity';
import { AssetDetail } from '../components/AssetDetail';
import { AssetForm } from '../components/AssetForm';
import { CommandPalette, type PaletteMode } from '../components/CommandPalette';
import { ProviderForm, RenewDialog, UnlockDialog } from '../components/Dialogs';
import { go, isTypingTarget, matchShortcut, shortcutLabel, useApplyLocale, useApplyTheme, useHashRoute } from '../components/hooks';
import { CategoryIcon } from '../components/icons';
import { Ico } from '../components/Iconly';
import { TaskForm } from '../components/TaskForm';
import { Button, ConfirmProvider, ContextMenuProvider, Countdown, Dropdown, EmptyState, Highlight, IconButton, Kbd, Segmented, Skeleton, ToastProvider } from '../components/ui';
import { UICtx, type UIApi } from '../components/ui-context';
import { isUnlocked } from '../lib/crypto';
import { localizeDB } from '../lib/defaults';
import { formatRelativeTime } from '../lib/dates';
import { stats } from '../lib/logic';
import { search, type SearchKind } from '../lib/search';
import { mutateNotify, useDB, useLoadError, useNotify, useToday } from '../lib/store';
import type { Asset, DB, Task } from '../lib/types';
import { clsx } from '../lib/util';
import { AssetsPage } from './pages/Assets';
import { CalendarPage } from './pages/Calendar';
import { OverviewPage } from './pages/Overview';
import { ProvidersPage } from './pages/Providers';
import { QuickAccessPage } from './pages/QuickAccess';
import { SettingsPage } from './pages/Settings';
import { TasksPage } from './pages/Tasks';

import { t as tr } from '../lib/i18n';
const NAV = [
  { id: 'overview', label: 'Overview', ico: 'overview' },
  { id: 'assets', label: 'Assets', ico: 'assets' },
  { id: 'tasks', label: 'Tasks', ico: 'tasks' },
  { id: 'calendar', label: 'Calendar', ico: 'calendar' },
  { id: 'providers', label: 'Providers', ico: 'providers' },
  { id: 'quick', label: 'Quick Access', ico: 'quick' },
  { id: 'settings', label: 'Settings', ico: 'settings' },
] as const;

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ContextMenuProvider>
          <Shell />
        </ContextMenuProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function Shell() {
  const rawDb = useDB();
  const loadError = useLoadError();
  const today = useToday();
  const { route, params } = useHashRoute();
  useApplyTheme(rawDb?.settings.theme);
  useApplyLocale(rawDb?.settings.language, rawDb?.settings.calendar);
  const db = useMemo(() => rawDb && localizeDB(rawDb), [rawDb, rawDb?.settings.language]);

  const [assetDetail, setAssetDetail] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState<{ id?: string; defaults?: Partial<Asset> } | null>(null);
  const [renew, setRenew] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<{ id?: string; defaults?: Partial<Task> } | null>(null);
  const [providerForm, setProviderForm] = useState<{ id?: string; onCreated?: (id: string) => void } | null>(null);
  const [palette, setPalette] = useState<PaletteMode | null>(null);
  const [activity, setActivity] = useState(false);
  const [unlockReq, setUnlockReq] = useState<((ok: boolean) => void) | null>(null);

  const api = useMemo<UIApi>(
    () => ({
      openAsset: (id) => setAssetDetail(id),
      editAsset: (id, defaults) => setAssetForm({ id, defaults }),
      renewAsset: (id) => setRenew(id),
      openTask: (id) => setTaskForm({ id }),
      editTask: (id, defaults) => setTaskForm({ id, defaults }),
      editProvider: (id, onCreated) => setProviderForm({ id, onCreated }),
      openProvider: (id) => {
        setAssetDetail(null);
        go('providers', { id });
      },
      openPalette: (mode = 'all') => setPalette(mode),
      openActivity: () => setActivity(true),
      requestUnlock: () => (isUnlocked() ? Promise.resolve(true) : new Promise<boolean>((res) => setUnlockReq(() => res))),
    }),
    [],
  );

  // deep links from notifications: #/assets?open=<id>
  useEffect(() => {
    const open = params.get('open');
    if (!open || !db) return;
    if (route === 'assets') setAssetDetail(open);
    if (route === 'tasks') setTaskForm({ id: open });
    const p = new URLSearchParams(params);
    p.delete('open');
    history.replaceState(null, '', `#/${route}${p.toString() ? '?' + p : ''}`);
  }, [route, params, !!db]); // eslint-disable-line react-hooks/exhaustive-deps

  // global shortcuts
  useEffect(() => {
    if (!db) return;
    const fn = (e: KeyboardEvent) => {
      if (matchShortcut(e, db.settings.paletteShortcut)) {
        e.preventDefault();
        setPalette((p) => (p ? null : 'all'));
        return;
      }
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      } else if (e.key === 'n') {
        e.preventDefault();
        setAssetForm({});
      } else if (e.key === 't') {
        e.preventDefault();
        setTaskForm({});
      } else if (/^[1-7]$/.test(e.key)) go(NAV[Number(e.key) - 1].id);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [db?.settings.paletteShortcut, !!db]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = `NEXUS · ${tr(NAV.find((n) => n.id === route)?.label || tr("Overview"))}`;
  }, [route]);

  if (loadError) return <div className="flex h-screen items-center justify-center text-sm text-crit">{tr("Could not load data:")} {loadError}</div>;
  if (!db) return <LoadingSkeleton />;

  const page = (() => {
    switch (route) {
      case 'assets':
        return <AssetsPage db={db} today={today} params={params} />;
      case 'tasks':
        return <TasksPage db={db} today={today} params={params} />;
      case 'calendar':
        return <CalendarPage db={db} today={today} />;
      case 'providers':
        return <ProvidersPage db={db} today={today} params={params} />;
      case 'quick':
        return <QuickAccessPage db={db} today={today} />;
      case 'settings':
        return <SettingsPage db={db} params={params} />;
      default:
        return <OverviewPage db={db} today={today} />;
    }
  })();

  return (
    <UICtx.Provider value={api}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar db={db} route={route} today={today} activeCategory={route === 'assets' ? params.get('category') : null} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar db={db} today={today} route={route} />
          <main className="min-h-0 flex-1 overflow-y-auto">{page}</main>
        </div>
      </div>
      {assetDetail && <AssetDetail db={db} assetId={assetDetail} today={today} onClose={() => setAssetDetail(null)} />}
      {assetForm && <AssetForm db={db} assetId={assetForm.id} defaults={assetForm.defaults} onClose={() => setAssetForm(null)} />}
      {renew && <RenewDialog db={db} assetId={renew} onClose={() => setRenew(null)} />}
      {taskForm && <TaskForm key={taskForm.id || 'new'} db={db} taskId={taskForm.id} defaults={taskForm.defaults} onClose={() => setTaskForm(null)} />}
      {providerForm && <ProviderForm db={db} providerId={providerForm.id} onCreated={providerForm.onCreated} onClose={() => setProviderForm(null)} />}
      {palette && <CommandPalette db={db} today={today} mode={palette} onClose={() => setPalette(null)} />}
      {activity && <ActivityModal db={db} onClose={() => setActivity(false)} />}
      {unlockReq && (
        <UnlockDialog
          db={db}
          onDone={(ok) => {
            unlockReq(ok);
            setUnlockReq(null);
          }}
        />
      )}
    </UICtx.Provider>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-[216px] space-y-2 border-e bg-surface2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
      <div className="flex-1 space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function Sidebar({ db, route, today, activeCategory }: { db: DB; route: string; today: string; activeCategory: string | null }) {
  const s = stats(db, today);
  const counts: Record<string, number | undefined> = {
    assets: db.assets.length || undefined,
    tasks: s.activeTasks || undefined,
    quick: db.assets.filter((a) => a.pinned).length + db.tasks.filter((t) => t.pinned).length || undefined,
    providers: db.providers.length || undefined,
  };
  const catCounts = new Map<string, number>();
  for (const a of db.assets) catCounts.set(a.categoryId, (catCounts.get(a.categoryId) || 0) + 1);
  const cats = useMemo(() => db.categories.filter((c) => catCounts.get(c.id)), [db.categories, db.assets]); // eslint-disable-line react-hooks/exhaustive-deps
  const alerts = s.critical + s.expired;
  const name = db.settings.userName.trim();
  return (
    <aside className="flex w-[256px] shrink-0 flex-col border-e bg-surface dark:bg-[#1a1a1c]">
      {/* brand */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-accent to-[#5856D6] text-[15px] font-extrabold text-white shadow-[0_6px_16px_-6px_rgb(var(--accent)/0.7)]">N</div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">NEXUS</div>
          <div className="text-2xs text-ink2">{tr('Personal Control Center')}</div>
        </div>
      </div>

      <nav className="mt-2 space-y-1 px-3">
        {NAV.map((n, i) => {
          const active = route === n.id && !(n.id === 'assets' && activeCategory);
          return (
            <a
              key={n.id}
              href={`#/${n.id}`}
              title={`${tr(n.label)} (${i + 1})`}
              className={clsx(
                'group flex h-11 items-center gap-3 rounded-[12px] px-3 text-sm font-medium transition-all',
                active ? 'bg-accent/[0.09] text-accent dark:bg-accent/[0.16]' : 'text-ink/75 hover:bg-ink/[0.04] hover:text-ink',
              )}
            >
              <Ico name={n.ico} set={active ? 'bulk' : 'light'} size={22} className={active ? 'text-accent' : 'text-ink2 group-hover:text-ink'} />
              <span className="flex-1">{tr(n.label)}</span>
              {n.id === 'overview' && alerts > 0 ? (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-crit px-1.5 text-[11px] font-bold text-white tabular">{alerts}</span>
              ) : (
                counts[n.id] !== undefined && (
                  <span className={clsx('flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular', active ? 'bg-accent/15 text-accent' : 'bg-ink/[0.05] text-ink2')}>{counts[n.id]}</span>
                )
              )}
            </a>
          );
        })}
      </nav>

      {cats.length > 0 && (
        <>
          <div className="mx-5 mt-6 mb-2 flex items-center gap-2">
            <span className="section-title">{tr('Categories')}</span>
            <span className="h-px flex-1 bg-line/[0.06]" />
          </div>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3">
            {cats.map((c) => (
              <a
                key={c.id}
                href={`#/assets?category=${c.id}`}
                className={clsx('flex h-9 items-center gap-2.5 rounded-[10px] px-3 text-sm', activeCategory === c.id ? 'bg-ink/[0.06] font-semibold dark:bg-white/[0.08]' : 'text-ink/75 hover:bg-ink/[0.04] hover:text-ink')}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-ink2 tabular">{catCounts.get(c.id)}</span>
              </a>
            ))}
          </div>
        </>
      )}

      <div className="mt-auto space-y-2 p-3">
        <PaletteHint shortcut={db.settings.paletteShortcut} />
        <a href="#/settings?section=general" className="flex items-center gap-3 rounded-[12px] bg-bg/70 p-2.5 transition-colors hover:bg-ink/[0.05] dark:bg-white/[0.04]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FF9500] to-[#FF2D55] text-sm font-bold text-white">{(name || 'N').slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{name || tr('Your workspace')}</span>
            <span className="block truncate text-2xs text-ink2">{tr('{n} assets · {p} providers', { n: db.assets.length, p: db.providers.length })}</span>
          </span>
          <Ico name="settings" size={18} className="text-ink2" />
        </a>
      </div>
    </aside>
  );
}

function PaletteHint({ shortcut }: { shortcut: string }) {
  const ctx = useMemo(() => shortcutLabel(shortcut), [shortcut]);
  return (
    <UICtx.Consumer>
      {(ui) => (
        <button onClick={() => ui.openPalette()} className="flex h-10 w-full items-center gap-2.5 rounded-[12px] border border-dashed border-line/10 px-3 text-sm text-ink2 transition-colors hover:border-accent/40 hover:text-ink">
          <Ico name="search" size={18} />
          <span className="flex-1 text-start">{tr('Command palette')}</span>
          <span className="flex gap-0.5" dir="ltr">
            {ctx.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        </button>
      )}
    </UICtx.Consumer>
  );
}

function TopBar({ db, today }: { db: DB; today: string; route: string }) {
  return (
    <UICtx.Consumer>
      {(ui) => (
        <header className="glass sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b px-8">
          <div className="w-full max-w-[520px]">
            <GlobalSearch db={db} today={today} />
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            <NotificationCenter db={db} today={today} />
            <IconButton label={tr('Settings')} onClick={() => go('settings')}>
              <Ico name="settings" size={20} />
            </IconButton>
            <span className="mx-1.5 h-6 w-px bg-line/10" />
            <Dropdown
              trigger={(open) => (
                <Button variant="primary" icon={<Ico name="plus" set="bold" size={18} />} onClick={open}>
                  {tr('New')} <ChevronDown size={14} className="-me-1 opacity-80" />
                </Button>
              )}
              items={[
                { label: tr('Asset'), icon: <Layers size={13} />, shortcut: 'N', onClick: () => ui.editAsset() },
                { label: tr('Task'), icon: <CheckSquare size={13} />, shortcut: 'T', onClick: () => ui.editTask() },
                { label: tr('Provider'), icon: <Building2 size={13} />, onClick: () => ui.editProvider() },
              ]}
            />
          </div>
        </header>
      )}
    </UICtx.Consumer>
  );
}

function GlobalSearch({ db, today }: { db: DB; today: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'all' | SearchKind>('all');
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const ui = useUIFromCtx();
  const hits = useMemo(() => search(db, q, 40).filter((h) => kind === 'all' || h.kind === kind), [db, q, kind]);
  const cats = new Map(db.categories.map((c) => [c.id, c]));
  useEffect(() => setIdx(0), [q, kind]);
  useEffect(() => {
    const fn = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const choose = (i: number) => {
    const h = hits[i];
    if (!h) return;
    setOpen(false);
    (document.activeElement as HTMLElement)?.blur();
    if (h.kind === 'asset') ui.openAsset(h.id);
    else if (h.kind === 'task') ui.openTask(h.id);
    else if (h.kind === 'provider') ui.openProvider(h.id);
    else go('assets', { category: h.id });
  };
  return (
    <div ref={ref} className="relative">
      <Ico name="search" size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink2" />
      <input
        id="global-search"
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setIdx((i) => Math.min(hits.length - 1, i + 1)));
          else if (e.key === 'ArrowUp') (e.preventDefault(), setIdx((i) => Math.max(0, i - 1)));
          else if (e.key === 'Enter') choose(idx);
          else if (e.key === 'Escape') (setOpen(false), (e.target as HTMLInputElement).blur());
        }}
        placeholder={tr("Search everything…")}
        className="input h-10 rounded-[12px] bg-ink/[0.045] ps-11 shadow-none dark:bg-white/[0.06]"
      />
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">
        <Kbd>/</Kbd>
      </span>
      {open && q.trim() && (
        <div className="absolute start-0 end-0 top-[46px] z-30 overflow-hidden rounded-[10px] border bg-surface shadow-pop animate-in">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Segmented
              size="sm"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: tr("All") },
                { value: 'asset', label: tr("Assets") },
                { value: 'task', label: tr("Tasks") },
                { value: 'provider', label: tr("Providers") },
                { value: 'category', label: tr("Categories") },
              ]}
            />
            <span className="ms-auto text-xs text-ink2">{hits.length} {tr("results")}</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-1">
            {hits.length === 0 && <div className="py-6 text-center text-sm text-ink2">{tr("No matches")}</div>}
            {hits.map((h, i) => (
              <button key={h.kind + h.id} onMouseMove={() => setIdx(i)} onClick={() => choose(i)} className={clsx('flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-start', i === idx && 'bg-accent/10')}>
                {h.kind === 'asset' || h.kind === 'category' ? (
                  <CategoryIcon category={cats.get(h.kind === 'asset' ? h.asset!.categoryId : h.id)} size={11} />
                ) : h.kind === 'task' ? (
                  <CheckSquare size={15} className="mx-[3px] text-ink2" />
                ) : (
                  <Building2 size={15} className="mx-[3px] text-ink2" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <Highlight text={h.title} query={q} />
                  </span>
                  <span className="block truncate text-xs text-ink2">
                    {h.matchField && !['Name', 'Title'].includes(h.matchField) && h.matchText ? (
                      <>
                        {h.matchField}: <Highlight text={h.matchText} query={q} />
                      </>
                    ) : (
                      h.subtitle
                    )}
                  </span>
                </span>
                {h.asset?.expirationDate && <Countdown date={h.asset.expirationDate} today={today} short />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const useUIFromCtx = () => useContext(UICtx);

function NotificationCenter({ db, today }: { db: DB; today: string }) {
  const n = useNotify();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const ui = useUIFromCtx();
  const unread = n.log.filter((x) => !x.read).length;
  const markRead = useCallback(() => mutateNotify((s) => s.log.forEach((x) => (x.read = true))), []);
  const r = btn.current?.getBoundingClientRect();
  return (
    <>
      <button ref={btn} onClick={() => setOpen(!open)} className="relative inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-ink2 hov hover:text-ink" aria-label={tr("Notifications")} title={tr("Notifications")}>
        <Bell size={16} />
        {unread > 0 && <span className="absolute end-0.5 top-0.5 min-w-[14px] rounded-full bg-crit px-1 text-[9px] font-bold leading-[14px] text-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open &&
        r &&
        createPortal(
          <div className="fixed inset-0 z-[65]" onMouseDown={() => (setOpen(false), unread && markRead())}>
            <div className="fixed w-[360px] overflow-hidden rounded-[12px] border bg-surface shadow-pop animate-in" style={{ top: r.bottom + 6, right: window.innerWidth - r.right }} onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex h-10 items-center border-b px-3">
                <span className="flex-1 text-sm font-semibold">{tr("Notifications")}</span>
                {n.log.length > 0 && (
                  <>
                    <Button size="sm" variant="ghost" onClick={markRead}>
                      {tr("Mark read")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => mutateNotify((s) => (s.log = []))}>
                      {tr("Clear")}
                    </Button>
                  </>
                )}
              </div>
              <div className="max-h-[420px] overflow-y-auto p-1">
                {n.log.length === 0 ? (
                  <EmptyState compact icon={<Bell size={18} />} title={tr("No notifications yet")} body={tr("Expiration and task reminders will appear here.")} />
                ) : (
                  n.log.slice(0, 80).map((e) => {
                    const asset = e.kind === 'expiration' ? db.assets.find((a) => a.id === e.itemId) : undefined;
                    return (
                      <button
                        key={e.id}
                        onClick={() => {
                          setOpen(false);
                          if (e.kind === 'expiration' && e.itemId) ui.openAsset(e.itemId);
                          else if (e.kind === 'task' && e.itemId) ui.openTask(e.itemId);
                        }}
                        className="flex w-full gap-2.5 rounded-[8px] px-2.5 py-2 text-start hov"
                      >
                        <span className={clsx('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', e.read ? 'bg-transparent' : 'bg-accent')} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="flex-1 truncate text-sm font-medium">{e.title}</span>
                            <span className="text-2xs text-ink2">{formatRelativeTime(e.at)}</span>
                          </span>
                          <span className="block truncate text-xs text-ink2">{e.message}</span>
                          {asset?.expirationDate && <Countdown date={asset.expirationDate} today={today} className="mt-1" />}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
