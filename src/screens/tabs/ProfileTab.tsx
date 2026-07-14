import React from 'react';
import {useTranslation} from 'react-i18next';
import {TabPage} from './TabPage';

/** Profile — the player's own page. Blank slate for the new sitemap. */
export function ProfileTab() {
  const {t} = useTranslation();
  return <TabPage title={t('tabs.profile')} />;
}
