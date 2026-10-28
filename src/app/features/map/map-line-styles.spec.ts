import { describe, expect, it } from 'vitest';
import {
  CONNECTION_COLORS,
  INSTALLATION_STYLES,
  installationMethods,
  removeRouteVertex,
  svgDash,
} from './map-line-styles';

describe('installation metadata', () => {
  it('keeps unknown for legacy routes and distinguishes cable medium from installation', () => {
    expect(
      installationMethods([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual(['unknown', 'unknown', 'unknown']);
    expect(CONNECTION_COLORS.fiber).toBe('#4F9DD9');
    expect(CONNECTION_COLORS.utp).toBe('#D6A66B');
    expect(INSTALLATION_STYLES.find((style) => style.value === 'duct')?.dash).toEqual([3, 1.8]);
    expect(svgDash(INSTALLATION_STYLES.find((style) => style.value === 'duct')!)).toBe('8.1 4.86');
  });
  it('does not silently delete a boundary between two installation methods', () => {
    expect(removeRouteVertex([[1, 2]], ['aerial', 'duct'], 0)).toBeNull();
    expect(removeRouteVertex([[1, 2]], ['aerial', 'duct'], 0, 'direct_buried')).toEqual({
      vertices: [],
      installation_methods: ['direct_buried'],
    });
    expect(removeRouteVertex([[1, 2]], ['duct', 'duct'], 0)).toEqual({
      vertices: [],
      installation_methods: ['duct'],
    });
  });
});
