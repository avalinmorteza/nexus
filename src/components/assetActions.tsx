import { Copy, CopyPlus, ExternalLink, Globe, LayoutDashboard, Pencil, Pin, PinOff, RefreshCw, Trash2 } from 'lucide-react';
import { deleteAssets, duplicateAsset, togglePin } from '../lib/actions';
import type { Asset, DB } from '../lib/types';
import { copyText, domainOf, isSafeHttpUrl, normalizeUrl, openUrl } from '../lib/util';
import { useConfirm, useToast, type MenuItem } from './ui';
import { useUI } from './ui-context';

import { t as tr } from '../lib/i18n';
export function assetWebsite(a: Asset): string {
  return a.loginUrl || a.purchaseUrl || (domainOf(a.name) && a.name.includes('.') ? a.name : '');
}

export function assetDomain(a: Asset): string {
  return (a.name.includes('.') && !a.name.includes(' ') ? domainOf(a.name) : '') || domainOf(a.loginUrl) || domainOf(a.purchaseUrl);
}

export function useAssetActions(db: DB | null) {
  const ui = useUI();
  const toast = useToast();
  const confirm = useConfirm();

  const copy = async (text: string, what: string) => {
    if (!text) return toast(tr('No {what} to copy', { what: tr(what) }), 'error');
    (await copyText(text)) ? toast(tr('Copied {what}', { what: tr(what) }), 'success') : toast(tr("Copy failed"), 'error');
  };

  const remove = async (a: Asset) => {
    if (!(await confirm({ title: tr('Delete {name}?', { name: a.name }), body: tr("Linked tasks are kept but unlinked. This cannot be undone."), danger: true, confirmLabel: tr("Delete") }))) return false;
    await deleteAssets([a.id]);
    toast(tr('{name} deleted', { name: a.name }));
    return true;
  };

  const open = (a: Asset) => {
    const url = assetWebsite(a);
    if (!openUrl(url)) toast(tr("No website set for this asset"), 'error');
  };

  const providerDashboard = (a: Asset) => {
    const p = db?.providers.find((x) => x.id === a.providerId);
    if (!p) return toast(tr("No provider set"), 'error');
    if (!openUrl(p.dashboardUrl || p.website)) toast(tr('{name} has no dashboard URL', { name: p.name }), 'error');
  };

  const items = (a: Asset): MenuItem[] => [
    { label: tr("Open details"), icon: <ExternalLink size={13} />, onClick: () => ui.openAsset(a.id) },
    { label: tr("Edit"), icon: <Pencil size={13} />, onClick: () => ui.editAsset(a.id), shortcut: 'E' },
    { label: tr("Mark as renewed…"), icon: <RefreshCw size={13} />, onClick: () => ui.renewAsset(a.id) },
    { separator: true, label: '' },
    { label: tr("Open website"), icon: <Globe size={13} />, onClick: () => open(a), disabled: !isSafeHttpUrl(assetWebsite(a)) },
    { label: tr("Provider dashboard"), icon: <LayoutDashboard size={13} />, onClick: () => providerDashboard(a), disabled: !a.providerId },
    { label: tr("Copy URL"), icon: <Copy size={13} />, onClick: () => copy(assetWebsite(a) ? normalizeUrl(assetWebsite(a)) : '', 'URL') },
    { label: tr("Copy domain"), icon: <Copy size={13} />, onClick: () => copy(assetDomain(a), 'domain') },
    { separator: true, label: '' },
    { label: a.pinned ? tr("Unpin") : tr("Pin to Quick Access"), icon: a.pinned ? <PinOff size={13} /> : <Pin size={13} />, onClick: () => togglePin('asset', a.id) },
    {
      label: tr("Duplicate"),
      icon: <CopyPlus size={13} />,
      onClick: async () => {
        const c = await duplicateAsset(a.id);
        toast(tr("Duplicated"), 'success', { label: tr("Edit"), onClick: () => ui.editAsset(c.id) });
      },
    },
    { separator: true, label: '' },
    { label: tr("Delete"), icon: <Trash2 size={13} />, danger: true, onClick: () => remove(a) },
  ];

  return { items, copy, remove, open, providerDashboard };
}
