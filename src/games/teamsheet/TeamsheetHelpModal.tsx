/**
 * TeamsheetHelpModal — the "how to play" popover behind the ? button in the
 * Team sheet header. Four short lines: the guessing rule, the clue legend,
 * the miss/streak rule, and the once-a-day cadence. Thin wrapper over the
 * shared [[HowToPlayModal]].
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import {HowToPlayModal} from '../../core/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function TeamsheetHelpModal({visible, onClose}: Props) {
  const {t} = useTranslation();
  return (
    <HowToPlayModal
      visible={visible}
      onClose={onClose}
      title={t('teamsheet.help.title')}
      lines={[
        {text: t('teamsheet.help.rule')},
        {text: t('teamsheet.help.clues')},
        {text: t('teamsheet.help.streak'), divider: true},
        {text: t('teamsheet.help.daily'), tone: 'strong'},
      ]}
    />
  );
}
