/**
 * The bundled → remote → null fallback for chip art. Bundled assets always win
 * (fast, offline); a content pack's remoteArt fills in only what THIS binary
 * lacks; anything with neither falls back to the emoji/text layer.
 */
import {SUPABASE_URL} from '../../../core/config';
import {flagImage, logoImage} from '../criterionIcon';
import {LOGO_IMAGES} from '../assets/logos.generated';
import {FLAG_IMAGES} from '../assets/flags.generated';
import {hydrateRemoteArt, __resetRemoteArtForTests} from '../assets/remoteArt';

const BASE = `${SUPABASE_URL}/storage/v1/object/public/game-data`;

afterEach(() => __resetRemoteArtForTests());

describe('chip art fallback', () => {
  it('returns the bundled Metro asset when one exists', () => {
    // (jest mocks a bundled `require('*.png')` as an object, not the number
    // Metro yields at runtime — so assert identity, not `typeof`.)
    expect(logoImage('ac-milan')).toBe(LOGO_IMAGES['ac-milan']);
    expect(flagImage('Italy')).toBe(FLAG_IMAGES['Italy']);
  });

  it('bundled art wins even when the pack also carries a remote URL', () => {
    hydrateRemoteArt({logos: {'ac-milan': 'art/logos/ac-milan-x.png'}});
    expect(logoImage('ac-milan')).toBe(LOGO_IMAGES['ac-milan']);
  });

  it('falls back to a remote {uri} for a club/nation this binary lacks', () => {
    expect(LOGO_IMAGES['ghost-fc']).toBeUndefined();
    expect(logoImage('ghost-fc')).toBeNull();

    hydrateRemoteArt({
      logos: {'ghost-fc': 'art/logos/ghost-fc-abc.png'},
      flags: {Atlantis: 'art/flags/atlantis-def.png'},
    });
    expect(logoImage('ghost-fc')).toEqual({uri: `${BASE}/art/logos/ghost-fc-abc.png`});
    expect(FLAG_IMAGES['Atlantis']).toBeUndefined();
    expect(flagImage('Atlantis')).toEqual({uri: `${BASE}/art/flags/atlantis-def.png`});
  });

  it('returns null when neither bundled nor remote art exists', () => {
    hydrateRemoteArt(undefined);
    expect(logoImage('ghost-fc')).toBeNull();
    expect(flagImage('Atlantis')).toBeNull();
  });
});
