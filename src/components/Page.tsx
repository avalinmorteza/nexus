import React from 'react';
import { clsx } from '../lib/util';
import { Ico, type IconlyName } from './Iconly';

/** Consistent page header used by every page: icon tile, title, subtitle, actions. */
export function PageHeader({ icon, title, subtitle, actions, tone = 'accent' }: { icon?: IconlyName; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; tone?: 'accent' | 'violet' | 'orange' | 'green' | 'pink' | 'gray' }) {
  const toneCls = {
    accent: 'bg-accent/10 text-accent',
    violet: 'bg-[#5856D6]/10 text-[#5856D6]',
    orange: 'bg-[#FF9500]/12 text-[#E08300]',
    green: 'bg-ok/12 text-[#1f8a3e] dark:text-ok',
    pink: 'bg-[#FF2D55]/10 text-[#FF2D55]',
    gray: 'bg-ink/[0.06] text-ink2',
  }[tone];
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      {icon && (
        <span className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]', toneCls)}>
          <Ico name={icon} set="bulk" size={26} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold leading-8 tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 truncate text-sm text-ink2">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Card with an optional header row; children sit on the card's inner padding grid. */
export function Panel({ title, icon, action, children, className, bodyClassName, tone = 'accent' }: { title?: React.ReactNode; icon?: IconlyName; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; tone?: 'accent' | 'violet' | 'orange' | 'green' | 'pink' | 'gray' | 'red' }) {
  const toneCls = {
    accent: 'text-accent',
    violet: 'text-[#5856D6]',
    orange: 'text-[#E08300]',
    green: 'text-[#1f8a3e] dark:text-ok',
    pink: 'text-[#FF2D55]',
    gray: 'text-ink2',
    red: 'text-crit',
  }[tone];
  return (
    <section className={clsx('card flex min-w-0 flex-col overflow-hidden', className)}>
      {title && (
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-5">
          {icon && <Ico name={icon} set="bulk" size={20} className={toneCls} />}
          <h2 className="flex-1 truncate text-[15px] font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className={clsx('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}
