// Optional sample data for trying NEXUS out. Only loaded when the user clicks
// "Load sample data" in Settings › Data Management; dates are relative to today so
// every status (normal / warning / critical / expired / none) is represented.
import { addDays, todayISO } from './dates';
import { defaultCategories, defaultSettings } from './defaults';
import type { Asset, DB, Provider, Task } from './types';
import { uid } from './util';

export function sampleDB(): DB {
  const t = todayISO();
  const now = Date.now();
  const prov = (name: string, website: string, dashboardUrl: string): Provider => ({ id: uid(), name, website, dashboardUrl, supportUrl: '', contact: '', notes: '', createdAt: now, updatedAt: now });
  const p = {
    namecheap: prov('Namecheap', 'https://namecheap.com', 'https://ap.www.namecheap.com/dashboard'),
    cloudflare: prov('Cloudflare', 'https://cloudflare.com', 'https://dash.cloudflare.com'),
    hetzner: prov('Hetzner', 'https://hetzner.com', 'https://console.hetzner.cloud'),
    aws: prov('AWS', 'https://aws.amazon.com', 'https://console.aws.amazon.com'),
    github: prov('GitHub', 'https://github.com', 'https://github.com/settings/billing'),
  };
  const asset = (name: string, categoryId: string, providerId: string | undefined, exp: number | null, price: number, extra: Partial<Asset> = {}): Asset => ({
    id: uid(),
    name,
    categoryId,
    providerId,
    purchaseUrl: '',
    purchasePrice: price,
    currency: 'USD',
    purchaseDate: exp === null ? addDays(t, -200) : addDays(t, exp - 365),
    expirationDate: exp === null ? undefined : addDays(t, exp),
    renewalPrice: price,
    loginUrl: '',
    username: '',
    notes: '',
    tags: [],
    status: 'active',
    custom: {},
    attachments: [],
    pinned: false,
    notificationsEnabled: true,
    reminderDays: null,
    renewals: [],
    createdAt: now,
    updatedAt: now,
    ...extra,
  });
  const assets: Asset[] = [
    asset('example.com', 'domains', p.namecheap.id, 0, 12.98, { loginUrl: 'https://example.com', tags: ['personal'], pinned: true }),
    asset('example.org', 'domains', p.namecheap.id, 1, 14.5, { loginUrl: 'https://example.org' }),
    asset('acme-shop.io', 'domains', p.cloudflare.id, 3, 39, { tags: ['client'] }),
    asset('Hetzner CX22', 'vps', p.hetzner.id, 4, 4.59, { custom: { ip: '203.0.113.10', os: 'Ubuntu 24.04', region: 'fsn1' }, pinned: true }),
    asset('Wildcard SSL', 'ssl', p.cloudflare.id, 15, 0),
    asset('AWS Production', 'cloud', p.aws.id, 30, 120, { custom: { account_id: '123456789012', region: 'eu-central-1', plan: 'Business' } }),
    asset('GitHub Team', 'subscriptions', p.github.id, 31, 48, { custom: { billing_cycle: 'Monthly' } }),
    asset('old-project.net', 'domains', p.namecheap.id, -5, 10.98),
    asset('JetBrains All Products', 'licenses', undefined, 120, 289),
    asset('Personal VPN', 'vpn', undefined, null, 0),
  ];
  const task = (title: string, due: number | null, extra: Partial<Task> = {}): Task => ({
    id: uid(),
    title,
    description: '',
    dueDate: due === null ? undefined : addDays(t, due),
    priority: 'medium',
    tags: [],
    done: false,
    recurrence: 'none',
    subtasks: [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
    ...extra,
  });
  const tasks: Task[] = [
    task('Renew example.com', -1, { assetId: assets[0].id, priority: 'urgent', autoRenewal: true }),
    task('Renew acme-shop.io', 0, { assetId: assets[2].id, priority: 'high' }),
    task('Review monthly cloud bill', 0, { recurrence: 'monthly', tags: ['billing'] }),
    task('Rotate API keys', 6, { priority: 'high', subtasks: [{ id: uid(), title: 'Stripe', done: false }, { id: uid(), title: 'OpenAI', done: true }] }),
    task('Back up NEXUS data', null),
  ];
  return {
    version: 1,
    assets,
    tasks,
    providers: Object.values(p),
    categories: defaultCategories(),
    activity: [],
    settings: defaultSettings(),
  };
}
