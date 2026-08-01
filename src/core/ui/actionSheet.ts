/**
 * Cross-platform "change or remove" sheet. iOS keeps the native
 * ActionSheetIOS; Android gets the same three choices as an Alert, which is
 * the platform's own idiom for a small decision (a custom bottom sheet would
 * be more chrome than the moment needs). ActionSheetIOS throws on Android, so
 * every sheet call site must go through here.
 */
import {ActionSheetIOS, Alert, Platform} from 'react-native';

type ChoiceSheet = {
  /** Primary action label (e.g. "Change photo"). */
  choose: string;
  /** Destructive action label (e.g. "Remove"). */
  remove: string;
  cancel: string;
  onChoose: () => void;
  onRemove: () => void;
};

export function showChoiceSheet(sheet: ChoiceSheet): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [sheet.choose, sheet.remove, sheet.cancel],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      index => {
        if (index === 0) {
          sheet.onChoose();
        } else if (index === 1) {
          sheet.onRemove();
        }
      },
    );
    return;
  }
  Alert.alert('', undefined, [
    {text: sheet.choose, onPress: sheet.onChoose},
    {text: sheet.remove, style: 'destructive', onPress: sheet.onRemove},
    {text: sheet.cancel, style: 'cancel'},
  ]);
}
