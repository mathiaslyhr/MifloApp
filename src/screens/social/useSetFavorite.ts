/**
 * "Pick a favorite from right here" — the Ball Knowledge entry points' way into
 * a fan group. Opens the same FotMob search the profile showcase uses, then
 * saves through the same setFavorites triple (the RPC always writes all three
 * slots, so the other two are carried over from the cached profile untouched —
 * never clobbered). The profile page keeps its own optimistic-update path;
 * these callers only need "saved, now refetch", which is what onSaved is for.
 */
import {useTranslation} from 'react-i18next';
import {toast} from '../../core/ui';
import {useSearch} from '../../games/shared/SearchScreen';
import {clubSource, nationSource} from '../../games/shared/searchSources';
import {getCachedProfile, setFavorites} from '../../core/social/socialService';
import type {BkDimension} from '../../core/social/ballKnowledgeService';

export function useSetFavorite(onSaved?: () => void): (dimension: BkDimension) => void {
  const {t} = useTranslation();
  const openSearch = useSearch();

  return (dimension: BkDimension) => {
    const source = dimension === 'club' ? clubSource() : nationSource();
    const title =
      dimension === 'club'
        ? t('profile.favoriteClubPick')
        : t('profile.favoriteNationPick');
    openSearch(source, {
      title,
      placeholder: t('profile.favoriteSearchPlaceholder'),
    }).then(async item => {
      if (!item) {
        return;
      }
      try {
        const cached = await getCachedProfile();
        await setFavorites({
          playerId: cached?.favoritePlayerId ?? null,
          clubId: dimension === 'club' ? item.id : cached?.favoriteClubId ?? null,
          nation: dimension === 'nation' ? item.id : cached?.favoriteNation ?? null,
        });
        onSaved?.();
      } catch {
        toast.error(t('common.errorNetwork'));
      }
    });
  };
}
