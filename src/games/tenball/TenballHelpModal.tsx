/**
 * TenballHelpModal — the "how to play" popover behind the ? button in the
 * Top Bins header. Three short lines: the guessing rule, the streak rule, and
 * the once-a-day cadence. Thin wrapper over the shared [[HowToPlayModal]].
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import {HowToPlayModal} from '../../core/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function TenballHelpModal({visible, onClose}: Props) {
  const {t} = useTranslation();
  return (
    <HowToPlayModal
      visible={visible}
      onClose={onClose}
      title={t('tenball.help.title')}
      lines={[
        {text: t('tenball.help.rule')},
        {text: t('tenball.help.streak'), divider: true},
        {text: t('tenball.help.daily'), tone: 'strong'},
      ]}
    />
  );
}
