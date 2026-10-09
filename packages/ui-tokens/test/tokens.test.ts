/** WCAG 2.2 AA contrast for every text/fill pair the UI uses, in both themes. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Tokens {
  color: Record<'light' | 'dark', Record<string, string>>;
  status: Record<string, Record<'light' | 'dark', [string, string]>>;
}
const t = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8')) as Tokens;

const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

const PAIRS: [fg: string, bg: string][] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceHigh'],
  ['text', 'sheet'],
  ['text2', 'background'],
  ['text2', 'surface'],
  ['text2', 'surfaceHigh'],
  ['onPrimary', 'primary'],
  ['onPrimaryContainer', 'primaryContainer'],
  ['onAccent', 'accent'],
  ['onAccentSoft', 'accentSoft'],
  ['onSuccessContainer', 'successContainer'],
  ['onWarningContainer', 'warningContainer'],
  ['onDanger', 'danger'],
  ['onDangerContainer', 'dangerContainer'],
  ['onInverseSurface', 'inverseSurface'],
  ['primary', 'background'],
  ['danger', 'background'],
];

describe.each(['light', 'dark'] as const)('%s theme', (mode) => {
  const c = t.color[mode];
  it.each(PAIRS)('%s on %s ≥ 4.5:1', (fg, bg) => {
    expect(c[fg], `${fg} missing`).toBeDefined();
    expect(c[bg], `${bg} missing`).toBeDefined();
    expect(contrast(c[fg] as string, c[bg] as string)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(Object.keys(t.status))('status %s chip ≥ 4.5:1', (s) => {
    const [bg, fg] = t.status[s]?.[mode] ?? ['#000000', '#000000'];
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('both themes define the same keys', () => {
    expect(Object.keys(c).sort()).toEqual(Object.keys(t.color.light).sort());
  });
});
