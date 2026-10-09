/** Units an item can be sold in (LLD §2.1). */
export const UNITS = ['PCS', 'BOX', 'DOZEN', 'PACK', 'CASE', 'KG', 'G', 'L', 'ML'] as const;
export type Unit = (typeof UNITS)[number];

interface UnitRule {
  /** Fractions allowed (weight / volume). */
  allowsDecimal: boolean;
  /** Default stepper step, in milli-units. */
  stepMilli: number;
}

export const UNIT_RULES: Readonly<Record<Unit, UnitRule>> = {
  PCS: { allowsDecimal: false, stepMilli: 1000 },
  BOX: { allowsDecimal: false, stepMilli: 1000 },
  DOZEN: { allowsDecimal: false, stepMilli: 1000 },
  PACK: { allowsDecimal: false, stepMilli: 1000 },
  CASE: { allowsDecimal: false, stepMilli: 1000 },
  KG: { allowsDecimal: true, stepMilli: 500 },
  G: { allowsDecimal: true, stepMilli: 50_000 },
  L: { allowsDecimal: true, stepMilli: 500 },
  ML: { allowsDecimal: true, stepMilli: 50_000 },
};
