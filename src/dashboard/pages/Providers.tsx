import { Building2, ExternalLink, Filter, LayoutDashboard, LifeBuoy, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { go } from '../../components/hooks';
import { CategoryIcon } from '../../components/icons';
import { Button, Countdown, EmptyState, Input, useConfirm, useToast } from '../../components/ui';
import { useUI } from '../../components/ui-context';
import { deleteProvider } from '../../lib/actions';
import { expiryStatus, formatDate } from '../../lib/dates';
import type { DB } from '../../lib/types';
import { clsx, domainOf, isSafeHttpUrl, money, openUrl } from '../../lib/util';

import { t as tr, tn } from '../../lib/i18n';
import { PageHeader } from '../../components/Page';
export function ProvidersPage({ db, today, params }: { db: DB; today: string; params: URLSearchParams }) {
  const ui = useUI();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const selId = params.get('id') || db.providers.slice().sort((a, b) => a.name.localeCompare(b.name))[0]?.id;
  const sel = db.providers.find((p) => p.id === selId);
  const assetsBy = useMemo(() => {
    const m = new Map<string, DB['assets']>();
    for (const a of db.assets) if (a.providerId) (m.get(a.providerId) || m.set(a.providerId, []).get(a.providerId)!).push(a);
    return m;
  }, [db.assets]);
  const list = db.providers.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const cats = new Map(db.categories.map((c) => [c.id, c]));

  if (db.providers.length === 0)
    return (
      <div className="page">
        <div className="card">
          <EmptyState
            icon={<Building2 size={22} />}
            title={tr("No providers yet")}
            body={tr("Keep registrars, hosts and SaaS vendors in one place — with dashboard, support links and every asset you have with them.")}
            action={
              <Button variant="primary" icon={<Plus size={14} />} onClick={() => ui.editProvider(undefined, (id) => go('providers', { id }))}>
                {tr("Add provider")}
              </Button>
            }
          />
        </div>
      </div>
    );

  const assets = sel ? (assetsBy.get(sel.id) || []).slice().sort((a, b) => (a.expirationDate || '9').localeCompare(b.expirationDate || '9')) : [];
  const spend = new Map<string, number>();
  for (const a of assets) {
    const p = a.renewalPrice ?? a.purchasePrice;
    if (p && a.status === 'active') spend.set(a.currency, (spend.get(a.currency) || 0) + p);
  }

  return (
    <div className="page">
      <PageHeader icon="providers" tone="orange" title={tr('Providers')} subtitle={tr('{n} providers', { n: db.providers.length })} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => ui.editProvider(undefined, (id) => go('providers', { id }))}>{tr('Add provider')}</Button>} />
      <div className="grid-12 items-start">
      <aside className="card col-span-12 flex flex-col overflow-hidden lg:sticky lg:top-[88px] lg:col-span-4 lg:max-h-[calc(100vh-190px)] xl:col-span-3">
        <div className="flex gap-1.5 border-b p-2">
          <div className="relative flex-1">
            <Search size={12} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-ink2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search providers")} className="ps-7" />
          </div>
          <Button variant="primary" className="w-7 px-0" onClick={() => ui.editProvider(undefined, (id) => go('providers', { id }))} aria-label={tr("Add provider")}>
            <Plus size={14} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {list.map((p) => {
            const as = assetsBy.get(p.id) || [];
            const urgent = as.filter((a) => a.status === 'active' && ['critical', 'expired'].includes(expiryStatus(a.expirationDate, today))).length;
            return (
              <a key={p.id} href={`#/providers?id=${p.id}`} className={clsx('flex h-10 items-center gap-2.5 rounded-[7px] px-2', p.id === selId ? 'bg-accent text-white' : 'hov')}>
                <span className={clsx('flex h-6 w-6 items-center justify-center rounded-[6px] text-[11px] font-bold', p.id === selId ? 'bg-white/20' : 'bg-ink/[0.06] text-ink2')}>{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className={clsx('block truncate text-2xs', p.id === selId ? 'text-white/75' : 'text-ink2')}>{domainOf(p.website) || `${as.length} assets`}</span>
                </span>
                {urgent > 0 && <span className="h-1.5 w-1.5 rounded-full bg-crit" />}
                <span className={clsx('text-xs tabular', p.id === selId ? 'text-white/80' : 'text-ink2')}>{as.length}</span>
              </a>
            );
          })}
        </div>
      </aside>
      {sel ? (
        <div className="card col-span-12 min-w-0 lg:col-span-8 xl:col-span-9">
          <div className="p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-gradient-to-b from-ink/[0.06] to-ink/[0.1] text-[18px] font-bold text-ink2">{sel.name.slice(0, 1).toUpperCase()}</div>
              <div className="flex-1">
                <h2 className="text-[20px] font-semibold tracking-tight">{sel.name}</h2>
                <div className="text-sm text-ink2">
                  {tn(assets.length, '{n} asset', '{n} assets')}
                  {spend.size > 0 && ` · ${tr('{amount} per renewal cycle', { amount: Array.from(spend.entries()).map(([c, v]) => money(v, c)).join(' + ') })}`}
                </div>
              </div>
              <Button icon={<Pencil size={12} />} onClick={() => ui.editProvider(sel.id)}>
                {tr("Edit")}
              </Button>
              <Button
                variant="ghost"
                className="!text-crit"
                icon={<Trash2 size={12} />}
                onClick={async () => {
                  if (await confirm({ title: tr('Delete {name}?', { name: sel.name }), body: assets.length ? tr('{n} assets will be unlinked from this provider (not deleted).', { n: assets.length }) : undefined, danger: true, confirmLabel: tr("Delete") })) {
                    await deleteProvider(sel.id);
                    toast(tr("Provider deleted"));
                    go('providers');
                  }
                }}
              >
                {tr("Delete")}
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: tr("Website"), url: sel.website, icon: <ExternalLink size={12} /> },
                { label: tr("Dashboard"), url: sel.dashboardUrl, icon: <LayoutDashboard size={12} /> },
                { label: tr("Support"), url: sel.supportUrl, icon: <LifeBuoy size={12} /> },
              ].map((l) => (
                <Button key={l.label} icon={l.icon} disabled={!isSafeHttpUrl(l.url)} onClick={() => openUrl(l.url)} title={l.url || tr('Not set')}>
                  {l.label}
                </Button>
              ))}
              <Button icon={<Filter size={12} />} onClick={() => go('assets', { provider: sel.id })}>
                {tr("Filter assets")}
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="card p-3.5">
                <div className="section-title mb-1.5">{tr("Contact")}</div>
                <div className="whitespace-pre-wrap text-sm">{sel.contact || <span className="text-ink3">—</span>}</div>
              </div>
              <div className="card p-3.5">
                <div className="section-title mb-1.5">{tr("Notes")}</div>
                <div className="whitespace-pre-wrap text-sm">{sel.notes || <span className="text-ink3">—</span>}</div>
              </div>
            </div>
            <div className="card mt-3 overflow-hidden">
              <div className="flex h-10 items-center border-b px-3.5">
                <span className="flex-1 text-[13px] font-semibold">{tr("Related assets")}</span>
                <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => ui.editAsset(undefined, { providerId: sel.id })}>
                  {tr("Add asset")}
                </Button>
              </div>
              {assets.length === 0 ? (
                <EmptyState compact icon={<Building2 size={16} />} title={tr("No assets with this provider")} />
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id} onClick={() => ui.openAsset(a.id)} className="cursor-default border-b border-line/[0.05] last:border-0 hov">
                        <td className="py-[7px] ps-3.5">
                          <span className="flex items-center gap-2">
                            <CategoryIcon category={cats.get(a.categoryId)} size={10} />
                            <span className="font-medium">{a.name}</span>
                          </span>
                        </td>
                        <td className="text-ink2">{cats.get(a.categoryId)?.name}</td>
                        <td className="text-ink2 tabular">{formatDate(a.expirationDate, db.settings.dateFormat)}</td>
                        <td className="tabular">{money(a.renewalPrice ?? a.purchasePrice, a.currency)}</td>
                        <td className="pe-3.5 text-end">
                          <Countdown date={a.expirationDate} today={today} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card col-span-12 lg:col-span-8 xl:col-span-9">
          <EmptyState icon={<Building2 size={22} />} title={tr("Select a provider")} />
        </div>
      )}
      </div>
    </div>
  );
}
