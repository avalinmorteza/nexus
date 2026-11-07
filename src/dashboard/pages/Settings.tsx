import { ArrowDown, ArrowUp, Bell, Building2, Database, Download, FileJson, FileSpreadsheet, Keyboard, LayoutDashboard, Lock, Palette, Plus, Settings2, Shapes, ShieldCheck, Trash2, Unlock, Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { go, shortcutLabel } from '../../components/hooks';
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from '../../components/icons';
import { Badge, Button, Checkbox, EmptyState, Field, IconButton, Input, Kbd, Modal, Segmented, Select, Switch, useConfirm, useToast } from '../../components/ui';
import { useUI } from '../../components/ui-context';
import { PageHeader } from '../../components/Page';
import { clearAllData, deleteCategory, importData, reorderCategories, replaceAll, saveCategory, updateSettings } from '../../lib/actions';
import { decryptWith, deriveKey, encryptWith, getSessionKey, isEncrypted, isUnlocked, lock, makeVerifier, newSalt, setSessionKey } from '../../lib/crypto';
import { CURRENCIES, DEFAULT_REMINDER_DAYS } from '../../lib/defaults';
import { assetsToCSV, unwrapBackup, validateBackup, type BackupValidation } from '../../lib/logic';
import { sampleDB } from '../../lib/sample';
import { getDB } from '../../lib/store';
import type { Category, DateFormat, DB, FieldDef, FieldType, Settings, Theme } from '../../lib/types';
import { clsx, downloadFile, moveItem, uid } from '../../lib/util';
import { CustomizeModal } from './Overview';

import { LANGUAGES, t as tr, tn, type Lang } from '../../lib/i18n';
const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'categories', label: 'Categories & Fields', icon: Shapes },
  { id: 'providers', label: 'Providers', icon: Building2 },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
  { id: 'data', label: 'Data Management', icon: Database },
  { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
] as const;

const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

function Group({ title, children, desc }: { title?: string; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      {title && <div className="mb-1.5 px-1 text-xs font-semibold text-ink2">{title}</div>}
      <div className="card divide-y divide-line/[0.06]">{children}</div>
      {desc && <div className="mt-1.5 px-1 text-xs text-ink2">{desc}</div>}
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center gap-4 px-3.5 py-2">
      <div className="flex-1">
        <div className="text-sm">{label}</div>
        {desc && <div className="text-xs text-ink2">{desc}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function SettingsPage({ db, params }: { db: DB; params: URLSearchParams }) {
  const section = params.get('section') || 'appearance';
  const s = db.settings;
  const set = (patch: Partial<Settings>) => updateSettings(patch);
  return (
    <div className="page">
      <PageHeader icon="settings" tone="gray" title={tr('Settings')} subtitle={tr('Preferences, data and privacy')} />
      <div className="grid-12 items-start">
      <aside className="card col-span-12 space-y-0.5 p-2 lg:sticky lg:top-[88px] lg:col-span-3">
        {SECTIONS.map((x) => (
          <a key={x.id} href={`#/settings?section=${x.id}`} className={clsx('flex h-8 items-center gap-2.5 rounded-[7px] px-2 text-sm', section === x.id ? 'bg-accent text-white' : 'hov')}>
            <x.icon size={14} className={section === x.id ? 'text-white' : 'text-ink2'} />
            {tr(x.label)}
          </a>
        ))}
      </aside>
      <div className="col-span-12 min-w-0 lg:col-span-9">
        <div className="max-w-[860px]">
          <h2 className="mb-4 text-[20px] font-semibold tracking-tight">{tr(SECTIONS.find((x) => x.id === section)?.label || '')}</h2>
          {section === 'appearance' && (
            <>
              <Group>
                <Row label={tr("Theme")} desc={tr("System follows your OS appearance")}>
                  <Segmented<Theme>
                    value={s.theme}
                    onChange={(v) => set({ theme: v })}
                    options={[
                      { value: 'light', label: tr("Light") },
                      { value: 'dark', label: tr("Dark") },
                      { value: 'system', label: tr("System") },
                    ]}
                  />
                </Row>
                <Row label={tr("Default asset view")}>
                  <Segmented
                    value={s.defaultView}
                    onChange={(v) => set({ defaultView: v })}
                    options={[
                      { value: 'table', label: tr("Table") },
                      { value: 'list', label: tr("List") },
                      { value: 'grid', label: tr("Grid") },
                    ]}
                  />
                </Row>
                <Row label={tr("Density")}>
                  <Segmented
                    value={s.density}
                    onChange={(v) => set({ density: v })}
                    options={[
                      { value: 'compact', label: tr("Compact") },
                      { value: 'comfortable', label: tr("Comfortable") },
                    ]}
                  />
                </Row>
              </Group>
            </>
          )}
          {section === 'general' && (
            <Group>
              <Row label={tr('Language')} desc={tr("زبان / Language")}>
                <Segmented<Lang>
                  value={s.language}
                  onChange={(v) => set({ language: v, ...(v === 'fa' && s.language !== 'fa' ? { calendar: 'jalali', weekStart: 6 } : {}) })}
                  options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
                />
              </Row>
              <Row label={tr('Calendar')} desc={tr("Dates are stored in a standard format; this only changes how they're shown and picked")}>
                <Segmented
                  value={s.calendar}
                  onChange={(v) => set({ calendar: v })}
                  options={[
                    { value: 'jalali', label: tr('Shamsi (Jalali)') },
                    { value: 'gregorian', label: tr('Gregorian') },
                  ]}
                />
              </Row>
              <Row label={tr("Your name")} desc={tr("Used in the dashboard greeting")}>
                <Input defaultValue={s.userName} onBlur={(e) => set({ userName: e.target.value.trim() })} className="w-[200px]" placeholder={tr("Optional")} />
              </Row>
              <Row label={tr("Date format")}>
                <Select value={s.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as DateFormat })} className="w-[200px]">
                  <option value="MMM d, yyyy">{tr("Nov 6, 2026")}</option>
                  <option value="yyyy-MM-dd">2026-11-06</option>
                  <option value="dd/MM/yyyy">06/11/2026</option>
                  <option value="MM/dd/yyyy">11/06/2026</option>
                </Select>
              </Row>
              <Row label={tr("Default currency")}>
                <Select value={s.currency} onChange={(e) => set({ currency: e.target.value })} className="w-[200px]">
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Row>
              <Row label={tr("Week starts on")}>
                <Select value={String(s.weekStart)} onChange={(e) => set({ weekStart: Number(e.target.value) as 0 | 1 | 6 })} className="w-[200px]">
                  <option value="1">{tr("Monday")}</option>
                  <option value="0">{tr("Sunday")}</option>
                  <option value="6">{tr("Saturday")}</option>
                </Select>
              </Row>
              <Row label={tr("Auto-create renewal tasks")} desc={tr("When adding an asset with an expiration date (categories can override)")}>
                <Switch checked={s.autoRenewalTask} onChange={(v) => set({ autoRenewalTask: v })} label={tr("Auto-create renewal tasks")} />
              </Row>
              <Row label={tr("Renewal task lead time")} desc={tr("Days before expiration the task is due")}>
                <Input type="number" min={0} max={365} value={s.renewalTaskDays} onChange={(e) => set({ renewalTaskDays: Math.max(0, Number(e.target.value) || 0) })} className="w-[80px]" />
              </Row>
            </Group>
          )}
          {section === 'notifications' && <NotificationSettings db={db} />}
          {section === 'categories' && <CategorySettings db={db} />}
          {section === 'providers' && (
            <Group desc={tr("Providers have their own page with related assets, dashboard and support links.")}>
              <Row label={tr('{n} providers', { n: db.providers.length })}>
                <Button onClick={() => go('providers')}>{tr("Manage providers")}</Button>
              </Row>
            </Group>
          )}
          {section === 'dashboard' && <DashboardSettings db={db} />}
          {section === 'shortcuts' && <ShortcutSettings db={db} />}
          {section === 'data' && <DataSettings db={db} />}
          {section === 'privacy' && <PrivacySettings db={db} />}
        </div>
      </div>
      </div>
    </div>
  );
}

function NotificationSettings({ db }: { db: DB }) {
  const s = db.settings;
  const toast = useToast();
  const [days, setDays] = useState(s.reminderDays.join(', '));
  const saveDays = () => {
    const parsed = Array.from(new Set(days.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 3650))).sort((a, b) => b - a);
    if (!parsed.length) return toast(tr("Enter at least one day value"), 'error');
    updateSettings({ reminderDays: parsed });
    setDays(parsed.join(', '));
    toast(tr("Reminder schedule saved"), 'success');
  };
  const send = (type: string, ok: string) => {
    if (!hasChrome) return toast(tr("Only available inside the Chrome extension"), 'error');
    chrome.runtime.sendMessage({ type }, (r) => (chrome.runtime.lastError || !r?.ok ? toast(r?.error || tr("Failed"), 'error') : toast(ok, 'success')));
  };
  return (
    <>
      <Group>
        <Row label={tr("Enable notifications")} desc={tr("Chrome desktop notifications, even when NEXUS is closed")}>
          <Switch checked={s.notificationsEnabled} onChange={(v) => updateSettings({ notificationsEnabled: v })} label={tr("Enable notifications")} />
        </Row>
        <Row label={tr("Task reminders")} desc={tr("Notify at a task's reminder time")}>
          <Switch checked={s.taskReminders} onChange={(v) => updateSettings({ taskReminders: v })} label={tr("Task reminders")} disabled={!s.notificationsEnabled} />
        </Row>
        <Row label={tr("Daily digest")} desc={tr("One morning notification when tasks are due")}>
          <Switch checked={s.dailyDigest} onChange={(v) => updateSettings({ dailyDigest: v })} label={tr("Daily digest")} disabled={!s.notificationsEnabled} />
        </Row>
      </Group>
      <Group title={tr("Default expiration schedule")} desc={tr("Days before expiration. Each step notifies once; if Chrome was closed, only the most urgent missed step is shown. Assets can override this.")}>
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <Input value={days} onChange={(e) => setDays(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveDays()} />
          <Button onClick={saveDays}>{tr("Save")}</Button>
          <Button variant="ghost" onClick={() => setDays(DEFAULT_REMINDER_DAYS.join(', '))}>
            {tr("Reset")}
          </Button>
        </div>
      </Group>
      <Group title={tr("Testing")}>
        <Row label={tr("Send a test notification")}>
          <Button onClick={() => send('nexus:test-notification', 'Test notification sent')}>{tr("Send test")}</Button>
        </Row>
        <Row label={tr("Run reminder check now")} desc={tr("Re-evaluates every asset immediately")}>
          <Button onClick={() => send('nexus:check', 'Check complete')}>{tr("Check now")}</Button>
        </Row>
        <Row label={tr("Reset sent-reminder history")} desc={tr("Allows already-sent reminders to fire again (useful for testing)")}>
          <Button onClick={() => send('nexus:reset-sent', 'Reminder history reset')}>{tr("Reset")}</Button>
        </Row>
      </Group>
    </>
  );
}

function CategorySettings({ db }: { db: DB }) {
  const [edit, setEdit] = useState<Category | null>(null);
  const counts = new Map<string, number>();
  for (const a of db.assets) counts.set(a.categoryId, (counts.get(a.categoryId) || 0) + 1);
  return (
    <>
      <div className="mb-2 flex justify-end">
        <Button variant="primary" icon={<Plus size={13} />} onClick={() => setEdit({ id: uid(), name: '', icon: 'box', color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)], fields: [], autoTask: { enabled: false, daysBefore: 3, title: tr("Renew {name}") } })}>
          {tr("New category")}
        </Button>
      </div>
      <Group desc={tr("Every category can have its own custom fields and renewal-task rule.")}>
        {db.categories.map((c, i) => (
          <div key={c.id} className="group flex h-11 items-center gap-3 px-3.5">
            <CategoryIcon category={c} size={12} />
            <button className="flex-1 text-start" onClick={() => setEdit(structuredClone(c))}>
              <div className="text-sm font-medium">{c.name}</div>
              <div className="text-2xs text-ink2">
                {tn(c.fields.length, '{n} custom field', '{n} custom fields')}
                {c.autoTask?.enabled ? ` · ${tr('auto task {n}d before', { n: c.autoTask.daysBefore })}` : ''}
              </div>
            </button>
            <span className="text-xs text-ink2 tabular">{counts.get(c.id) || 0}</span>
            <span className="flex opacity-0 group-hover:opacity-100">
              <IconButton label={tr("Move up")} className="h-6 w-6" disabled={i === 0} onClick={() => reorderCategories(moveItem(db.categories, i, i - 1).map((x) => x.id))}>
                <ArrowUp size={12} />
              </IconButton>
              <IconButton label={tr("Move down")} className="h-6 w-6" disabled={i === db.categories.length - 1} onClick={() => reorderCategories(moveItem(db.categories, i, i + 1).map((x) => x.id))}>
                <ArrowDown size={12} />
              </IconButton>
            </span>
            <Button size="sm" onClick={() => setEdit(structuredClone(c))}>
              {tr("Edit")}
            </Button>
          </div>
        ))}
      </Group>
      {edit && <CategoryEditor db={db} cat={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'password', label: 'Password' },
  { value: 'textarea', label: 'Multi-line text' },
];

function CategoryEditor({ db, cat, onClose }: { db: DB; cat: Category; onClose: () => void }) {
  const [c, setC] = useState<Category>(cat);
  const [err, setErr] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const exists = db.categories.some((x) => x.id === cat.id);
  const inUse = db.assets.filter((a) => a.categoryId === cat.id).length;
  const setField = (i: number, patch: Partial<FieldDef>) => setC({ ...c, fields: c.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const save = async () => {
    if (!c.name.trim()) return setErr(tr("Name is required"));
    if (db.categories.some((x) => x.id !== c.id && x.name.toLowerCase() === c.name.trim().toLowerCase())) return setErr(tr("A category with this name exists"));
    if (c.fields.some((f) => !f.label.trim())) return setErr(tr("Every field needs a label"));
    await saveCategory({ ...c, name: c.name.trim(), fields: c.fields.map((f) => ({ ...f, label: f.label.trim(), options: f.type === 'dropdown' ? (f.options || []).filter(Boolean) : undefined })) });
    toast(exists ? tr("Category saved") : tr("Category created"), 'success');
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={600}
      title={exists ? tr('Edit {name}', { name: cat.name }) : tr("New category")}
      icon={<CategoryIcon category={c} size={12} />}
      footer={
        <>
          {exists && (
            <Button
              variant="ghost"
              className="me-auto !text-crit"
              icon={<Trash2 size={13} />}
              disabled={db.categories.length <= 1}
              onClick={async () => {
                const target = db.categories.find((x) => x.id !== cat.id)!;
                if (await confirm({ title: tr('Delete {name}?', { name: cat.name }), body: inUse ? tr('{n} assets will move to “{name}”.', { n: inUse, name: target.name }) : tr("No assets use this category."), danger: true, confirmLabel: tr("Delete") })) {
                  await deleteCategory(cat.id, target.id);
                  toast(tr("Category deleted"));
                  onClose();
                }
              }}
            >
              {tr("Delete")}
            </Button>
          )}
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button variant="primary" onClick={save}>
            {tr("Save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={tr("Name")} hint={err && <span className="text-crit">{err}</span>}>
          <Input autoFocus value={c.name} onChange={(e) => (setC({ ...c, name: e.target.value }), setErr(''))} placeholder={tr("Cloud Accounts")} />
        </Field>
        <div>
          <div className="label mb-1">{tr('Icon & color')}</div>
          <div className="flex flex-wrap gap-1">
            {Object.keys(CATEGORY_ICONS).map((k) => {
              const I = CATEGORY_ICONS[k];
              return (
                <button key={k} onClick={() => setC({ ...c, icon: k })} className={clsx('flex h-7 w-7 items-center justify-center rounded-[6px]', c.icon === k ? 'bg-ink/10 ring-1 ring-accent' : 'hov')} style={{ color: c.color }} title={k}>
                  <I size={14} />
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5">
            {CATEGORY_COLORS.map((col) => (
              <button key={col} onClick={() => setC({ ...c, color: col })} className={clsx('h-5 w-5 rounded-full', c.color === col && 'ring-2 ring-offset-2 ring-offset-surface')} style={{ background: col, ['--tw-ring-color' as any]: col }} aria-label={col} />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="label">{tr("Custom fields")}</span>
            <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => setC({ ...c, fields: [...c.fields, { id: uid(), label: '', type: 'text' }] })}>
              {tr("Add field")}
            </Button>
          </div>
          {c.fields.length === 0 ? (
            <div className="rounded-[8px] bg-bg px-3 py-3 text-center text-xs text-ink2">{tr("No custom fields. Add e.g. “Account ID”, “Region”, “Plan”.")}</div>
          ) : (
            <div className="space-y-1.5">
              {c.fields.map((f, i) => (
                <div key={f.id} className="rounded-[8px] bg-bg p-2">
                  <div className="flex items-center gap-1.5">
                    <Input value={f.label} placeholder={tr("Field label")} onChange={(e) => setField(i, { label: e.target.value })} />
                    <Select value={f.type} onChange={(e) => setField(i, { type: e.target.value as FieldType })} className="w-[150px] shrink-0">
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {tr(t.label)}
                        </option>
                      ))}
                    </Select>
                    <IconButton label={tr("Move up")} disabled={i === 0} onClick={() => setC({ ...c, fields: moveItem(c.fields, i, i - 1) })}>
                      <ArrowUp size={12} />
                    </IconButton>
                    <IconButton label={tr("Move down")} disabled={i === c.fields.length - 1} onClick={() => setC({ ...c, fields: moveItem(c.fields, i, i + 1) })}>
                      <ArrowDown size={12} />
                    </IconButton>
                    <IconButton label={tr("Remove field")} onClick={() => setC({ ...c, fields: c.fields.filter((_, j) => j !== i) })}>
                      <Trash2 size={12} />
                    </IconButton>
                  </div>
                  {f.type === 'dropdown' && <Input className="mt-1.5" placeholder={tr("Options, comma separated")} value={(f.options || []).join(', ')} onChange={(e) => setField(i, { options: e.target.value.split(',').map((x) => x.trim()) })} />}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-[8px] border p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{tr("Automatic renewal task")}</div>
              <div className="text-xs text-ink2">{tr("Create a task when an asset in this category gets an expiration date")}</div>
            </div>
            <Switch checked={!!c.autoTask?.enabled} onChange={(v) => setC({ ...c, autoTask: { daysBefore: 3, title: tr("Renew {name}"), ...c.autoTask, enabled: v } })} label={tr("Automatic renewal task")} />
          </div>
          {c.autoTask?.enabled && (
            <div className="mt-2 grid grid-cols-[1fr_120px] gap-2">
              <Field label={tr("Task title")} hint={tr("{name} is replaced by the asset name")}>
                <Input value={c.autoTask.title} onChange={(e) => setC({ ...c, autoTask: { ...c.autoTask!, title: e.target.value } })} />
              </Field>
              <Field label={tr("Days before")}>
                <Input type="number" min={0} value={c.autoTask.daysBefore} onChange={(e) => setC({ ...c, autoTask: { ...c.autoTask!, daysBefore: Math.max(0, Number(e.target.value) || 0) } })} />
              </Field>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DashboardSettings({ db }: { db: DB }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Group desc={tr("Reorder and hide the sections shown on the Overview.")}>
        {db.settings.dashboardSections.map((s) => (
          <Row key={s.id} label={tr({ expirations: 'Upcoming Expirations', today: "Today's Tasks", activity: 'Recent Activity', quick: 'Quick Access', monthly: 'Monthly Overview' }[s.id])}>
            <Switch checked={s.visible} onChange={(v) => updateSettings({ dashboardSections: db.settings.dashboardSections.map((x) => (x.id === s.id ? { ...x, visible: v } : x)) })} label={s.id} />
          </Row>
        ))}
      </Group>
      <Button onClick={() => setOpen(true)}>{tr("Reorder sections…")}</Button>
      {open && <CustomizeModal db={db} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShortcutSettings({ db }: { db: DB }) {
  const opts = ['mod+k', 'mod+shift+k', 'mod+p', 'mod+shift+p', 'mod+j', 'alt+space'];
  const list: [string, string[]][] = [
    ['Command palette', shortcutLabel(db.settings.paletteShortcut)],
    ['Focus global search', ['/']],
    ['New asset', ['N']],
    ['New task', ['T']],
    ['Go to section 1–7', ['1', '…', '7']],
    ['Save form', [...shortcutLabel('mod'), '↵']],
    ['Close dialog', ['Esc']],
  ];
  return (
    <>
      <Group title={tr("In NEXUS")}>
        <Row label={tr("Command palette shortcut")}>
          <Select value={db.settings.paletteShortcut} onChange={(e) => updateSettings({ paletteShortcut: e.target.value })} className="w-[170px]">
            {opts.map((o) => (
              <option key={o} value={o}>
                {shortcutLabel(o).join(' + ')}
              </option>
            ))}
          </Select>
        </Row>
        {list.map(([l, k]) => (
          <Row key={l} label={tr(l)}>
            <span className="flex gap-1">
              {k.map((x, i) => (
                <Kbd key={i}>{x}</Kbd>
              ))}
            </span>
          </Row>
        ))}
      </Group>
      <Group title={tr("Browser-wide")} desc={tr("Chrome manages global extension shortcuts. Defaults: Alt+Shift+N opens the popup, Alt+Shift+D opens this dashboard.")}>
        <Row label={tr("Change global shortcuts")}>
          <Button onClick={() => (hasChrome ? chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }) : undefined)} disabled={!hasChrome}>
            {tr("Open Chrome shortcuts")}
          </Button>
        </Row>
      </Group>
    </>
  );
}

function DataSettings({ db }: { db: DB }) {
  const toast = useToast();
  const confirm = useConfirm();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown; v: BackupValidation } | null>(null);
  const stamp = new Date().toISOString().slice(0, 10);
  const size = new Blob([JSON.stringify(db)]).size;

  const exportJSON = () => {
    downloadFile(`nexus-backup-${stamp}.json`, JSON.stringify({ app: 'nexus', version: db.version, exportedAt: new Date().toISOString(), data: db }, null, 2), 'application/json');
    toast(tr("Backup exported"), 'success');
  };
  const exportCSV = () => {
    downloadFile(`nexus-assets-${stamp}.csv`, '﻿' + assetsToCSV(db), 'text/csv;charset=utf-8');
    toast(tr("CSV exported (passwords excluded)"), 'success');
  };
  const onFile = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      setPending({ name: f.name, data, v: validateBackup(data) });
    } catch {
      setPending({ name: f.name, data: null, v: { ok: false, errors: ['File is not valid JSON.'] } });
    }
  };
  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace' && !(await confirm({ title: tr("Replace all data?"), body: tr("Current assets, tasks and providers will be replaced by the backup. Export first if unsure."), danger: true, confirmLabel: tr("Replace") }))) return;
    const res = await importData(unwrapBackup(pending.data), mode);
    if (mode === 'replace') lock(); // key material may have changed with the restored backup
    setPending(null);
    const dup = res.duplicates.assets + res.duplicates.tasks;
    toast(tr('Imported {a} assets, {t} tasks', { a: res.added.assets, t: res.added.tasks }) + (dup ? ` · ${tr('{n} duplicates skipped', { n: dup })}` : ''), 'success');
  };

  return (
    <>
      <Group title={tr("Storage")} desc={tr("Everything is kept in chrome.storage.local on this device. Nothing is sent to any server.")}>
        <Row label={tr('{a} assets · {t} tasks · {p} providers · {e} activity events', { a: db.assets.length, t: db.tasks.length, p: db.providers.length, e: db.activity.length })}>
          <Badge>{(size / 1024).toFixed(1)} {tr("KB")}</Badge>
        </Row>
      </Group>
      <Group title={tr("Export")}>
        <Row label={tr("JSON backup")} desc={tr("Complete backup including settings and history (encrypted fields stay encrypted)")}>
          <Button icon={<FileJson size={13} />} onClick={exportJSON}>
            {tr("Export JSON")}
          </Button>
        </Row>
        <Row label={tr("Assets as CSV")} desc={tr("For spreadsheets. Passwords and password fields are never included.")}>
          <Button icon={<FileSpreadsheet size={13} />} onClick={exportCSV} disabled={!db.assets.length}>
            {tr("Export CSV")}
          </Button>
        </Row>
      </Group>
      <Group title={tr("Import & restore")}>
        <Row label={tr("Import a NEXUS backup")} desc={tr("Validated before anything changes. Merge skips duplicates; Restore replaces everything.")}>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => (e.target.files?.[0] && onFile(e.target.files[0]), (e.target.value = ''))} />
          <Button icon={<Upload size={13} />} onClick={() => file.current?.click()}>
            {tr("Choose file…")}
          </Button>
        </Row>
      </Group>
      <Group title={tr("Sample data")}>
        <Row label={tr("Load sample data")} desc={tr("Adds example assets covering every expiration state. Merged with existing data; remove anytime.")}>
          <Button
            onClick={async () => {
              const r = await importData(sampleDB(), 'merge');
              toast(tr('Added {n} sample assets', { n: r.added.assets }), 'success');
            }}
          >
            {tr("Load samples")}
          </Button>
        </Row>
      </Group>
      <Group title={tr("Danger zone")}>
        <Row label={tr("Clear all data")} desc={tr("Deletes all assets, tasks, providers, categories and settings")}>
          <Button
            variant="danger"
            icon={<Trash2 size={13} />}
            onClick={async () => {
              if (!(await confirm({ title: tr("Clear all NEXUS data?"), body: tr("This permanently deletes everything stored by NEXUS on this device."), danger: true, confirmLabel: tr("Clear everything") }))) return;
              if (!(await confirm({ title: tr("Are you absolutely sure?"), body: tr("There is no undo. Consider exporting a backup first."), danger: true, confirmLabel: tr("Yes, delete") }))) return;
              await clearAllData();
              lock();
              toast(tr("All data cleared"));
            }}
          >
            {tr("Clear…")}
          </Button>
        </Row>
      </Group>
      {pending && (
        <Modal
          open
          onClose={() => setPending(null)}
          width={440}
          title={tr("Import backup")}
          icon={<Download size={14} className="text-accent" />}
          footer={
            pending.v.ok ? (
              <>
                <Button onClick={() => setPending(null)}>{tr("Cancel")}</Button>
                <Button onClick={() => doImport('replace')}>{tr("Restore (replace)")}</Button>
                <Button variant="primary" onClick={() => doImport('merge')}>
                  {tr("Merge")}
                </Button>
              </>
            ) : (
              <Button onClick={() => setPending(null)}>{tr("Close")}</Button>
            )
          }
        >
          <div className="text-sm">
            <div className="mb-2 font-medium">{pending.name}</div>
            {pending.v.ok ? (
              <>
                <div className="mb-2 flex items-center gap-1.5 text-ok">
                  <ShieldCheck size={14} /> {tr("Backup is valid")}
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-[8px] bg-bg p-2.5 text-xs">
                  <span>{tr("Assets:")} {pending.v.counts?.assets}</span>
                  <span>{tr("Tasks:")} {pending.v.counts?.tasks}</span>
                  <span>{tr("Providers:")} {pending.v.counts?.providers}</span>
                  <span>{tr("Categories:")} {pending.v.counts?.categories}</span>
                </div>
                <p className="mt-2 text-xs text-ink2">{tr("Merge keeps your data and adds new items; items with the same ID or same name + category + expiration are treated as duplicates and skipped.")}</p>
              </>
            ) : (
              <>
                <div className="mb-1 text-crit">{tr("This file can't be imported:")}</div>
                <ul className="list-disc ps-5 text-xs text-ink2">
                  {pending.v.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function PrivacySettings({ db }: { db: DB }) {
  const enc = db.settings.encryption;
  const toast = useToast();
  const confirm = useConfirm();
  const ui = useUI();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(isUnlocked());

  /** Walk every secret in the DB and transform it. */
  const transformSecrets = async (src: DB, fn: (v: string | any) => Promise<any>): Promise<DB> => {
    const next = structuredClone(src);
    const cats = new Map(next.categories.map((c) => [c.id, c]));
    for (const a of next.assets) {
      if (a.password) a.password = await fn(a.password);
      for (const f of cats.get(a.categoryId)?.fields || []) if (f.type === 'password' && a.custom[f.id]) a.custom[f.id] = await fn(a.custom[f.id]);
    }
    return next;
  };

  const enable = async () => {
    if (pw.length < 8) return toast(tr("Use at least 8 characters"), 'error');
    if (pw !== pw2) return toast(tr("Passphrases do not match"), 'error');
    setBusy(true);
    try {
      const salt = newSalt();
      const key = await deriveKey(pw, salt);
      const verifier = await makeVerifier(key);
      const cur = getDB()!;
      const next = await transformSecrets(cur, async (v) => (typeof v === 'string' ? encryptWith(key, v) : v));
      next.settings.encryption = { enabled: true, salt, verifier };
      await replaceAll(next);
      setSessionKey(key);
      setUnlocked(true);
      setPw('');
      setPw2('');
      toast(tr("Encryption enabled"), 'success');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!isUnlocked() && !(await ui.requestUnlock())) return;
    if (!(await confirm({ title: tr("Disable encryption?"), body: tr("Passwords will be stored in plain text in Chrome local storage."), danger: true, confirmLabel: tr("Disable") }))) return;
    setBusy(true);
    try {
      const key = getSessionKey()!;
      const next = await transformSecrets(getDB()!, async (v) => (isEncrypted(v) ? decryptWith(key, v) : v));
      next.settings.encryption = { enabled: false };
      await replaceAll(next);
      lock();
      setUnlocked(false);
      toast(tr("Encryption disabled"));
    } catch {
      toast(tr("Could not decrypt some values — nothing was changed"), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Group title={tr("Field encryption")} desc={tr("AES-256-GCM via the Web Crypto API with a key derived from your passphrase (PBKDF2, 310,000 iterations). The passphrase is never stored — if you forget it, encrypted values cannot be recovered.")}>
        {enc.enabled ? (
          <>
            <Row label={tr("Encryption is on")} desc={tr("Asset passwords and password-type custom fields are encrypted")}>
              <Badge color="#34C759">{tr("Enabled")}</Badge>
            </Row>
            <Row label={unlocked ? tr("Vault unlocked in this window") : tr("Vault locked")}>
              {unlocked ? (
                <Button icon={<Lock size={12} />} onClick={() => (lock(), setUnlocked(false), toast(tr("Locked")))}>
                  {tr("Lock now")}
                </Button>
              ) : (
                <Button icon={<Unlock size={12} />} onClick={async () => setUnlocked(await ui.requestUnlock())}>
                  {tr("Unlock")}
                </Button>
              )}
            </Row>
            <Row label={tr("Disable encryption")}>
              <Button variant="ghost" className="!text-crit" onClick={disable} disabled={busy}>
                {tr("Disable…")}
              </Button>
            </Row>
          </>
        ) : (
          <div className="space-y-2 p-3.5">
            <div className="grid grid-cols-2 gap-2">
              <Input type="password" placeholder={tr("Passphrase (8+ characters)")} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
              <Input type="password" placeholder={tr("Confirm passphrase")} value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enable()} autoComplete="new-password" />
            </div>
            <Button variant="primary" icon={<ShieldCheck size={13} />} onClick={enable} disabled={busy || !pw}>
              {tr("Enable encryption")}
            </Button>
          </div>
        )}
      </Group>
      <Group title={tr("How your data is stored")}>
        <div className="space-y-2 p-3.5 text-sm leading-relaxed text-ink2">
          <p>
            <b className="text-ink">{tr("Local only.")}</b> {tr("NEXUS stores data in")} <code className="rounded bg-ink/[0.06] px-1 text-xs">{tr("chrome.storage.local")}</code> {tr("and never contacts a server. It requests only the")} <i>{tr("storage")}</i>, <i>{tr("alarms")}</i> {tr("and")} <i>{tr("notifications")}</i> {tr("permissions — no host or tab access.")}
          </p>
          <p>
            <b className="text-ink">{tr("Not encrypted by default.")}</b> {tr("Chrome does not encrypt extension storage on its own. Anyone with access to your OS user account or Chrome profile folder could read unencrypted values. Enable field encryption above to protect passwords.")}
          </p>
          <p>
            <b className="text-ink">{tr("What's never exposed:")}</b> {tr("passwords are masked in the UI, excluded from CSV exports, activity history, search and notifications, and never written to logs.")}
          </p>
          <p>
            <b className="text-ink">{tr("Backups")}</b> {tr("(JSON) contain your data as stored — encrypted fields stay encrypted, plain fields are readable. Keep backup files somewhere safe.")}
          </p>
        </div>
      </Group>
    </>
  );
}

