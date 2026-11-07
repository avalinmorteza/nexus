import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calAddMonths, calParts, getCalendar, isValidISODate, monthMatrix, monthName, todayISO, weekdayName } from '../lib/dates';
import { displayDate as display, parseDateInput } from '../lib/dateparse';
import { t } from '../lib/i18n';
import { getDB } from '../lib/store';
import { clsx } from '../lib/util';
import { useEscape } from './ui';

export function DateInput({ value, onChange, placeholder, className, autoFocus }: { value: string; onChange: (iso: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(display(value));
  const [open, setOpen] = useState(false);
  const [bad, setBad] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setText(display(value));
    setBad(false);
  }, [value]);

  const commit = () => {
    if (!text.trim()) {
      if (value) onChange('');
      setBad(false);
      return;
    }
    const iso = parseDateInput(text);
    if (iso) {
      setBad(false);
      if (iso !== value) onChange(iso);
      setText(display(iso));
    } else setBad(true);
  };

  return (
    <div ref={wrap} className={clsx('relative', className)}>
      <input
        className={clsx('input pe-14 tabular', bad && '!shadow-[inset_0_0_0_1px_rgb(var(--crit))]')}
        value={text}
        dir="ltr"
        autoFocus={autoFocus}
        placeholder={placeholder ?? (getCalendar() === 'jalali' ? '1405/01/01' : 'YYYY/MM/DD')}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'ArrowDown' && e.altKey) setOpen(true);
        }}
        style={{ textAlign: 'start' }}
      />
      <div className="absolute end-1 top-1/2 flex -translate-y-1/2 items-center">
        {value && (
          <button type="button" className="p-1 text-ink3 hover:text-ink" onClick={() => onChange('')} aria-label={t('Clear')}>
            <X size={11} />
          </button>
        )}
        <button type="button" className="p-1 text-ink2 hover:text-accent" onClick={() => setOpen(!open)} aria-label={t('Open calendar')}>
          <CalendarDays size={13} />
        </button>
      </div>
      {bad && <div className="mt-0.5 text-2xs text-crit">{t('Invalid date')}</div>}
      {open && <Picker anchor={wrap.current!} value={value} onPick={(iso) => (onChange(iso), setOpen(false))} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Picker({ anchor, value, onPick, onClose }: { anchor: HTMLElement; value: string; onPick: (iso: string) => void; onClose: () => void }) {
  const today = todayISO();
  const base = calParts(isValidISODate(value) ? value : today);
  const [ym, setYm] = useState({ y: base.y, m: base.m });
  const ref = useRef<HTMLDivElement>(null);
  const ws = getDB()?.settings.weekStart ?? 1;
  useEscape(onClose);
  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect();
    const el = ref.current!;
    const h = el.offsetHeight;
    const top = r.bottom + 4 + h > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    const left = Math.min(Math.max(8, document.documentElement.dir === 'rtl' ? r.right - el.offsetWidth : r.left), window.innerWidth - el.offsetWidth - 8);
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [anchor, ym]);
  const nav = (n: number) => setYm(calAddMonths(ym.y, ym.m, n));
  const weeks = monthMatrix(ym.y, ym.m, ws);
  return createPortal(
    <div className="fixed inset-0 z-[90]" onMouseDown={onClose}>
      <div ref={ref} className="fixed w-[248px] rounded-[10px] border bg-surface p-2 shadow-pop animate-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-1">
          <button type="button" className="rounded-[6px] p-1 text-ink2 hov" onClick={() => nav(-1)} aria-label={t('Previous')}>
            <ChevronLeft size={14} className="rtl:rotate-180" />
          </button>
          <div className="flex-1 text-center text-sm font-semibold">
            {monthName(ym.m)} {ym.y}
          </div>
          <button type="button" className="rounded-[6px] p-1 text-ink2 hov" onClick={() => nav(1)} aria-label={t('Next')}>
            <ChevronRight size={14} className="rtl:rotate-180" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-2xs text-ink2">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="py-1">
              {weekdayName((i + ws) % 7, true)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {weeks.flat().map((iso) => {
            const p = calParts(iso);
            const inMonth = p.m === ym.m;
            const sel = iso === value;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onPick(iso)}
                className={clsx(
                  'h-7 rounded-[6px] text-xs tabular transition-colors',
                  sel ? 'bg-accent font-semibold text-white' : iso === today ? 'font-semibold text-crit hov' : inMonth ? 'text-ink hov' : 'text-ink3 hov',
                )}
                title={iso}
              >
                {p.d}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex items-center justify-between border-t pt-1.5">
          <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => onPick(today)}>
            {t('Today')}
          </button>
          <span className="text-2xs text-ink3" dir="ltr">
            {isValidISODate(value) ? (getCalendar() === 'jalali' ? value : display(value)) : ''}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Date + time (for task reminders). Value is 'YYYY-MM-DDTHH:mm' local, like datetime-local. */
export function DateTimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [d, tm] = value ? value.split('T') : ['', ''];
  return (
    <div className="flex gap-1">
      <DateInput className="flex-1" value={d || ''} onChange={(iso) => onChange(iso ? `${iso}T${tm || '09:00'}` : '')} />
      <input type="time" dir="ltr" className="input w-[92px]" value={tm || ''} disabled={!d} onChange={(e) => onChange(d ? `${d}T${e.target.value || '09:00'}` : '')} />
    </div>
  );
}

