import { ArrowDown, ArrowUp, Check, CopyPlus, Filter, LayoutGrid, List, MoreHorizontal, Pin, Plus, Rows3, Rows4, Search, Table2, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAssetActions } from '../../components/assetActions';
import { go, usePersistentState } from '../../components/hooks';
import { CategoryIcon } from '../../components/icons';
import { Badge, Button, Checkbox, Countdown, Dropdown, EmptyState, Field, IconButton, Input, Modal, Segmented, Select, STATUS_STYLE, useConfirm, useContextMenu, useToast } from '../../components/ui';
import { useUI } from '../../components/ui-context';
import { PageHeader } from '../../components/Page';
import { bulkUpdateAssets, deleteAssets, duplicateAsset, togglePin, updateSettings } from '../../lib/actions';
import { daysUntil, expiryStatus, formatDate } from '../../lib/dates';
import { matchExpiryFilter, type ExpiryFilter } from '../../lib/logic';
import type { Asset, AssetView, DB } from '../../lib/types';
import { clsx, money, parseTags } from '../../lib/util';

import { t as tr } from '../../lib/i18n';
type SortKey = 'name' | 'category' | 'provider' | 'purchaseDate' | 'expirationDate' | 'remaining' | 'price' | 'status';

const FILTERS: { value: ExpiryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'normal', label: 'Normal' },
  { value: '30', label: '≤ 30 days' },
  { value: '7', label: '≤ 7 days' },
  { value: 'critical', label: 'Critical' },
  { value: 'expired', label: 'Expired' },
  { value: 'none', label: 'No date' },
];

const STATUS_RANK = { expired: 0, critical: 1, warning: 2, normal: 3, none: 4 } as const;

export function AssetsPage({ db, today, params }: { db: DB; today: string; params: URLSearchParams }) {
  const ui = useUI();
  const toast = useToast();
  const confirm = useConfirm();
  const ctx = useContextMenu();
  const { items: menuItems } = useAssetActions(db);
  const [q, setQ] = useState('');
  const filter = (params.get('filter') as ExpiryFilter) || 'all';
  const category = params.get('category') || '';
  const provider = params.get('provider') || '';
  const [tag, setTag] = useState('');
  const [statusF, setStatusF] = useState<'' | Asset['status']>('');
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = usePersistentState<{ key: SortKey; dir: 1 | -1 }>('assets.sort', { key: 'remaining', dir: 1 });
  const view = db.settings.defaultView;
  const density = db.settings.density;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [last, setLast] = useState<number | null>(null);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v && v !== 'all') p.set(k, v);
    else p.delete(k);
    go('assets', Object.fromEntries(p.entries()));
  };

  const cats = useMemo(() => new Map(db.categories.map((c) => [c.id, c])), [db.categories]);
  const provs = useMemo(() => new Map(db.providers.map((p) => [p.id, p])), [db.providers]);
  const allTags = useMemo(() => Array.from(new Set(db.assets.flatMap((a) => a.tags))).sort(), [db.assets]);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let l = db.assets.filter((a) => matchExpiryFilter(a, filter, today));
    if (category) l = l.filter((a) => a.categoryId === category);
    if (provider) l = l.filter((a) => a.providerId === provider);
    if (tag) l = l.filter((a) => a.tags.includes(tag));
    if (statusF) l = l.filter((a) => a.status === statusF);
    if (ql)
      l = l.filter((a) => {
        // password-type custom fields are never searchable
        const secretIds = new Set((cats.get(a.categoryId)?.fields || []).filter((f) => f.type === 'password').map((f) => f.id));
        const customText = Object.entries(a.custom)
          .filter(([k, v]) => !secretIds.has(k) && (typeof v === 'string' || typeof v === 'number'))
          .map(([, v]) => v);
        const hay = [a.name, a.notes, a.username, a.loginUrl, a.purchaseUrl, a.tags.join(' '), cats.get(a.categoryId)?.name, a.providerId && provs.get(a.providerId)?.name, ...customText].join(' ').toLowerCase();
        return hay.includes(ql);
      });
    const val = (a: Asset): string | number => {
      switch (sort.key) {
        case 'name':
          return a.name.toLowerCase();
        case 'category':
          return cats.get(a.categoryId)?.name || '';
        case 'provider':
          return (a.providerId && provs.get(a.providerId)?.name) || '~';
        case 'purchaseDate':
          return a.purchaseDate || '9999';
        case 'expirationDate':
          return a.expirationDate || '9999';
        case 'remaining':
          return a.expirationDate ? daysUntil(a.expirationDate, today) : 1e9;
        case 'price':
          return a.renewalPrice ?? a.purchasePrice ?? -1;
        case 'status':
          return STATUS_RANK[expiryStatus(a.expirationDate, today)];
      }
    };
    return l.slice().sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [db.assets, q, filter, category, provider, tag, statusF, sort, today, cats, provs]);

  useEffect(() => setSel(new Set()), [filter, category, provider]);
  const selected = list.filter((a) => sel.has(a.id));
  const toggleSel = (id: string, i: number, shift: boolean) => {
    const n = new Set(sel);
    if (shift && last !== null) {
      const [a, b] = [Math.min(last, i), Math.max(last, i)];
      for (let k = a; k <= b; k++) n.add(list[k].id);
    } else n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
    setLast(i);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f.value] = db.assets.filter((a) => matchExpiryFilter(a, f.value, today) && (!category || a.categoryId === category)).length;
    return c;
  }, [db.assets, today, category]);

  const header = (key: SortKey, label: string, cls = '') => (
    <th className={clsx('select-none whitespace-nowrap px-3 text-start text-xs font-semibold', cls)}>
      <button className={clsx('inline-flex items-center gap-1 transition-colors hover:text-ink', sort.key === key ? 'text-ink' : 'text-ink2')} onClick={() => setSort({ key, dir: sort.key === key ? ((-sort.dir) as 1 | -1) : 1 })}>
        {tr(label)}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  const activeCat = category ? cats.get(category) : undefined;
  const rowH = density === 'compact' ? 'h-[52px]' : 'h-[64px]';
  const filtersActive = !!(tag || statusF || provider);
  const attention = db.assets.filter((a) => a.status === 'active' && ['critical', 'expired', 'warning'].includes(expiryStatus(a.expirationDate, today))).length;

  return (
    <div className="page">
      <PageHeader
        icon="assets"
        tone="accent"
        title={activeCat ? activeCat.name : tr('Assets')}
        subtitle={tr('{n} assets · {p} providers · {a} need attention', { n: db.assets.length, p: db.providers.length, a: attention })}
        actions={
          <>
            <Segmented<AssetView>
              value={view}
              onChange={(v) => updateSettings({ defaultView: v })}
              options={[
                { value: 'table', label: <Table2 size={15} />, title: tr('Table view') },
                { value: 'list', label: <List size={15} />, title: tr('List view') },
                { value: 'grid', label: <LayoutGrid size={15} />, title: tr('Grid view') },
              ]}
            />
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => ui.editAsset(undefined, category ? { categoryId: category, providerId: provider || undefined } : provider ? { providerId: provider } : undefined)}>
              {tr('Add asset')}
            </Button>
          </>
        }
      />

      <div className="card overflow-hidden">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3.5">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const on = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setParam('filter', f.value)}
                  className={clsx(
                    'flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-sm font-medium transition-all',
                    on ? 'bg-ink text-surface shadow-sm dark:bg-white dark:text-black' : 'bg-ink/[0.04] text-ink/75 hover:bg-ink/[0.07] hover:text-ink',
                  )}
                >
                  {f.value === 'critical' && <span className="h-2 w-2 rounded-full bg-crit" />}
                  {f.value === '30' && <span className="h-2 w-2 rounded-full bg-warn" />}
                  {f.value === 'expired' && <span className="h-2 w-2 rounded-full bg-expired" />}
                  {f.value === 'normal' && <span className="h-2 w-2 rounded-full bg-ok" />}
                  {tr(f.label)}
                  <span className={clsx('rounded-full px-1.5 text-[11px] font-semibold tabular', on ? 'bg-white/20' : 'bg-ink/[0.06] text-ink2')}>{counts[f.value]}</span>
                </button>
              );
            })}
          </div>
          <div className="ms-auto flex items-center gap-2">
            {activeCat && (
              <span className="flex h-9 items-center gap-2 rounded-[10px] bg-ink/[0.05] ps-2 pe-2.5 text-sm font-medium">
                <CategoryIcon category={activeCat} size={11} /> {activeCat.name}
                <button onClick={() => setParam('category', '')} className="text-ink2 hover:text-ink" aria-label={tr('Clear category')}>
                  <X size={14} />
                </button>
              </span>
            )}
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink2" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Filter assets…')} className="w-[220px] ps-9" />
            </div>
            <IconButton label={tr('Advanced filters')} active={showFilters || filtersActive} onClick={() => setShowFilters(!showFilters)} className="bg-ink/[0.04]">
              <Filter size={16} />
            </IconButton>
            <IconButton label={density === 'compact' ? tr('Comfortable mode') : tr('Compact mode')} onClick={() => updateSettings({ density: density === 'compact' ? 'comfortable' : 'compact' })} className="bg-ink/[0.04]">
              {density === 'compact' ? <Rows3 size={16} /> : <Rows4 size={16} />}
            </IconButton>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-3 border-b bg-surface2/60 px-5 py-4 md:grid-cols-5">
            <Select value={category} onChange={(e) => setParam('category', e.target.value)}>
              <option value="">{tr('All categories')}</option>
              {db.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={provider} onChange={(e) => setParam('provider', e.target.value)}>
              <option value="">{tr('All providers')}</option>
              {db.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">{tr('All tags')}</option>
              {allTags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={statusF} onChange={(e) => setStatusF(e.target.value as any)}>
              <option value="">{tr('Any status')}</option>
              <option value="active">{tr('Active')}</option>
              <option value="paused">{tr('Paused')}</option>
              <option value="cancelled">{tr('Cancelled')}</option>
            </Select>
            <Button
              variant="ghost"
              disabled={!(filtersActive || category)}
              onClick={() => {
                setTag('');
                setStatusF('');
                go('assets', filter !== 'all' ? { filter } : undefined);
              }}
            >
              {tr('Reset')}
            </Button>
          </div>
        )}

        {/* bulk bar */}
        {selected.length > 0 && (
          <div className="flex items-center gap-2 border-b bg-accent/[0.06] px-5 py-2.5 text-sm animate-fade">
            <span className="font-semibold">
              {selected.length} {tr('selected')}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setSel(new Set(list.map((a) => a.id)))}>
              {tr('Select all')} {list.length}
            </Button>
            <div className="ms-auto flex gap-1.5">
              <Button size="sm" icon={<Tag size={13} />} onClick={() => setBulk(true)}>
                {tr('Bulk edit')}
              </Button>
              <Dropdown
                trigger={(o) => (
                  <Button size="sm" onClick={o}>
                    {tr('Move to category')}
                  </Button>
                )}
                items={db.categories.map((c) => ({ label: c.name, onClick: () => bulkUpdateAssets([...sel], { categoryId: c.id }).then(() => toast(tr('Moved {n} to {name}', { n: selected.length, name: c.name }), 'success')) }))}
              />
              <Button
                size="sm"
                icon={<Pin size={13} />}
                onClick={async () => {
                  for (const a of selected) if (!a.pinned) await togglePin('asset', a.id);
                  toast(tr('Pinned'), 'success');
                }}
              >
                {tr('Pin')}
              </Button>
              <Button
                size="sm"
                icon={<CopyPlus size={13} />}
                onClick={async () => {
                  for (const a of selected) await duplicateAsset(a.id);
                  toast(tr('Duplicated {n}', { n: selected.length }), 'success');
                  setSel(new Set());
                }}
              >
                {tr('Duplicate')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 size={13} />}
                onClick={async () => {
                  if (!(await confirm({ title: tr('Delete {n} assets?', { n: selected.length }), body: tr('This cannot be undone. Linked tasks are kept.'), danger: true, confirmLabel: tr('Delete') }))) return;
                  await deleteAssets(selected.map((a) => a.id));
                  toast(tr('Deleted {n} assets', { n: selected.length }));
                  setSel(new Set());
                }}
              >
                {tr('Delete')}
              </Button>
              <IconButton label={tr('Clear selection')} className="h-7 w-7" onClick={() => setSel(new Set())}>
                <X size={15} />
              </IconButton>
            </div>
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState
            icon={<Search size={22} />}
            title={db.assets.length === 0 ? tr('No assets yet') : tr('No matching assets')}
            body={db.assets.length === 0 ? tr('Add domains, servers, subscriptions — anything with a renewal date.') : tr('Try another filter or search term.')}
            action={
              db.assets.length === 0 ? (
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => ui.editAsset()}>
                  {tr('Add asset')}
                </Button>
              ) : (
                <Button onClick={() => (setQ(''), setTag(''), setStatusF(''), go('assets'))}>{tr('Clear filters')}</Button>
              )
            }
          />
        ) : view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed text-sm">
              <colgroup>
                <col className="w-[56px]" />
                <col />
                <col className="w-[180px]" />
                <col className="w-[150px]" />
                <col className="w-[170px]" />
                <col className="w-[160px]" />
                <col className="w-[96px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-surface2/95 backdrop-blur dark:bg-[#242426]/95">
                <tr className="h-11 border-b">
                  <th className="ps-5">
                    <Checkbox checked={selected.length > 0 && selected.length === list.length} onChange={(v) => setSel(v ? new Set(list.map((a) => a.id)) : new Set())} />
                  </th>
                  {header('name', 'Name')}
                  {header('provider', 'Provider')}
                  {header('expirationDate', 'Expires')}
                  {header('remaining', 'Remaining')}
                  {header('price', 'Renewal price', 'text-end [&>button]:flex-row-reverse')}
                  <th className="pe-5" />
                </tr>
              </thead>
              <tbody>
                {list.map((a, i) => {
                  const cat = cats.get(a.categoryId);
                  const prov = a.providerId ? provs.get(a.providerId) : undefined;
                  const paused = a.status !== 'active';
                  return (
                    <tr
                      key={a.id}
                      onClick={(e) => (e.metaKey || e.ctrlKey || e.shiftKey ? toggleSel(a.id, i, e.shiftKey) : ui.openAsset(a.id))}
                      onContextMenu={(e) => ctx(e, menuItems(a))}
                      className={clsx('group cursor-default border-b border-line/[0.05] transition-colors last:border-0 hover:bg-ink/[0.025]', rowH, sel.has(a.id) && 'sel')}
                    >
                      <td className="ps-5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={sel.has(a.id)} onChange={() => toggleSel(a.id, i, false)} />
                      </td>
                      <td className="px-3">
                        <div className={clsx('flex min-w-0 items-center gap-3', paused && 'opacity-55')}>
                          <AssetTile color={cat?.color} category={cat} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-semibold" dir="ltr">
                                {a.name}
                              </span>
                              {a.pinned && <Pin size={12} className="shrink-0 fill-current text-accent" />}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink2">
                              <span>{cat?.name || '—'}</span>
                              {a.tags.slice(0, 2).map((t) => (
                                <span key={t} className="rounded-[5px] bg-ink/[0.05] px-1.5 py-px text-[11px]">
                                  {t}
                                </span>
                              ))}
                              {paused && <span className="rounded-[5px] bg-ink/[0.07] px-1.5 py-px text-[11px] font-medium">{tr(a.status[0].toUpperCase() + a.status.slice(1))}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3">
                        {prov ? (
                          <span className="flex min-w-0 items-center gap-2">
                            <ProviderAvatar name={prov.name} />
                            <span className="truncate text-ink/85">{prov.name}</span>
                          </span>
                        ) : (
                          <span className="text-ink3">—</span>
                        )}
                      </td>
                      <td className="px-3">
                        <span className="font-medium tabular">{formatDate(a.expirationDate, db.settings.dateFormat)}</span>
                      </td>
                      <td className="px-3">
                        <Countdown date={a.expirationDate} today={today} className={paused ? 'opacity-55' : ''} />
                      </td>
                      <td className="px-3 text-end">
                        <span className="font-semibold tabular">{money(a.renewalPrice ?? a.purchasePrice, a.currency)}</span>
                      </td>
                      <td className="pe-5 text-end" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex opacity-0 transition-opacity group-hover:opacity-100">
                          <IconButton label={a.pinned ? tr('Unpin') : tr('Pin')} className="h-8 w-8" onClick={() => togglePin('asset', a.id)}>
                            <Pin size={15} className={a.pinned ? 'fill-current text-accent' : ''} />
                          </IconButton>
                          <Dropdown trigger={(o) => <IconButton label={tr('Actions')} className="h-8 w-8" onClick={o}><MoreHorizontal size={16} /></IconButton>} items={menuItems(a)} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : view === 'list' ? (
          <div className="divide-y divide-line/[0.06]">
            {list.map((a, i) => {
              const cat = cats.get(a.categoryId);
              const prov = a.providerId ? provs.get(a.providerId) : undefined;
              return (
                <div key={a.id} onClick={() => ui.openAsset(a.id)} onContextMenu={(e) => ctx(e, menuItems(a))} className={clsx('group flex cursor-default items-center gap-4 px-5 transition-colors hover:bg-ink/[0.025]', rowH, sel.has(a.id) && 'sel')}>
                  <span onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={sel.has(a.id)} onChange={() => toggleSel(a.id, i, false)} />
                  </span>
                  <AssetTile color={cat?.color} category={cat} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold" dir="ltr">
                      {a.name}
                    </div>
                    <div className="truncate text-xs text-ink2">{[cat?.name, prov?.name, a.expirationDate && formatDate(a.expirationDate, db.settings.dateFormat)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className="hidden font-semibold tabular md:block">{money(a.renewalPrice ?? a.purchasePrice, a.currency)}</span>
                  <Countdown date={a.expirationDate} today={today} />
                  <span onClick={(e) => e.stopPropagation()}>
                    <Dropdown trigger={(o) => <IconButton label={tr('Actions')} className="h-8 w-8" onClick={o}><MoreHorizontal size={16} /></IconButton>} items={menuItems(a)} />
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 bg-bg/50 p-5">
            {list.map((a) => {
              const cat = cats.get(a.categoryId);
              const st = expiryStatus(a.expirationDate, today);
              const prov = a.providerId ? provs.get(a.providerId) : undefined;
              return (
                <div
                  key={a.id}
                  onClick={() => ui.openAsset(a.id)}
                  onContextMenu={(e) => ctx(e, menuItems(a))}
                  className={clsx('card group relative cursor-default p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift', sel.has(a.id) && 'ring-2 ring-accent')}
                >
                  <div className="flex items-start gap-3">
                    <AssetTile color={cat?.color} category={cat} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold" dir="ltr">
                        {a.name}
                      </div>
                      <div className="truncate text-xs text-ink2">{prov?.name || cat?.name}</div>
                    </div>
                    {a.pinned && <Pin size={13} className="fill-current text-accent" />}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line/[0.06] pt-3">
                    <Countdown date={a.expirationDate} today={today} />
                    <span className="text-sm font-semibold tabular">{money(a.renewalPrice ?? a.purchasePrice, a.currency)}</span>
                  </div>
                  <span className={clsx('absolute inset-x-4 top-0 h-[3px] rounded-b-full', STATUS_STYLE[st].dot, st === 'normal' || st === 'none' ? 'opacity-0' : '')} />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex h-12 items-center gap-3 border-t px-5 text-xs text-ink2">
          <span className="font-medium">{tr('{n} of {total} assets', { n: list.length, total: db.assets.length })}</span>
          <span className="ms-auto">{tr('Right-click a row for actions · Shift-click to multi-select')}</span>
        </div>
      </div>
      {bulk && <BulkEditModal db={db} ids={[...sel]} onClose={() => setBulk(false)} />}
    </div>
  );
}

const AVATAR_COLORS = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500', '#34C759', '#30B0C7', '#A2845E'];
export function ProviderAvatar({ name, size = 26 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ width: size, height: size, background: `${c}1f`, color: c }}>
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AssetTile({ category, color }: { category?: DB['categories'][number]; color?: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]" style={{ background: `${color || '#8E8E93'}17` }}>
      <CategoryIcon category={category} size={17} className="!bg-transparent" />
    </span>
  );
}

function BulkEditModal({ db, ids, onClose }: { db: DB; ids: string[]; onClose: () => void }) {
  const [providerId, setProviderId] = useState('__keep');
  const [status, setStatus] = useState('__keep');
  const [tags, setTags] = useState('');
  const [currency, setCurrency] = useState('');
  const [notif, setNotif] = useState('__keep');
  const toast = useToast();
  const apply = async () => {
    const patch: Partial<Asset> = {};
    if (providerId !== '__keep') patch.providerId = providerId || undefined;
    if (status !== '__keep') patch.status = status as Asset['status'];
    if (currency.trim()) patch.currency = currency.trim().toUpperCase();
    if (notif !== '__keep') patch.notificationsEnabled = notif === 'on';
    await bulkUpdateAssets(ids, patch, parseTags(tags));
    toast(tr('Updated {n} assets', { n: ids.length }), 'success');
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={420}
      title={tr('Bulk edit {n} assets', { n: ids.length })}
      footer={
        <>
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button variant="primary" icon={<Check size={13} />} onClick={apply}>
            {tr("Apply")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={tr("Provider")}>
          <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            <option value="__keep">{tr("Keep current")}</option>
            <option value="">{tr("None")}</option>
            {db.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr("Status")}>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="__keep">{tr("Keep current")}</option>
            <option value="active">{tr("Active")}</option>
            <option value="paused">{tr("Paused")}</option>
            <option value="cancelled">{tr("Cancelled")}</option>
          </Select>
        </Field>
        <Field label={tr("Notifications")}>
          <Select value={notif} onChange={(e) => setNotif(e.target.value)}>
            <option value="__keep">{tr("Keep current")}</option>
            <option value="on">{tr("Enable")}</option>
            <option value="off">{tr("Disable")}</option>
          </Select>
        </Field>
        <Field label={tr("Add tags")} hint={tr("Comma separated; existing tags are kept")}>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <Field label={tr("Currency")} hint={tr("Leave empty to keep")}>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder={tr("USD")} />
        </Field>
      </div>
    </Modal>
  );
}
