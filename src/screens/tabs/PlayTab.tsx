import React from 'react';
import {useTranslation} from 'react-i18next';
import {TabPage} from './TabPage';

/** Play — the party/multiplayer games' home. Blank slate for the new sitemap. */
export function PlayTab() {
  const {t} = useTranslation();
  return <TabPage title={t('tabs.play')} />;
}
