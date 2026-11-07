import { Eye, EyeOff, Lock, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { createAsset, createProvider, updateAsset, type AssetInput } from '../lib/actions';
import { isEncrypted, isUnlocked, revealSecret, sealSecret } from '../lib/crypto';
import { countdownLabel, formatDate, isValidISODate } from '../lib/dates';
import { CURRENCIES } from '../lib/defaults';
import { renewalTaskFor } from '../lib/logic';
import type { Asset, Attachment, Category, DB, FieldDef, SecretValue } from '../lib/types';
import { parseTags, uid } from '../lib/util';
import { DateInput } from './DateInput';
import { CategoryIcon } from './icons';
import { Button, Checkbox, Field, Input, Modal, Select, Switch, Textarea, useToast } from './ui';
import { useUI } from './ui-context';

import { t as tr } from '../lib/i18n';
export function SecretInput({ value, onChange, disabled, placeholder }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} autoComplete="new-password" className="pe-8 font-mono" />
      <button type="button" className="absolute end-1.5 top-1/2 -translate-y-1/2 p-0.5 text-ink2 hover:text-ink" onClick={() => setShow(!show)} aria-label={show ? tr("Hide") : tr("Show")}>
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

type FormState = {
  name: string;
  categoryId: string;
  providerId: string;
  newProvider: string;
  status: Asset['status'];
  purchaseDate: string;
  expirationDate: string;
  purchasePrice: string;
  renewalPrice: string;
  currency: string;
  purchaseUrl: string;
  loginUrl: string;
  username: string;
  password: string;
  passwordTouched: boolean;
  tags: string;
  notes: string;
  custom: Record<string, any>;
  secretTouched: Record<string, boolean>;
  notificationsEnabled: boolean;
  customSchedule: boolean;
  reminderDays: string;
  attachments: Attachment[];
  createTask: boolean;
};

function initial(db: DB, a?: Asset, defaults?: Partial<Asset>): FormState {
  const src = a || (defaults as Asset | undefined);
  const custom: Record<string, any> = {};
  for (const [k, v] of Object.entries(src?.custom || {})) custom[k] = isEncrypted(v) ? '' : v;
  return {
    name: src?.name || '',
    categoryId: src?.categoryId || db.categories[0]?.id || '',
    providerId: src?.providerId || '',
    newProvider: '',
    status: src?.status || 'active',
    purchaseDate: src?.purchaseDate || '',
    expirationDate: src?.expirationDate || '',
    purchasePrice: src?.purchasePrice?.toString() ?? '',
    renewalPrice: src?.renewalPrice?.toString() ?? '',
    currency: src?.currency || db.settings.currency,
    purchaseUrl: src?.purchaseUrl || '',
    loginUrl: src?.loginUrl || '',
    username: src?.username || '',
    password: typeof src?.password === 'string' ? src.password : '',
    passwordTouched: false,
    tags: (src?.tags || []).join(', '),
    notes: src?.notes || '',
    custom,
    secretTouched: {},
    notificationsEnabled: src?.notificationsEnabled !== false,
    customSchedule: !!(src?.reminderDays && src.reminderDays.length),
    reminderDays: (src?.reminderDays && src.reminderDays.length ? src.reminderDays : db.settings.reminderDays).join(', '),
    attachments: src?.attachments || [],
    createTask: false,
  };
}

export function AssetForm({ db, assetId, defaults, onClose }: { db: DB; assetId?: string; defaults?: Partial<Asset>; onClose: () => void }) {
  const existing = assetId ? db.assets.find((a) => a.id === assetId) : undefined;
  const [f, setF] = useState<FormState>(() => initial(db, existing, defaults));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const ui = useUI();
  const encOn = db.settings.encryption.enabled;
  const [unlocked, setUnlocked] = useState(isUnlocked());
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const cat: Category | undefined = db.categories.find((c) => c.id === f.categoryId);

  // decrypt existing secrets for editing when unlocked
  useEffect(() => {
    if (!existing) return;
    (async () => {
      const pw = await revealSecret(existing.password);
      if (pw !== null) setF((s) => ({ ...s, password: pw }));
      const updates: Record<string, string> = {};
      for (const fd of cat?.fields || []) {
        if (fd.type !== 'password') continue;
        const v = existing.custom[fd.id];
        if (isEncrypted(v) || typeof v === 'string') {
          const p = await revealSecret(v as SecretValue);
          if (p !== null) updates[fd.id] = p;
        }
      }
      if (Object.keys(updates).length) setF((s) => ({ ...s, custom: { ...s.custom, ...updates } }));
    })();
  }, [unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // default the "create renewal task" checkbox from the category / global rule
  useEffect(() => {
    if (existing) return;
    const wants = !!cat?.autoTask?.enabled || db.settings.autoRenewalTask;
    setF((s) => ({ ...s, createTask: wants }));
  }, [f.categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const lockedSecrets = encOn && !unlocked;
  const secretLockedExisting = (v: unknown) => lockedSecrets && !!v;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = tr("Name is required");
    if (!f.categoryId) e.categoryId = tr("Choose a category");
    if (f.expirationDate && !isValidISODate(f.expirationDate)) e.expirationDate = tr("Invalid date");
    if (f.purchaseDate && !isValidISODate(f.purchaseDate)) e.purchaseDate = tr("Invalid date");
    if (f.purchasePrice && Number.isNaN(Number(f.purchasePrice))) e.purchasePrice = tr("Not a number");
    if (f.renewalPrice && Number.isNaN(Number(f.renewalPrice))) e.renewalPrice = tr("Not a number");
    if (f.customSchedule && !f.reminderDays.split(',').every((x) => /^\s*\d+\s*$/.test(x))) e.reminderDays = tr("Use comma-separated whole days, e.g. 30, 7, 1, 0");
    for (const fd of cat?.fields || []) {
      const v = f.custom[fd.id];
      if (fd.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(String(v))) e['c_' + fd.id] = tr("Invalid email");
      if (fd.type === 'number' && v !== '' && v !== undefined && Number.isNaN(Number(v))) e['c_' + fd.id] = tr("Not a number");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let providerId = f.providerId || undefined;
      if (f.providerId === '__new' && f.newProvider.trim()) {
        const p = await createProvider({ name: f.newProvider.trim(), website: '', dashboardUrl: '', supportUrl: '', contact: '', notes: '' });
        providerId = p.id;
      } else if (f.providerId === '__new') providerId = undefined;

      // secrets: keep existing encrypted value if vault is locked and user didn't change it
      let password: SecretValue | undefined;
      // untouched secrets are kept byte-for-byte (no re-encryption, no false "password changed" history)
      if (existing && !f.passwordTouched) password = existing.password;
      else password = await sealSecret(f.password, encOn);

      const custom: Asset['custom'] = {};
      for (const fd of cat?.fields || []) {
        const v = f.custom[fd.id];
        if (fd.type === 'password') {
          if (existing && !f.secretTouched[fd.id] && existing.custom[fd.id] !== undefined) custom[fd.id] = existing.custom[fd.id];
          else custom[fd.id] = await sealSecret(v ? String(v) : '', encOn);
        } else if (fd.type === 'number') custom[fd.id] = v === '' || v === undefined ? undefined : Number(v);
        else if (fd.type === 'checkbox') custom[fd.id] = !!v;
        else custom[fd.id] = v ?? '';
      }
      const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
      const data: AssetInput = {
        name: f.name.trim(),
        categoryId: f.categoryId,
        providerId,
        status: f.status,
        purchaseDate: f.purchaseDate || undefined,
        expirationDate: f.expirationDate || undefined,
        purchasePrice: num(f.purchasePrice),
        renewalPrice: num(f.renewalPrice),
        currency: f.currency,
        purchaseUrl: f.purchaseUrl.trim(),
        loginUrl: f.loginUrl.trim(),
        username: f.username.trim(),
        password,
        tags: parseTags(f.tags),
        notes: f.notes,
        custom,
        attachments: f.attachments.filter((x) => x.url.trim()),
        notificationsEnabled: f.notificationsEnabled,
        reminderDays: f.customSchedule ? f.reminderDays.split(',').map((x) => parseInt(x, 10)).filter((n) => n >= 0) : null,
        snoozedUntil: existing?.snoozedUntil,
      };
      if (existing) {
        await updateAsset(existing.id, data);
        toast(tr("Asset updated"), 'success');
        onClose();
      } else {
        const a = await createAsset(data, { createRenewalTask: f.createTask && !!data.expirationDate });
        toast(tr('{name} added', { name: a.name }), 'success', { label: tr("Open"), onClick: () => ui.openAsset(a.id) });
        onClose();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : tr("Could not save"), 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewTask = useMemo(() => {
    if (existing || !f.createTask || !f.expirationDate || !isValidISODate(f.expirationDate)) return null;
    return renewalTaskFor({ name: f.name || 'asset', expirationDate: f.expirationDate } as Asset, cat, { ...db.settings, autoRenewalTask: true });
  }, [f.createTask, f.expirationDate, f.name, cat, db.settings, existing]);

  const renderCustom = (fd: FieldDef) => {
    const v = f.custom[fd.id];
    const setV = (x: any) => setF((s) => ({ ...s, custom: { ...s.custom, [fd.id]: x }, secretTouched: fd.type === 'password' ? { ...s.secretTouched, [fd.id]: true } : s.secretTouched }));
    const err = errors['c_' + fd.id];
    const wrap = (el: React.ReactNode, wide = false) => (
      <Field key={fd.id} label={fd.label} hint={err && <span className="text-crit">{err}</span>} className={wide ? 'col-span-2' : ''}>
        {el}
      </Field>
    );
    switch (fd.type) {
      case 'textarea':
        return wrap(<Textarea value={v ?? ''} onChange={(e) => setV(e.target.value)} rows={2} />, true);
      case 'checkbox':
        return (
          <div key={fd.id} className="flex items-end pb-1">
            <Checkbox checked={!!v} onChange={setV} label={fd.label} />
          </div>
        );
      case 'dropdown':
        return wrap(
          <Select value={v ?? ''} onChange={(e) => setV(e.target.value)}>
            <option value="">—</option>
            {(fd.options || []).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>,
        );
      case 'password':
        return wrap(
          secretLockedExisting(existing?.custom[fd.id]) && !f.secretTouched[fd.id] ? (
            <LockedSecret onUnlock={async () => setUnlocked(await ui.requestUnlock())} />
          ) : (
            <SecretInput value={v ?? ''} onChange={setV} disabled={lockedSecrets} placeholder={lockedSecrets ? tr("Unlock vault to set") : ''} />
          ),
        );
      default:
        if (fd.type === 'date') return wrap(<DateInput value={v ?? ''} onChange={setV} />);
        return wrap(<Input type={fd.type === 'number' ? 'text' : fd.type} inputMode={fd.type === 'number' ? 'decimal' : undefined} value={v ?? ''} onChange={(e) => setV(e.target.value)} />);
    }
  };

  const err = (k: string) => errors[k] && <span className="text-crit">{errors[k]}</span>;

  return (
    <Modal
      open
      onClose={onClose}
      width={640}
      title={existing ? tr('Edit {name}', { name: existing.name }) : tr("New Asset")}
      icon={<CategoryIcon category={cat} size={12} />}
      footer={
        <>
          <span className="me-auto text-xs text-ink2">{f.expirationDate && isValidISODate(f.expirationDate) ? countdownLabel(f.expirationDate) : ''}</span>
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {existing ? tr("Save") : tr("Add Asset")}
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-x-3 gap-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save();
        }}
      >
        <Field label={tr("Name")} className="col-span-2" hint={err('name')}>
          <Input autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={tr("example.com, Hetzner CX22, Figma Pro…")} />
        </Field>
        <Field label={tr("Category")} hint={err('categoryId')}>
          <Select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr("Provider")}>
          <Select value={f.providerId} onChange={(e) => set('providerId', e.target.value)}>
            <option value="">{tr("None")}</option>
            {db.providers
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            <option value="__new">{tr("+ New provider…")}</option>
          </Select>
        </Field>
        {f.providerId === '__new' && (
          <Field label={tr("New provider name")} className="col-span-2">
            <Input autoFocus value={f.newProvider} onChange={(e) => set('newProvider', e.target.value)} placeholder={tr("e.g. Cloudflare")} />
          </Field>
        )}

        <div className="col-span-2 mt-1 section-title">{tr('Dates & pricing')}</div>
        <Field label={tr("Purchase date")} hint={err('purchaseDate')}>
          <DateInput value={f.purchaseDate} onChange={(v) => set('purchaseDate', v)} />
        </Field>
        <Field label={tr("Expiration date")} hint={err('expirationDate')}>
          <DateInput value={f.expirationDate} onChange={(v) => set('expirationDate', v)} />
        </Field>
        <div className="col-span-2 grid grid-cols-3 gap-3">
          <Field label={tr("Purchase price")} hint={err('purchasePrice')}>
            <Input inputMode="decimal" value={f.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label={tr("Renewal price")} hint={err('renewalPrice')}>
            <Input inputMode="decimal" value={f.renewalPrice} onChange={(e) => set('renewalPrice', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label={tr("Currency")}>
            <Select value={f.currency} onChange={(e) => set('currency', e.target.value)}>
              {Array.from(new Set([f.currency, ...CURRENCIES])).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={tr("Status")}>
          <Select value={f.status} onChange={(e) => set('status', e.target.value as Asset['status'])}>
            <option value="active">{tr("Active")}</option>
            <option value="paused">{tr("Paused")}</option>
            <option value="cancelled">{tr("Cancelled")}</option>
          </Select>
        </Field>
        <Field label={tr("Tags")} hint={tr("Comma separated")}>
          <Input value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder={tr("client, production")} />
        </Field>

        <div className="col-span-2 mt-1 section-title">{tr("Access")}</div>
        <Field label={tr("Login URL")}>
          <Input value={f.loginUrl} onChange={(e) => set('loginUrl', e.target.value)} placeholder={tr("https://…")} />
        </Field>
        <Field label={tr("Purchase website")}>
          <Input value={f.purchaseUrl} onChange={(e) => set('purchaseUrl', e.target.value)} placeholder={tr("https://…")} />
        </Field>
        <Field label={tr("Username")}>
          <Input value={f.username} onChange={(e) => set('username', e.target.value)} autoComplete="off" />
        </Field>
        <Field label={tr("Password (optional)")} hint={encOn ? tr("Encrypted with your vault passphrase") : tr("Stored locally, unencrypted — enable encryption in Settings › Privacy")}>
          {secretLockedExisting(existing?.password) && !f.passwordTouched ? (
            <LockedSecret onUnlock={async () => setUnlocked(await ui.requestUnlock())} />
          ) : (
            <SecretInput value={f.password} onChange={(v) => setF((s) => ({ ...s, password: v, passwordTouched: true }))} disabled={lockedSecrets} placeholder={lockedSecrets ? tr("Unlock vault to set") : ''} />
          )}
        </Field>

        {cat && cat.fields.length > 0 && (
          <>
            <div className="col-span-2 mt-1 flex items-center gap-2 section-title">
              {tr('{name} fields', { name: cat.name })}
            </div>
            {cat.fields.map(renderCustom)}
          </>
        )}

        <div className="col-span-2 mt-1 section-title">{tr('Notes & attachments')}</div>
        <Field label={tr("Notes")} className="col-span-2">
          <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </Field>
        <div className="col-span-2 space-y-1.5">
          {f.attachments.map((at, i) => (
            <div key={at.id} className="flex gap-2">
              <Input value={at.name} placeholder={tr("Label (invoice, contract…)")} onChange={(e) => set('attachments', f.attachments.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="w-1/3" />
              <Input value={at.url} placeholder={tr("Link to file (Drive, Dropbox, local path…)")} onChange={(e) => set('attachments', f.attachments.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <Button variant="ghost" onClick={() => set('attachments', f.attachments.filter((_, j) => j !== i))} aria-label={tr("Remove attachment")}>
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" icon={<Plus size={12} />} onClick={() => set('attachments', [...f.attachments, { id: uid(), name: '', url: '' }])}>
            {tr("Add attachment link")}
          </Button>
        </div>

        <div className="col-span-2 mt-1 section-title">{tr("Reminders")}</div>
        <div className="col-span-2 space-y-2 rounded-[8px] bg-bg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">{tr("Expiration notifications")}</span>
            <Switch checked={f.notificationsEnabled} onChange={(v) => set('notificationsEnabled', v)} label={tr("Expiration notifications")} />
          </div>
          {f.notificationsEnabled && (
            <div className="flex items-center gap-3">
              <Checkbox checked={f.customSchedule} onChange={(v) => set('customSchedule', v)} label={tr("Custom schedule")} />
              {f.customSchedule ? (
                <div className="flex-1">
                  <Input value={f.reminderDays} onChange={(e) => set('reminderDays', e.target.value)} placeholder="30, 15, 7, 3, 1, 0" />
                  {errors.reminderDays && <div className="mt-1 text-2xs text-crit">{errors.reminderDays}</div>}
                </div>
              ) : (
                <span className="text-xs text-ink2">{tr("Default:")} {db.settings.reminderDays.join(', ')} {tr("days before")}</span>
              )}
            </div>
          )}
          {!existing && (
            <div>
              <Checkbox checked={f.createTask} onChange={(v) => set('createTask', v)} label={tr("Create a renewal task")} />
              {previewTask && <div className="ms-6 mt-0.5 text-xs text-ink2">{tr('“{title}” due {date}', { title: previewTask.title, date: formatDate(previewTask.dueDate) })}</div>}
              {f.createTask && !f.expirationDate && <div className="ms-6 mt-0.5 text-xs text-ink2">{tr("Needs an expiration date.")}</div>}
            </div>
          )}
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function LockedSecret({ onUnlock }: { onUnlock: () => void }) {
  return (
    <button type="button" onClick={onUnlock} className="input flex items-center gap-2 text-start text-ink2">
      <Lock size={12} /> ••••••••  <span className="ms-auto text-xs text-accent">{tr("Unlock")}</span>
    </button>
  );
}
