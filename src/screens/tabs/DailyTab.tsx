import React from 'react';
import {useTranslation} from 'react-i18next';
import {TabPage} from './TabPage';

/** Daily — the solo dailies' home. Blank slate for the new sitemap. */
export function DailyTab() {
  const {t} = useTranslation();
  return <TabPage title={t('tabs.daily')} />;
}
