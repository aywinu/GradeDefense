/**
 * Canvas text does not trigger lazy @font-face loading, so the fonts Phaser
 * draws with are requested explicitly before the first scene renders.
 */
const FACES = [
  '700 64px "Cinzel Decorative"',
  '900 64px "Cinzel Decorative"',
  '500 32px "Cinzel"',
  '700 32px "Cinzel"',
  '400 24px "Spectral"',
  'italic 400 24px "Spectral"',
  '600 24px "Spectral"',
  '400 16px "Inter"',
  '600 16px "Inter"',
  '700 16px "Inter"',
];

export async function loadFonts(timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const all = Promise.all(FACES.map((f) => document.fonts.load(f).catch(() => [])));
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([all, timeout]);
}
