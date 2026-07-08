/**
 * HelpModal — the "how to play" popover behind the ? button in the game header.
 * A couple of short lines: the core rule plus a nudge that every axis on the
 * grid is tappable (see [[AxisInfoModal]]) for a plain-language explanation.
 * Thin wrapper over the shared [[HowToPlayModal]].
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import {HowToPlayModal} from '../../core/ui';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function HelpModal({visible, onClose}: Props) {
  const {t} = useTranslation();
  return (
    <HowToPlayModal
      visible={visible}
      onClose={onClose}
      title={t('hattrick.help.title')}
      lines={[
        {text: t('hattrick.help.rule')},
        {text: t('hattrick.help.tapHint'), tone: 'strong', divider: true},
      ]}
    />
  );
}
