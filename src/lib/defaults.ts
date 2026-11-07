import { detectLang, getLang, t } from './i18n';
import type { Category, DB, Settings } from './types';

export const DB_VERSION = 1;
export const DB_KEY = 'nexus_db';
export const NOTIFY_KEY = 'nexus_notify';

export const DEFAULT_REMINDER_DAYS = [30, 15, 7, 3, 1, 0];

const cat = (id: string, name: string, icon: string, color: string, fields: Category['fields'] = []): Category => ({
  id,
  name,
  icon,
  color,
  fields,
  builtin: true,
  autoTask: { enabled: false, daysBefore: 3, title: 'Renew {name}' },
});

export function defaultCategories(): Category[] {
  return [
    cat('domains', 'Domains', 'globe', '#007AFF', [
      { id: 'registrar_lock', label: 'Registrar lock', type: 'checkbox' },
      { id: 'nameservers', label: 'Nameservers', type: 'textarea' },
      { id: 'auto_renew', label: 'Auto-renew', type: 'checkbox' },
    ]),
    cat('hosting', 'Hosting', 'server', '#5856D6', [
      { id: 'plan', label: 'Plan', type: 'text' },
      { id: 'control_panel', label: 'Control panel URL', type: 'url' },
    ]),
    cat('vps', 'VPS', 'cpu', '#AF52DE', [
      { id: 'ip', label: 'IP address', type: 'text' },
      { id: 'os', label: 'Operating system', type: 'text' },
      { id: 'specs', label: 'Specs', type: 'text' },
      { id: 'region', label: 'Region', type: 'text' },
    ]),
    cat('cloud', 'Cloud Accounts', 'cloud', '#32ADE6', [
      { id: 'account_id', label: 'Account ID', type: 'text' },
      { id: 'region', label: 'Region', type: 'text' },
      { id: 'plan', label: 'Plan', type: 'text' },
      { id: 'monthly_cost', label: 'Monthly cost', type: 'number' },
      { id: 'dashboard_url', label: 'Dashboard URL', type: 'url' },
    ]),
    cat('subscriptions', 'Subscriptions', 'repeat', '#FF9500', [
      { id: 'billing_cycle', label: 'Billing cycle', type: 'dropdown', options: ['Monthly', 'Quarterly', 'Yearly'] },
    ]),
    cat('licenses', 'Software Licenses', 'key-round', '#34C759', [
      { id: 'license_key', label: 'License key', type: 'password' },
      { id: 'seats', label: 'Seats', type: 'number' },
    ]),
    cat('ssl', 'SSL Certificates', 'shield-check', '#30B0C7', [
      { id: 'issuer', label: 'Issuer', type: 'text' },
      { id: 'common_name', label: 'Common name', type: 'text' },
    ]),
    cat('apis', 'APIs', 'plug', '#FF2D55', [
      { id: 'api_key', label: 'API key', type: 'password' },
      { id: 'quota', label: 'Quota', type: 'text' },
    ]),
    cat('email', 'Email Services', 'mail', '#0A84FF', [{ id: 'mailboxes', label: 'Mailboxes', type: 'number' }]),
    cat('servers', 'Servers', 'hard-drive', '#8E8E93', [
      { id: 'ip', label: 'IP address', type: 'text' },
      { id: 'location', label: 'Location', type: 'text' },
    ]),
    cat('vpn', 'VPN Accounts', 'lock', '#64D2FF', [{ id: 'protocol', label: 'Protocol', type: 'text' }]),
    cat('ads', 'Advertising Accounts', 'megaphone', '#FF6482', [
      { id: 'account_id', label: 'Account ID', type: 'text' },
      { id: 'budget', label: 'Monthly budget', type: 'number' },
    ]),
  ];
}

export function defaultSettings(): Settings {
  const lang = detectLang();
  return {
    userName: '',
    language: lang,
    calendar: lang === 'fa' ? 'jalali' : 'gregorian',
    theme: 'system',
    defaultView: 'table',
    density: 'compact',
    dateFormat: 'MMM d, yyyy',
    currency: 'USD',
    weekStart: lang === 'fa' ? 6 : 1,
    notificationsEnabled: true,
    reminderDays: [...DEFAULT_REMINDER_DAYS],
    taskReminders: true,
    dailyDigest: false,
    autoRenewalTask: false,
    renewalTaskDays: 3,
    dashboardSections: [
      { id: 'expirations', visible: true },
      { id: 'today', visible: true },
      { id: 'monthly', visible: true },
      { id: 'quick', visible: true },
      { id: 'activity', visible: true },
    ],
    paletteShortcut: 'mod+k',
    encryption: { enabled: false },
    pinOrder: [],
  };
}

export function emptyDB(): DB {
  return {
    version: DB_VERSION,
    assets: [],
    tasks: [],
    providers: [],
    categories: defaultCategories(),
    activity: [],
    settings: defaultSettings(),
  };
}

/**
 * Display-only copy of the DB with built-in category names/field labels translated.
 * Only names still equal to the English default are translated (user renames are kept).
 * Mutations always read from storage, so this never changes stored data.
 */
export function localizeDB(db: DB): DB {
  if (getLang() === 'en') return db;
  const defs = new Map(defaultCategories().map((c) => [c.id, c]));
  return {
    ...db,
    categories: db.categories.map((c) => {
      const d = defs.get(c.id);
      if (!c.builtin || !d) return c;
      return {
        ...c,
        name: c.name === d.name ? t(c.name) : c.name,
        fields: c.fields.map((f) => {
          const df = d.fields.find((x) => x.id === f.id);
          return df && df.label === f.label ? { ...f, label: t(f.label), options: f.options?.map((o) => t(o)) } : f;
        }),
      };
    }),
  };
}

export const CURRENCIES = ['USD', 'IRT', 'EUR', 'GBP', 'IRR', 'TRY', 'AED', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'RUB'];
