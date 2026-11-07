import {
  Box,
  Cloud,
  Cpu,
  CreditCard,
  Database,
  Globe,
  HardDrive,
  KeyRound,
  Lock,
  Mail,
  Megaphone,
  Plug,
  Repeat,
  Server,
  ShieldCheck,
  Smartphone,
  Code,
  Briefcase,
  Folder,
  Star,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '../lib/types';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  server: Server,
  cpu: Cpu,
  cloud: Cloud,
  repeat: Repeat,
  'key-round': KeyRound,
  'shield-check': ShieldCheck,
  plug: Plug,
  mail: Mail,
  'hard-drive': HardDrive,
  lock: Lock,
  megaphone: Megaphone,
  database: Database,
  'credit-card': CreditCard,
  smartphone: Smartphone,
  code: Code,
  briefcase: Briefcase,
  folder: Folder,
  star: Star,
  wifi: Wifi,
  box: Box,
};

export const CATEGORY_COLORS = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#30B0C7', '#32ADE6', '#8E8E93', '#A2845E'];

export function CategoryIcon({ category, size = 14, className = '' }: { category?: Category; size?: number; className?: string }) {
  const Icon = (category && CATEGORY_ICONS[category.icon]) || Box;
  const color = category?.color || '#8E8E93';
  const box = size + 8;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[6px] ${className}`}
      style={{ width: box, height: box, background: `${color}1f`, color }}
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}
