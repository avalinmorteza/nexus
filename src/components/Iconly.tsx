// Iconly icon set (react-iconly, MIT) — used for navigation, page headers and KPI tiles.
// per-icon imports keep the bundle small (the package index pulls in every icon)
import Calendar from 'react-iconly/dist/Icons/Calendar.mjs';
import Category from 'react-iconly/dist/Icons/Category.mjs';
import Chart from 'react-iconly/dist/Icons/Chart.mjs';
import CloseSquare from 'react-iconly/dist/Icons/CloseSquare.mjs';
import Danger from 'react-iconly/dist/Icons/Danger.mjs';
import Document from 'react-iconly/dist/Icons/Document.mjs';
import Folder from 'react-iconly/dist/Icons/Folder.mjs';
import Notification from 'react-iconly/dist/Icons/Notification.mjs';
import Paper from 'react-iconly/dist/Icons/Paper.mjs';
import People from 'react-iconly/dist/Icons/People.mjs';
import Plus from 'react-iconly/dist/Icons/Plus.mjs';
import Search from 'react-iconly/dist/Icons/Search.mjs';
import Setting from 'react-iconly/dist/Icons/Setting.mjs';
import Star from 'react-iconly/dist/Icons/Star.mjs';
import TickSquare from 'react-iconly/dist/Icons/TickSquare.mjs';
import TimeCircle from 'react-iconly/dist/Icons/TimeCircle.mjs';
import Work from 'react-iconly/dist/Icons/Work.mjs';
import Wallet from 'react-iconly/dist/Icons/Wallet.mjs';
import Discount from 'react-iconly/dist/Icons/Discount.mjs';
import ShieldDone from 'react-iconly/dist/Icons/ShieldDone.mjs';
import Activity from 'react-iconly/dist/Icons/Activity.mjs';
import Graph from 'react-iconly/dist/Icons/Graph.mjs';

const ICONS = {
  overview: Category,
  assets: Folder,
  tasks: TickSquare,
  calendar: Calendar,
  providers: Work,
  quick: Star,
  settings: Setting,
  bell: Notification,
  search: Search,
  plus: Plus,
  clock: TimeCircle,
  danger: Danger,
  expired: CloseSquare,
  chart: Chart,
  graph: Graph,
  document: Document,
  paper: Paper,
  people: People,
  wallet: Wallet,
  discount: Discount,
  shield: ShieldDone,
  activity: Activity,
} as const;

export type IconlyName = keyof typeof ICONS;

export function Ico({ name, set = 'light', size = 20, className }: { name: IconlyName; set?: 'light' | 'bold' | 'two-tone' | 'bulk' | 'broken' | 'curved'; size?: number; className?: string }) {
  const C = ICONS[name] as any;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className || ''}`} style={{ width: size, height: size }} aria-hidden>
      <C set={set} primaryColor="currentColor" secondaryColor="currentColor" size={size} />
    </span>
  );
}
