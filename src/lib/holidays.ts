// Fixed (solar) official holidays of Iran, by Jalali month/day.
// Lunar religious holidays move every year and are intentionally not included.
import { toJalali } from './dates';
import type { ISODate } from './types';

const FIXED: Record<string, string> = {
  '1/1': 'Nowruz',
  '1/2': 'Nowruz',
  '1/3': 'Nowruz',
  '1/4': 'Nowruz',
  '1/12': 'Islamic Republic Day',
  '1/13': 'Nature Day',
  '3/14': 'Demise of Imam Khomeini',
  '3/15': '15 Khordad Uprising',
  '11/22': 'Revolution Day',
  '12/29': 'Oil Nationalization Day',
};

/** English key of the holiday on this date (translate with t()), or undefined. */
export function iranHoliday(iso: ISODate): string | undefined {
  const j = toJalali(iso);
  return FIXED[`${j.m}/${j.d}`];
}
