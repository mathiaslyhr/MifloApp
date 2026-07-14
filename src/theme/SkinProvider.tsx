/**
 * The reactive skin layer. With the single-skin registry it simply hands the
 * one active `Skin` to the tree, but the hook API is unchanged: screens read
 * the active palette through `useColors()` and derive stylesheets with
 * `useThemedStyles(makeStyles)`, chrome reads the light/dark axis via
 * `useSkin()`. When the next skin lands (or skins become switchable again),
 * only this file and the registry change — no call sites.
 */
import React, {createContext, useContext, useMemo} from 'react';
import type {Palette} from './colors';
import {SKINS, type Skin} from './skins';

type SkinContextValue = {
  /** The active skin (palette + appearance). */
  skin: Skin;
  /** The active palette (shortcut for `skin.palette`). */
  colors: Palette;
};

const SkinContext = createContext<SkinContextValue | null>(null);

export function SkinProvider({children}: {children: React.ReactNode}) {
  const value = useMemo<SkinContextValue>(
    () => ({skin: SKINS.skin1, colors: SKINS.skin1.palette}),
    [],
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

/**
 * Read the skin context, or the fallback when there's no provider (a component
 * rendered in isolation — e.g. a unit test — or before the tree is wrapped).
 */
const FALLBACK: SkinContextValue = {
  skin: SKINS.skin1,
  colors: SKINS.skin1.palette,
};

function useSkinContext(): SkinContextValue {
  return useContext(SkinContext) ?? FALLBACK;
}

/** Full skin state — the active skin (palette + light/dark appearance). */
export function useSkin(): SkinContextValue {
  return useSkinContext();
}

/** The active palette. Use in JSX props: `color={useColors().primary}`. */
export function useColors(): Palette {
  return useSkinContext().colors;
}

/**
 * Derive a themed StyleSheet. Pass a module-level factory so it stays stable;
 * the result is memoized and only rebuilt when the active palette changes.
 *
 *   const makeStyles = (c: Palette) => StyleSheet.create({box: {backgroundColor: c.surface}});
 *   // in the component:
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
