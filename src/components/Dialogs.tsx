import { KeyRound, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { createProvider, renewAsset, updateProvider } from '../lib/actions';
import { unlock } from '../lib/crypto';
import { addMonths, addYears, countdownLabel, daysUntil, formatDate, isValidISODate, todayISO } from '../lib/dates';
import type { DB } from '../lib/types';
import { money } from '../lib/util';
import { DateInput } from './DateInput';
import { Button, Checkbox, Field, Input, Modal, Textarea, useToast } from './ui';

import { t as tr } from '../lib/i18n';
export function RenewDialog({ db, assetId, onClose }: { db: DB; assetId: string; onClose: () => void }) {
  const a = db.assets.find((x) => x.id === assetId);
  const today = todayISO();
  // renew from the current expiration, or from today if it already lapsed
  const base = a?.expirationDate && isValidISODate(a.expirationDate) && daysUntil(a.expirationDate, today) >= 0 ? a.expirationDate : today;
  const [date, setDate] = useState(addYears(base, 1));
  const [price, setPrice] = useState(a?.renewalPrice?.toString() ?? '');
  const [note, setNote] = useState('');
  const openTasks = db.tasks.filter((t) => t.assetId === assetId && !t.done && (t.autoRenewal || /renew/i.test(t.title)));
  const [complete, setComplete] = useState(true);
  const toast = useToast();
  if (!a) return null;
  const save = async () => {
    if (!isValidISODate(date)) return toast(tr("Choose a valid date"), 'error');
    await renewAsset(a.id, { newExpiration: date, newPrice: price.trim() === '' ? undefined : Number(price), note: note.trim() || undefined, completeTasks: openTasks.length > 0 && complete });
    toast(tr('{name} renewed until {date}', { name: a.name, date: formatDate(date, db.settings.dateFormat) }), 'success');
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={440}
      title={tr('Mark {name} as renewed', { name: a.name })}
      icon={<RefreshCw size={14} className="text-ok" />}
      footer={
        <>
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button variant="primary" onClick={save}>
            {tr("Renew")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-[8px] bg-bg px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink2">{tr("Current expiration")}</span>
            <span className="font-medium">{formatDate(a.expirationDate, db.settings.dateFormat)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink2">{tr("Current renewal price")}</span>
            <span className="font-medium">{money(a.renewalPrice ?? a.purchasePrice, a.currency)}</span>
          </div>
        </div>
        <Field label={tr("New expiration date")} hint={isValidISODate(date) ? countdownLabel(date) : undefined}>
          <DateInput value={date} onChange={setDate} autoFocus />
        </Field>
        <div className="flex gap-1.5">
          {[
            ['+1 month', addMonths(base, 1)],
            ['+3 months', addMonths(base, 3)],
            ['+1 year', addYears(base, 1)],
            ['+2 years', addYears(base, 2)],
          ].map(([l, d]) => (
            <Button key={l} size="sm" variant={date === d ? 'primary' : 'secondary'} onClick={() => setDate(d)}>
              {l}
            </Button>
          ))}
        </div>
        <Field label={`${tr('Renewal price')} (${a.currency})`} hint={tr("Leave as-is to keep the current price")}>
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label={tr("Note")}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Order #, payment method…")} />
        </Field>
        {openTasks.length > 0 && (
          <div className="rounded-[8px] border border-accent/20 bg-accent/[0.06] p-2.5">
            <Checkbox checked={complete} onChange={setComplete} label={tr(openTasks.length > 1 ? tr("Complete related renewal tasks?") : tr("Complete related renewal task?"))} />
            <ul className="ms-6 mt-1 text-xs text-ink2">
              {openTasks.map((t) => (
                <li key={t.id}>• {t.title}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-ink2">{tr("The previous expiration and price are kept in this asset's renewal history.")}</p>
      </div>
    </Modal>
  );
}

export function ProviderForm({ db, providerId, onClose, onCreated }: { db: DB; providerId?: string; onClose: () => void; onCreated?: (id: string) => void }) {
  const p = providerId ? db.providers.find((x) => x.id === providerId) : undefined;
  const [f, setF] = useState({
    name: p?.name || '',
    website: p?.website || '',
    dashboardUrl: p?.dashboardUrl || '',
    supportUrl: p?.supportUrl || '',
    contact: p?.contact || '',
    notes: p?.notes || '',
  });
  const [err, setErr] = useState('');
  const toast = useToast();
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return setErr(tr("Name is required"));
    if (!p && db.providers.some((x) => x.name.toLowerCase() === f.name.trim().toLowerCase())) return setErr(tr("A provider with this name already exists"));
    const data = { ...f, name: f.name.trim() };
    if (p) await updateProvider(p.id, data);
    else {
      const created = await createProvider(data);
      onCreated?.(created.id);
    }
    toast(p ? tr("Provider updated") : tr("Provider added"), 'success');
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={480}
      title={p ? tr('Edit {name}', { name: p.name }) : tr("New Provider")}
      footer={
        <>
          <Button onClick={onClose}>{tr("Cancel")}</Button>
          <Button variant="primary" onClick={save}>
            {p ? tr("Save") : tr("Add Provider")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3" onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && save()}>
        <Field label={tr("Name")} className="col-span-2" hint={err && <span className="text-crit">{err}</span>}>
          <Input autoFocus value={f.name} onChange={(e) => (set('name', e.target.value), setErr(''))} placeholder={tr("Cloudflare")} />
        </Field>
        <Field label={tr("Website")}>
          <Input value={f.website} onChange={(e) => set('website', e.target.value)} placeholder={tr("cloudflare.com")} />
        </Field>
        <Field label={tr("Dashboard URL")}>
          <Input value={f.dashboardUrl} onChange={(e) => set('dashboardUrl', e.target.value)} placeholder={tr("https://dash.cloudflare.com")} />
        </Field>
        <Field label={tr("Support URL")}>
          <Input value={f.supportUrl} onChange={(e) => set('supportUrl', e.target.value)} />
        </Field>
        <Field label={tr("Contact")}>
          <Input value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder={tr("support@… / phone")} />
        </Field>
        <Field label={tr("Notes")} className="col-span-2">
          <Textarea rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function UnlockDialog({ db, onDone }: { db: DB; onDone: (ok: boolean) => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const enc = db.settings.encryption;
  const go = async () => {
    if (!enc.salt || !enc.verifier) return onDone(false);
    setBusy(true);
    const ok = await unlock(pw, enc.salt, enc.verifier);
    setBusy(false);
    if (ok) onDone(true);
    else setErr(tr("Incorrect passphrase"));
  };
  return (
    <Modal
      open
      onClose={() => onDone(false)}
      width={360}
      title={tr("Unlock vault")}
      icon={<KeyRound size={14} className="text-accent" />}
      footer={
        <>
          <Button onClick={() => onDone(false)}>{tr("Cancel")}</Button>
          <Button variant="primary" onClick={go} disabled={busy || !pw}>
            {busy ? tr("Unlocking…") : tr("Unlock")}
          </Button>
        </>
      }
    >
      <Field label={tr("Passphrase")} hint={err ? <span className="text-crit">{err}</span> : tr("Encrypted fields stay locked until you unlock them in this window.")}>
        <Input type="password" autoFocus value={pw} onChange={(e) => (setPw(e.target.value), setErr(''))} onKeyDown={(e) => e.key === 'Enter' && go()} />
      </Field>
    </Modal>
  );
}
