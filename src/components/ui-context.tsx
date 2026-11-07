import { createContext, useContext } from 'react';
import type { Asset, Task } from '../lib/types';

export interface UIApi {
  openAsset: (id: string) => void;
  editAsset: (id?: string, defaults?: Partial<Asset>) => void;
  renewAsset: (id: string) => void;
  openTask: (id: string) => void;
  editTask: (id?: string, defaults?: Partial<Task>) => void;
  editProvider: (id?: string, onCreated?: (id: string) => void) => void;
  openProvider: (id: string) => void;
  openPalette: (mode?: 'all' | 'expiring' | 'critical' | 'pinned') => void;
  openActivity: () => void;
  requestUnlock: () => Promise<boolean>;
}

export const UICtx = createContext<UIApi>(null as unknown as UIApi);
export const useUI = () => useContext(UICtx);
