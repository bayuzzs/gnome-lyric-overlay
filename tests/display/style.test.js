import { describe, expect, it } from 'vitest';

import {
  buildFloatingContainerStyle,
  buildFloatingLineStyle,
  buildPanelLabelStyleString,
  buildVinylCoverStyle,
} from '../../src/domain/display/style.js';

describe('display style builders', () => {
  it('renders transparent subtitle container when bgOpacity is 0', () => {
    const css = buildFloatingContainerStyle({ maxWidth: 640, preserveWidth: false, bgOpacity: 0 });
    expect(css).toContain('background-color: transparent;');
    expect(css).toContain('max-width: 640px;');
    expect(css).not.toContain('min-width:');
  });

  it('omits CSS width constraints when preserveWidth is enabled so native set_width owns sizing', () => {
    const css = buildFloatingContainerStyle({ maxWidth: 640, preserveWidth: true, bgOpacity: 55 });
    expect(css).not.toContain('max-width:');
    expect(css).toContain('background-color: rgba(14, 16, 22, 0.55);');
  });

  it('builds circular vinyl cover background-image style with explicit px size for St CSS', () => {
    expect(buildVinylCoverStyle(null)).toBe('');
    const css = buildVinylCoverStyle('file:///tmp/cover.img', 30);
    expect(css).toContain('background-image: url("file:///tmp/cover.img");');
    expect(css).toContain('background-size: 30px 30px;');
  });

  it('styles current and dimmed secondary floating lines with strong shadow on transparent backdrop', () => {
    const current = buildFloatingLineStyle({
      role: 'current',
      fontSize: 20,
      textAlign: 'center',
      textColorMode: 'custom',
      customTextColor: '#ffcc00',
      secondaryOpacity: 50,
      textShadowEnabled: true,
      bgOpacity: 0,
    });
    expect(current).toContain('font-size: 20px;');
    expect(current).toContain('color: #ffcc00;');
    expect(current).toContain('0px 2px 6px rgba(0, 0, 0, 0.95)');

    const secondary = buildFloatingLineStyle({
      role: 'secondary',
      fontSize: 20,
      textAlign: 'center',
      textColorMode: 'custom',
      customTextColor: '#ffcc00',
      secondaryOpacity: 50,
      textShadowEnabled: false,
      bgOpacity: 55,
    });
    expect(secondary).toContain('font-size: 16px;');
    expect(secondary).toContain('color: rgba(255, 204, 0, 0.5);');
    expect(secondary).toContain('text-shadow: none;');
  });

  it('builds fixed top-bar label style string', () => {
    const css = buildPanelLabelStyleString({
      maxWidth: 360,
      textAlign: 'left',
      textColorMode: 'default',
      customTextColor: '#ffffff',
      textShadowEnabled: true,
    });
    expect(css).toContain('width: 360px;');
    expect(css).toContain('text-align: left;');
    expect(css).toContain('color: #ffffff;');
  });
});
