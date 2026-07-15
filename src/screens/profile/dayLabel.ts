/**
 * "Today" / "Yesterday" / "3 jul" — the profile page's one way of naming a day.
 * Shared because the career page dates two lists at once (the daily archive and
 * the ranked matches), and two spellings of yesterday on one screen would read
 * as two different facts.
 */
import {useTranslation} from 'react-i18next';
import {previousDateKey} from '../../games/scout/dailySeed';

export function useDayLabel(todayKey: string): (dateKey: string) => string {
  const {t} = useTranslation();
  const months = t('dailyLog.months', {returnObjects: true}) as string[];
  return (dateKey: string) => {
    if (dateKey === todayKey) {
      return t('dailyLog.today');
    }
    if (dateKey === previousDateKey(todayKey)) {
      return t('dailyLog.yesterday');
    }
    const [, m, d] = dateKey.split('-').map(Number);
    return `${d} ${months[m - 1] ?? m}`;
  };
}
