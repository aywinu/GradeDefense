/**
 * Color palette as numeric values, mirroring src/styles/tokens.css
 * Ref: .kiro/steering/art-direction.md
 */

export const Palette = {
  // Primary colors
  Void: 0x07060b,
  Ink: 0x120f1a,
  Stone: 0x1d1828,
  Mist: 0x2b2440,
  Parchment: 0xe9dcc0,
  FadedInk: 0xa89f8c,
  Candle: 0xf2b45a,
  Spectral: 0x6ee7d0,
  Crimson: 0xb3202c,

  // Course colors
  CourseCV: 0x5b8def,
  CoursePHO: 0xa274f0,
  CourseMGT: 0xe0874a,
  CourseDSA: 0xd9b54a,
  CourseMKT: 0xd85a8e,
  CourseMATH: 0x4fc29a,
} as const;

/**
 * Get course color by course ID
 */
export function getCourseColor(courseId: string): number {
  const mapping: Record<string, number> = {
    CV101: Palette.CourseCV,
    PHO101: Palette.CoursePHO,
    MGT101: Palette.CourseMGT,
    DSA101: Palette.CourseDSA,
    MKT101: Palette.CourseMKT,
    MATH101: Palette.CourseMATH,
  };
  return mapping[courseId] || Palette.Mist;
}
