import {segmentedThumb} from '../Segmented';

/**
 * The thumb's geometry is the one part of Segmented that can be wrong in a way
 * that's hard to spot by eye (a half-pixel drift across four segments reads as
 * "slightly off" rather than "broken"), so it's pulled out as pure arithmetic
 * and pinned here.
 *
 * The track is `padding: 4` with a `gap: 4` between equal-width segments.
 */
describe('segmentedThumb', () => {
  it('spans the track minus padding for a single segment', () => {
    const {width, x} = segmentedThumb(100, 1, 0);
    expect(width).toBe(92); // 100 - 4 - 4
    expect(x).toBe(4);
  });

  it('splits a two-option track evenly and accounts for the gap', () => {
    // 200 - 8 padding - 4 gap = 188 across two segments.
    expect(segmentedThumb(200, 2, 0)).toEqual({width: 94, x: 4});
    expect(segmentedThumb(200, 2, 1)).toEqual({width: 94, x: 102});
  });

  it('places the last of three segments flush against the far padding', () => {
    const count = 3;
    const trackW = 320;
    const {width, x} = segmentedThumb(trackW, count, count - 1);
    // The thumb's right edge must land exactly one padding in from the track's.
    expect(x + width).toBeCloseTo(trackW - 4);
  });

  it('leaves exactly one gap between neighbouring segments', () => {
    const a = segmentedThumb(320, 3, 0);
    const b = segmentedThumb(320, 3, 1);
    expect(b.x - (a.x + a.width)).toBeCloseTo(4);
  });

  it('keeps every segment the same width', () => {
    const widths = [0, 1, 2, 3].map(i => segmentedThumb(375, 4, i).width);
    expect(new Set(widths).size).toBe(1);
  });
});
