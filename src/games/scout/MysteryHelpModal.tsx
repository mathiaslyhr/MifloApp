/**
 * MysteryHelpModal — the "how to play" popover behind the ? button in the
 * Scout header. Three short lines: the colour rule, what the arrows
 * mean, and the once-a-day cadence. Thin wrapper over the shared [[HowToPlayModal]].
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import {HowToPlayModal} from '../../core/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function MysteryHelpModal({visible, onClose}: Props) {
  const {t} = useTranslation();
  return (
    <HowToPlayModal
      visible={visible}
      onClose={onClose}
      title={t('scout.help.title')}
      lines={[
        {text: t('scout.help.rule')},
        {text: t('scout.help.arrows'), divider: true},
        {text: t('scout.help.daily'), tone: 'strong'},
      ]}
    />
  );
}
