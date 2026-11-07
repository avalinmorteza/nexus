import { Check, ChevronDown, X } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { countdownLabel, expiryStatus, shortCountdown } from '../lib/dates';
import { highlightParts } from '../lib/search';
import type { ExpiryStatus, ISODate } from '../lib/types';
import { clsx } from '../lib/util';

import { t as tr } from '../lib/i18n';
/* ---------------- Buttons ---------------- */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'plain';
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium transition-all duration-100 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40 select-none',
        size === 'sm' ? 'h-7 px-2.5 text-xs rounded-[8px]' : 'h-9 px-4 text-sm',
        variant === 'primary' && 'bg-accent text-white shadow-[0_1px_2px_rgba(0,0,0,.14),0_4px_12px_-4px_rgb(var(--accent)/0.5),inset_0_1px_0_rgba(255,255,255,.18)] hover:brightness-110',
        variant === 'secondary' && 'bg-surface text-ink shadow-[0_0_0_1px_rgb(var(--line)/0.1),0_1px_2px_rgb(0_0_0/0.04)] hover:bg-surface2',
        variant === 'ghost' && 'text-ink2 hov hover:text-ink',
        variant === 'danger' && 'bg-crit text-white hover:brightness-110',
        variant === 'plain' && 'text-accent hover:underline px-0 h-auto',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, active, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-ink2 transition-colors hov hover:text-ink disabled:opacity-40', active && 'sel !text-accent', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Inputs ---------------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={clsx('input', className)} {...p} />
));

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={clsx('input resize-y', className)} rows={3} {...p} />
));

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx('relative', className)}>
      <select className="input appearance-none pe-7 cursor-pointer" {...p}>
        {children}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-ink2" />
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('flex flex-col gap-1', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-2xs text-ink2">{hint}</span>}
    </label>
  );
}

export function Checkbox({ checked, onChange, label, className, round, color }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; className?: string; round?: boolean; color?: string }) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-2 select-none', className)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'flex h-[17px] w-[17px] shrink-0 items-center justify-center border-[1.5px] transition-all duration-150',
          round ? 'rounded-full h-[19px] w-[19px]' : 'rounded-[5px]',
          checked ? 'border-transparent text-white' : 'border-ink3 bg-surface hover:border-ink2',
        )}
        style={checked ? { background: color || 'rgb(var(--accent))' } : round && color ? { borderColor: color } : undefined}
      >
        {checked && <Check size={round ? 11 : 10} strokeWidth={3.5} />}
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40', checked ? 'bg-ok' : 'bg-ink3/50')}
    >
      {/* anchored at the start edge; buttons center content, so an unanchored knob drifts to the middle */}
      {/* logical inset (start) mirrors automatically in RTL */}
      <span className={clsx('absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-all duration-200', checked ? 'start-[18px]' : 'start-[2px]')} />
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; title?: string }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex rounded-[10px] bg-ink/[0.055] p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex items-center gap-1.5 rounded-[8px] font-medium transition-all',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-[30px] px-3 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.12)]' : 'text-ink2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-line/10 bg-surface2 px-1 font-sans text-[10.5px] font-medium text-ink2">{children}</kbd>;
}

/* ---------------- Status ---------------- */

export const STATUS_STYLE: Record<ExpiryStatus, { dot: string; text: string; bg: string; label: string }> = {
  normal: { dot: 'bg-ok', text: 'text-[#1f8a3e] dark:text-ok', bg: 'bg-ok/[0.1]', label: 'Normal' },
  warning: { dot: 'bg-warn', text: 'text-warn-ink', bg: 'bg-warn/[0.14]', label: 'Expiring' },
  critical: { dot: 'bg-crit', text: 'text-crit', bg: 'bg-crit/10', label: 'Critical' },
  expired: { dot: 'bg-expired', text: 'text-expired', bg: 'bg-expired/10', label: 'Expired' },
  none: { dot: 'bg-ink3', text: 'text-ink2', bg: 'bg-ink/[0.05]', label: 'No date' },
};

export function StatusDot({ status, pulse }: { status: ExpiryStatus; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && status === 'critical' && <span className="absolute inset-0 animate-ping rounded-full bg-crit opacity-50" />}
      <span className={clsx('relative inline-flex h-2 w-2 rounded-full', STATUS_STYLE[status].dot)} />
    </span>
  );
}

export function Countdown({ date, today, short, className }: { date?: ISODate; today: ISODate; short?: boolean; className?: string }) {
  const s = expiryStatus(date, today);
  const st = STATUS_STYLE[s];
  return (
    <span className={clsx('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium tabular', st.text, st.bg, className)}>
      <StatusDot status={s} />
      {short ? shortCountdown(date, today) : countdownLabel(date, today)}
    </span>
  );
}

export function Badge({ children, color, className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={clsx('inline-flex h-[18px] items-center rounded-[5px] px-1.5 text-[11px] font-medium', !color && 'bg-ink/[0.06] text-ink2', className)}
      style={color ? { background: `${color}1f`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function Highlight({ text, query }: { text: string; query: string }) {
  const p = highlightParts(text, query);
  if (!p) return <>{text}</>;
  return (
    <>
      {p.pre}
      <mark className="rounded-[3px] bg-warn/40 px-[1px] text-ink">{p.hit}</mark>
      {p.post}
    </>
  );
}

/* ---------------- Empty / skeleton ---------------- */

export function EmptyState({ icon, title, body, action, compact }: { icon: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', compact ? 'py-6' : 'py-16')}>
      <div className={clsx('mb-3 flex items-center justify-center rounded-2xl bg-gradient-to-b from-ink/[0.04] to-ink/[0.08] text-ink2', compact ? 'h-10 w-10' : 'h-14 w-14')}>{icon}</div>
      <div className={clsx('font-semibold', compact ? 'text-sm' : 'text-[15px]')}>{title}</div>
      {body && <div className="mt-1 max-w-[320px] text-sm text-ink2">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

/* ---------------- Overlay primitives ---------------- */

/**
 * Escape handling is a stack: only the top-most overlay (last opened) closes, so a dialog
 * opened on top of the detail drawer doesn't close both.
 */
const escStack: { current: () => void }[] = [];
if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !escStack.length) return;
      e.preventDefault();
      e.stopPropagation();
      escStack[escStack.length - 1].current();
    },
    true,
  );
}

export function useEscape(onClose: () => void, active = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => ref.current() };
    escStack.push(entry);
    return () => {
      const i = escStack.indexOf(entry);
      if (i >= 0) escStack.splice(i, 1);
    };
  }, [active]);
}

export function Modal({ open, onClose, title, children, footer, width = 520, icon }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number; icon?: React.ReactNode }) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/25 p-4 pt-[8vh] animate-fade dark:bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[84vh] w-full flex-col rounded-[12px] bg-surface shadow-pop animate-in" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
          {icon}
          <div className="flex-1 truncate text-[13.5px] font-semibold">{title}</div>
          <IconButton label={tr("Close")} onClick={onClose} className="-me-2">
            <X size={15} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-2.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, children, width = 460 }: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-black/10 animate-fade dark:bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full flex-col border-s bg-surface shadow-pop animate-slide" style={{ maxWidth: width }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Menus / context menus ---------------- */

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
}

export function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <div className="min-w-[190px] rounded-[9px] border bg-surface/95 p-1 shadow-pop backdrop-blur-xl animate-in">
      {items.map((it, i) =>
        it.separator ? (
          <div key={i} className="my-1 h-px bg-line/10" />
        ) : (
          <button
            key={i}
            type="button"
            disabled={it.disabled}
            onClick={() => {
              onClose();
              it.onClick?.();
            }}
            className={clsx('flex h-7 w-full items-center gap-2 rounded-[5px] px-2 text-start text-sm disabled:opacity-40', it.danger ? 'text-crit hover:bg-crit hover:text-white' : 'hover:bg-accent hover:text-white')}
          >
            <span className="flex w-4 justify-center opacity-80">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="text-xs opacity-60">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

interface CtxState {
  x: number;
  y: number;
  items: MenuItem[];
}
const CtxContext = createContext<(e: React.MouseEvent, items: MenuItem[]) => void>(() => {});
export const useContextMenu = () => useContext(CtxContext);

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [st, setSt] = useState<CtxState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const open = useCallback((e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setSt({ x: e.clientX, y: e.clientY, items });
  }, []);
  useLayoutEffect(() => {
    if (!st || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = Math.min(st.x, window.innerWidth - r.width - 8);
    const y = Math.min(st.y, window.innerHeight - r.height - 8);
    ref.current.style.left = `${Math.max(8, x)}px`;
    ref.current.style.top = `${Math.max(8, y)}px`;
  }, [st]);
  useEscape(() => setSt(null), !!st);
  return (
    <CtxContext.Provider value={open}>
      {children}
      {st &&
        createPortal(
          <div className="fixed inset-0 z-[70]" onMouseDown={() => setSt(null)} onContextMenu={(e) => (e.preventDefault(), setSt(null))}>
            <div ref={ref} className="fixed" style={{ left: st.x, top: st.y }} onMouseDown={(e) => e.stopPropagation()}>
              <MenuList items={st.items} onClose={() => setSt(null)} />
            </div>
          </div>,
          document.body,
        )}
    </CtxContext.Provider>
  );
}

/** Dropdown anchored to a trigger button. */
export function Dropdown({ trigger, items, align = 'right' }: { trigger: (open: () => void) => React.ReactNode; items: MenuItem[]; align?: 'left' | 'right' }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const open = () => {
    const r = wrap.current!.getBoundingClientRect();
    setPos({ x: align === 'right' ? r.right : r.left, y: r.bottom + 4 });
  };
  useEscape(() => setPos(null), !!pos);
  return (
    <span ref={wrap} className="inline-flex">
      {trigger(open)}
      {pos &&
        createPortal(
          <div className="fixed inset-0 z-[70]" onMouseDown={() => setPos(null)}>
            <div className="fixed" style={align === 'right' ? { right: window.innerWidth - pos.x, top: pos.y } : { left: pos.x, top: pos.y }} onMouseDown={(e) => e.stopPropagation()}>
              <MenuList items={items} onClose={() => setPos(null)} />
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

/* ---------------- Toasts ---------------- */

interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
}
const ToastCtx = createContext<(message: string, kind?: Toast['kind'], action?: Toast['action']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Toast['kind'] = 'info', action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, kind, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-[10px] bg-[#1d1d1f]/95 px-3.5 py-2 text-sm text-white shadow-pop backdrop-blur animate-in dark:bg-[#3a3a3c]/95">
              <span className={clsx('h-1.5 w-1.5 rounded-full', t.kind === 'success' ? 'bg-ok' : t.kind === 'error' ? 'bg-crit' : 'bg-accent')} />
              {t.message}
              {t.action && (
                <button
                  className="font-semibold text-[#64D2FF] hover:underline"
                  onClick={() => {
                    t.action!.onClick();
                    setToasts((x) => x.filter((y) => y.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

/* ---------------- Confirm dialog ---------------- */

interface ConfirmOpts {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [st, setSt] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setSt({ ...o, resolve })), []);
  const done = (v: boolean) => {
    st?.resolve(v);
    setSt(null);
  };
  useEscape(() => done(false), !!st);
  useEffect(() => {
    if (!st) return;
    const fn = (e: KeyboardEvent) => e.key === 'Enter' && (e.preventDefault(), done(true));
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {st &&
        createPortal(
          <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/25 animate-fade dark:bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && done(false)}>
            <div className="w-[300px] rounded-[12px] bg-surface p-4 text-center shadow-pop animate-in">
              <div className="text-[13.5px] font-semibold">{st.title}</div>
              {st.body && <div className="mt-1.5 text-sm text-ink2">{st.body}</div>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button onClick={() => done(false)}>{st.cancelLabel || tr("Cancel")}</Button>
                <Button variant={st.danger ? 'danger' : 'primary'} onClick={() => done(true)} autoFocus>
                  {st.confirmLabel || tr("Confirm")}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmCtx.Provider>
  );
}
