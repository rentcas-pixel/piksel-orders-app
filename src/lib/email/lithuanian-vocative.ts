const VOCATIVE_OVERRIDES: Record<string, string> = {
  petras: 'Petrai',
  marius: 'Mariau',
  dainius: 'Dainiau',
  julius: 'Juliau',
  ignas: 'Ignai',
  simas: 'Simai',
  vytas: 'Vyta',
};

function capitalizeLike(original: string, value: string): string {
  if (!original) return value;
  if (original === original.toUpperCase()) return value.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return value;
}

/**
 * Lietuviškas vardo kreipinys el. laiško pasisveikinimui.
 * Pvz. Vytenis → Vyteni, Gediminas → Gediminai, Jonas → Jonai.
 */
export function toLithuanianVocative(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  const override = VOCATIVE_OVERRIDES[lower];
  if (override) return override;

  // Dažniausiai moteriški vardai -a lieka (Ona, Laura, Irena)
  if (/[aą]$/.test(lower) && !/(as|is|us|ys)$/i.test(lower)) {
    return trimmed;
  }

  if (lower.endsWith('ė')) {
    return capitalizeLike(trimmed, `${trimmed.slice(0, -1)}e`);
  }

  if (lower.endsWith('is')) {
    return capitalizeLike(trimmed, `${trimmed.slice(0, -2)}i`);
  }

  if (lower.endsWith('us')) {
    return capitalizeLike(trimmed, `${trimmed.slice(0, -2)}au`);
  }

  if (lower.endsWith('ys')) {
    return capitalizeLike(trimmed, `${trimmed.slice(0, -2)}y`);
  }

  if (lower.endsWith('as')) {
    return capitalizeLike(trimmed, `${trimmed.slice(0, -2)}ai`);
  }

  return trimmed;
}

export function buildLithuanianGreeting(firstName: string | null | undefined): string {
  const trimmed = firstName?.trim();
  if (!trimmed) return 'Labas,';
  return `Labas ${toLithuanianVocative(trimmed)},`;
}
