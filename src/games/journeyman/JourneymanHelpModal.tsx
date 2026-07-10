/**
 * JourneymanHelpModal — the "how to play" popover behind the ? button in the
 * Journeyman header. Four short lines: the career board, the hint rule, the
 * streak rule, and the once-a-day cadence. Thin wrapper over the shared
 * [[HowToPlayModal]].
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import {HowToPlayModal} from '../../core/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function JourneymanHelpModal({visible, onClose}: Props) {
  const {t} = useTranslation();
  return (
    <HowToPlayModal
      visible={visible}
      onClose={onClose}
      title={t('journeyman.help.title')}
      lines={[
        {text: t('journeyman.help.rule')},
        {text: t('journeyman.help.hints')},
        {text: t('journeyman.help.streak'), divider: true},
        {text: t('journeyman.help.daily'), tone: 'strong'},
      ]}
    />
  );
}
