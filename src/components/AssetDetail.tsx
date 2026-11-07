import { BellOff, BellRing, Copy, CopyPlus, Eye, EyeOff, Globe, History, Lock, MoreHorizontal, Paperclip, Pencil, Pin, PinOff, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { duplicateAsset, snoozeAsset, toggleTask, togglePin, updateAsset } from '../lib/actions';
import { isEncrypted, revealSecret } from '../lib/crypto';
import { addDays, countdownLabel, expiryStatus, formatDate, formatRelativeTime } from '../lib/dates';
import type { DB, SecretValue } from '../lib/types';
import { clsx, isSafeHttpUrl, money, normalizeUrl, openUrl } from '../lib/util';
import { assetDomain, assetWebsite, useAssetActions } from './assetActions';
import { CategoryIcon } from './icons';
import { PriorityMark } from './TaskForm';
import { Badge, Button, Checkbox, Drawer, Dropdown, IconButton, STATUS_STYLE, StatusDot, Switch, useToast } from './ui';
import { useUI } from './ui-context';

import { t as tr, tn } from '../lib/i18n';
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[28px] items-center gap-3 border-b border-line/[0.06] py-1 text-sm last:border-0">
      <div className="w-[120px] shrink-0 text-ink2">{label}</div>
      <div className="min-w-0 flex-1 truncate">{children}</div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="px-5 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="section-title">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function LinkVal({ url }: { url: string }) {
  if (!url) return <span className="text-ink3">—</span>;
  return isSafeHttpUrl(url) ? (
    <a href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
      {url.replace(/^https?:\/\//, '')}
    </a>
  ) : (
    <span>{url}</span>
  );
}

function SecretRow({ label, value, onCopy }: { label: string; value: SecretValue | undefined; onCopy: (v: string) => void }) {
  const [shown, setShown] = useState<string | null>(null);
  const ui = useUI();
  const toast = useToast();
  if (!value) return <Row label={label}><span className="text-ink3">—</span></Row>;
  const reveal = async (): Promise<string | null> => {
    let v = await revealSecret(value);
    if (v === null && isEncrypted(value)) {
      if (await ui.requestUnlock()) v = await revealSecret(value);
    }
    if (v === null) toast(tr("Vault is locked"), 'error');
    return v;
  };
  return (
    <Row label={label}>
      <span className="flex items-center gap-1">
        <span className="flex-1 truncate font-mono text-xs">{shown ?? '••••••••••'}</span>
        {isEncrypted(value) && <Lock size={11} className="text-ink3" />}
        <IconButton label={shown ? tr("Hide") : tr("Reveal")} className="h-6 w-6" onClick={async () => (shown ? setShown(null) : setShown(await reveal()))}>
          {shown ? <EyeOff size={12} /> : <Eye size={12} />}
        </IconButton>
        <IconButton label={tr("Copy")} className="h-6 w-6" onClick={async () => { const v = await reveal(); if (v) onCopy(v); }}>
          <Copy size={12} />
        </IconButton>
      </span>
    </Row>
  );
}

export function AssetDetail({ db, assetId, today, onClose }: { db: DB; assetId: string; today: string; onClose: () => void }) {
  const a = db.assets.find((x) => x.id === assetId);
  const ui = useUI();
  const toast = useToast();
  const { items, copy, remove, open, providerDashboard } = useAssetActions(db);
  const [tab, setTab] = useState<'details' | 'history'>('details');
  useEffect(() => setTab('details'), [assetId]);
  if (!a) {
    return (
      <Drawer open onClose={onClose}>
        <div className="p-6 text-sm text-ink2">{tr("This asset no longer exists.")}</div>
      </Drawer>
    );
  }
  const cat = db.categories.find((c) => c.id === a.categoryId);
  const prov = db.providers.find((p) => p.id === a.providerId);
  const status = expiryStatus(a.expirationDate, today);
  const st = STATUS_STYLE[status];
  const tasks = db.tasks.filter((t) => t.assetId === a.id).sort((x, y) => Number(x.done) - Number(y.done));
  const activity = db.activity.filter((x) => x.itemId === a.id);
  const fmt = db.settings.dateFormat;
  const snoozed = a.snoozedUntil && a.snoozedUntil > today;

  return (
    <Drawer open onClose={onClose} width={480}>
      {/* header */}
      <div className="shrink-0 border-b px-5 pb-3 pt-4">
        <div className="flex items-start gap-3">
          <CategoryIcon category={cat} size={16} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[15px] font-semibold">{a.name}</h2>
              {a.pinned && <Pin size={12} className="shrink-0 text-accent" />}
            </div>
            <div className="truncate text-xs text-ink2">
              {cat?.name || tr("Uncategorized")}
              {prov && (
                <>
                  {' · '}
                  <button className="hover:text-accent hover:underline" onClick={() => ui.openProvider(prov.id)}>
                    {prov.name}
                  </button>
                </>
              )}
              {a.status !== 'active' && ` · ${tr(a.status[0].toUpperCase() + a.status.slice(1))}`}
            </div>
          </div>
          <Dropdown trigger={(o) => <IconButton label={tr("More")} onClick={o}><MoreHorizontal size={15} /></IconButton>} items={items(a)} />
          <IconButton label={tr("Close")} onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        {/* countdown */}
        <div className={clsx('mt-3 flex items-center gap-3 rounded-[10px] px-3 py-2.5', st.bg || 'bg-bg')}>
          <StatusDot status={status} pulse />
          <div className="flex-1">
            <div className={clsx('text-[15px] font-semibold tabular', status === 'normal' ? 'text-ink' : st.text)}>{countdownLabel(a.expirationDate, today)}</div>
            <div className="text-xs text-ink2">{a.expirationDate ? `${status === 'expired' ? tr("Expired") : tr("Expires")} ${formatDate(a.expirationDate, fmt)}` : tr("No expiration date set")}</div>
          </div>
          {a.expirationDate && (
            <Button size="sm" variant="primary" icon={<RefreshCw size={12} />} onClick={() => ui.renewAsset(a.id)}>
              {tr("Mark renewed")}
            </Button>
          )}
        </div>

        {/* quick actions */}
        <div className="mt-2.5 flex flex-wrap gap-1">
          <Button size="sm" icon={<Pencil size={12} />} onClick={() => ui.editAsset(a.id)}>
            {tr("Edit")}
          </Button>
          <Button size="sm" icon={<Globe size={12} />} onClick={() => open(a)} disabled={!isSafeHttpUrl(assetWebsite(a))}>
            {tr("Open")}
          </Button>
          <Button size="sm" icon={<Copy size={12} />} onClick={() => copy(assetWebsite(a) ? normalizeUrl(assetWebsite(a)) : '', 'URL')}>
            {tr("URL")}
          </Button>
          <Button size="sm" icon={<Copy size={12} />} onClick={() => copy(assetDomain(a), 'domain')}>
            {tr("Domain")}
          </Button>
          <Button size="sm" icon={a.pinned ? <PinOff size={12} /> : <Pin size={12} />} onClick={() => togglePin('asset', a.id)}>
            {a.pinned ? tr("Unpin") : tr("Pin")}
          </Button>
          <Button
            size="sm"
            icon={<CopyPlus size={12} />}
            onClick={async () => {
              const c = await duplicateAsset(a.id);
              toast(tr("Duplicated"), 'success');
              ui.openAsset(c.id);
            }}
          >
            {tr("Duplicate")}
          </Button>
          <Button size="sm" variant="ghost" className="!text-crit" icon={<Trash2 size={12} />} onClick={async () => (await remove(a)) && onClose()}>
            {tr("Delete")}
          </Button>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          {(['details', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={clsx('-mb-3 border-b-2 pb-2 font-medium capitalize', tab === t ? 'border-accent text-ink' : 'border-transparent text-ink2 hover:text-ink')}>
              {t === 'history' ? `${tr('History')} (${activity.length + a.renewals.length})` : tr("Details")}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {tab === 'details' ? (
          <>
            <Section title={tr("Information")}>
              <Row label={tr("Category")}>{cat?.name || '—'}</Row>
              <Row label={tr("Provider")}>
                {prov ? (
                  <span className="flex items-center gap-2">
                    {prov.name}
                    {(prov.dashboardUrl || prov.website) && (
                      <button className="text-xs text-accent hover:underline" onClick={() => providerDashboard(a)}>
                        {tr("Dashboard ↗")}
                      </button>
                    )}
                  </span>
                ) : (
                  '—'
                )}
              </Row>
              <Row label={tr("Status")}>
                <span className="capitalize">{a.status}</span>
              </Row>
              <Row label={tr("Login URL")}>
                <LinkVal url={a.loginUrl} />
              </Row>
              <Row label={tr("Purchase website")}>
                <LinkVal url={a.purchaseUrl} />
              </Row>
              {a.tags.length > 0 && (
                <Row label={tr("Tags")}>
                  <span className="flex flex-wrap gap-1">
                    {a.tags.map((t) => (
                      <Badge key={t}>#{t}</Badge>
                    ))}
                  </span>
                </Row>
              )}
            </Section>

            <Section title={tr("Purchase")}>
              <Row label={tr("Purchased")}>{formatDate(a.purchaseDate, fmt)}</Row>
              <Row label={tr("Purchase price")}>{money(a.purchasePrice, a.currency)}</Row>
              <Row label={tr("Renewal price")}>{money(a.renewalPrice, a.currency)}</Row>
              <Row label={tr("Expiration")}>{formatDate(a.expirationDate, fmt)}</Row>
            </Section>

            {(a.username || a.password) && (
              <Section title={tr("Credentials")}>
                <Row label={tr("Username")}>
                  <span className="flex items-center gap-1">
                    <span className="flex-1 truncate">{a.username || '—'}</span>
                    {a.username && (
                      <IconButton label={tr("Copy username")} className="h-6 w-6" onClick={() => copy(a.username, 'username')}>
                        <Copy size={12} />
                      </IconButton>
                    )}
                  </span>
                </Row>
                <SecretRow label={tr("Password")} value={a.password} onCopy={(v) => copy(v, 'password')} />
              </Section>
            )}

            {cat && cat.fields.length > 0 && (
              <Section title={tr('{name} fields', { name: tr(cat.name) })}>
                {cat.fields.map((f) => {
                  const v = a.custom[f.id];
                  if (f.type === 'password') return <SecretRow key={f.id} label={f.label} value={v as SecretValue} onCopy={(x) => copy(x, f.label)} />;
                  let shown: React.ReactNode = v === undefined || v === '' ? <span className="text-ink3">—</span> : String(v);
                  if (f.type === 'checkbox') shown = v ? tr("Yes") : tr("No");
                  if (f.type === 'url' && typeof v === 'string') shown = <LinkVal url={v} />;
                  if (f.type === 'date' && typeof v === 'string' && v) shown = formatDate(v, fmt);
                  if (f.type === 'textarea' && v) shown = <span className="whitespace-pre-wrap">{String(v)}</span>;
                  return (
                    <Row key={f.id} label={f.label}>
                      {shown}
                    </Row>
                  );
                })}
              </Section>
            )}

            <Section
              title={`${tr('Tasks')} (${tasks.filter((t) => !t.done).length})`}
              action={
                <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => ui.editTask(undefined, { assetId: a.id, title: tr('Renew {name}', { name: a.name }), dueDate: a.expirationDate ? addDays(a.expirationDate, -db.settings.renewalTaskDays) : undefined, priority: 'high' })}>
                  {tr("Add")}
                </Button>
              }
            >
              {tasks.length === 0 ? (
                <div className="py-1 text-sm text-ink3">{tr("No linked tasks")}</div>
              ) : (
                tasks.map((t) => (
                  <div key={t.id} className="flex h-8 items-center gap-2 rounded-[6px] px-1 hov">
                    <Checkbox round checked={t.done} onChange={() => toggleTask(t.id)} />
                    <button className={clsx('flex-1 truncate text-start text-sm', t.done && 'text-ink2 line-through')} onClick={() => ui.openTask(t.id)}>
                      {t.title}
                    </button>
                    <PriorityMark p={t.priority} />
                    {t.dueDate && <span className="text-xs text-ink2 tabular">{formatDate(t.dueDate, fmt)}</span>}
                  </div>
                ))
              )}
            </Section>

            <Section title={tr("Notifications")}>
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="flex items-center gap-2">
                  {a.notificationsEnabled ? <BellRing size={13} className="text-ink2" /> : <BellOff size={13} className="text-ink2" />}
                  {tr("Expiration reminders")}
                </span>
                <Switch checked={a.notificationsEnabled} onChange={(v) => updateAsset(a.id, { notificationsEnabled: v })} label={tr("Expiration reminders")} />
              </div>
              <div className="text-xs text-ink2">
                {tr("Schedule:")} {(a.reminderDays && a.reminderDays.length ? a.reminderDays : db.settings.reminderDays).join(', ')} {tr("days before")}
                {a.reminderDays && a.reminderDays.length ? ' (custom)' : ' (default)'}
              </div>
              {a.notificationsEnabled && a.expirationDate && (
                <div className="mt-2 flex items-center gap-1.5">
                  {snoozed ? (
                    <>
                      <span className="text-xs text-ink2">{tr("Snoozed until")} {formatDate(a.snoozedUntil, fmt)}</span>
                      <Button size="sm" variant="ghost" onClick={() => updateAsset(a.id, { snoozedUntil: undefined })}>
                        {tr("Unsnooze")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-ink2">{tr("Snooze:")}</span>
                      {[1, 3, 7].map((d) => (
                        <Button key={d} size="sm" onClick={() => snoozeAsset(a.id, addDays(today, d)).then(() => toast(tn(d, 'Snoozed for {n} day', 'Snoozed for {n} days')))}>
                          {d}d
                        </Button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </Section>

            {a.attachments.length > 0 && (
              <Section title={tr("Attachments")}>
                {a.attachments.map((at) => (
                  <div key={at.id} className="flex h-7 items-center gap-2 text-sm">
                    <Paperclip size={12} className="text-ink2" />
                    {isSafeHttpUrl(at.url) ? (
                      <button className="truncate text-accent hover:underline" onClick={() => openUrl(at.url)}>
                        {at.name || at.url}
                      </button>
                    ) : (
                      <span className="truncate">{at.name || at.url}</span>
                    )}
                  </div>
                ))}
              </Section>
            )}

            {a.notes && (
              <Section title={tr("Notes")}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.notes}</p>
              </Section>
            )}
            <div className="px-5 text-2xs text-ink3">
              {tr("Created")} {formatRelativeTime(a.createdAt)} {tr("· Updated")} {formatRelativeTime(a.updatedAt)}
            </div>
          </>
        ) : (
          <>
            <Section title={tr("Renewal history")}>
              {a.renewals.length === 0 ? (
                <div className="text-sm text-ink3">{tr("No renewals recorded yet")}</div>
              ) : (
                a.renewals.map((r) => (
                  <div key={r.id} className="flex gap-3 border-b border-line/[0.06] py-2 text-sm last:border-0">
                    <RefreshCw size={13} className="mt-0.5 text-ok" />
                    <div className="flex-1">
                      <div>
                        {formatDate(r.previousExpiration, fmt)} → <span className="font-medium">{formatDate(r.newExpiration, fmt)}</span>
                      </div>
                      <div className="text-xs text-ink2">
                        {r.previousPrice !== undefined || r.newPrice !== undefined ? `${money(r.previousPrice, a.currency)} → ${money(r.newPrice ?? r.previousPrice, a.currency)} · ` : ''}
                        {formatRelativeTime(r.at)}
                      </div>
                      {r.note && <div className="mt-0.5 text-xs">{r.note}</div>}
                    </div>
                  </div>
                ))
              )}
            </Section>
            <Section title={tr("Activity")}>
              {activity.length === 0 ? (
                <div className="text-sm text-ink3">{tr("No activity")}</div>
              ) : (
                activity.map((x) => (
                  <div key={x.id} className="flex gap-3 py-1.5 text-sm">
                    <History size={13} className="mt-0.5 text-ink3" />
                    <div className="flex-1">
                      <div>{x.summary}</div>
                      <div className="text-xs text-ink2">{formatRelativeTime(x.at)}</div>
                    </div>
                  </div>
                ))
              )}
            </Section>
          </>
        )}
      </div>
    </Drawer>
  );
}
