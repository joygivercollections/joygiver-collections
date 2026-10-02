export interface PromotionInputLine {
  key: string;
  unitPriceKobo: number;
  quantity: number;
  eligible: boolean;
}

export interface PromotionCalculation {
  eligibleQuantity: number;
  discountedQuantity: number;
  discountKobo: number;
  lines: Array<{ key: string; discountedQuantity: number; discountKobo: number }>;
}

export function calculatePromotion(
  lines: PromotionInputLine[],
  rule: { requiredQuantity: number; discountBasisPoints: number },
): PromotionCalculation {
  const eligibleQuantity = lines.reduce((total, line) => total + (line.eligible ? line.quantity : 0), 0);
  const discountedQuantity = Math.floor(eligibleQuantity / rule.requiredQuantity) * rule.requiredQuantity;
  let remaining = discountedQuantity;
  const allocations = new Map<string, { discountedQuantity: number; discountKobo: number }>();

  const ordered = lines
    .filter((line) => line.eligible && line.quantity > 0)
    .map((line, index) => ({ ...line, index }))
    .sort((a, b) => a.unitPriceKobo - b.unitPriceKobo || a.key.localeCompare(b.key) || a.index - b.index);

  for (const line of ordered) {
    const quantity = Math.min(line.quantity, remaining);
    const perUnitDiscount = Math.floor(line.unitPriceKobo * rule.discountBasisPoints / 10_000);
    allocations.set(line.key, { discountedQuantity: quantity, discountKobo: perUnitDiscount * quantity });
    remaining -= quantity;
  }

  const resultLines = lines.map((line) => ({ key: line.key, ...(allocations.get(line.key) ?? { discountedQuantity: 0, discountKobo: 0 }) }));
  return {
    eligibleQuantity,
    discountedQuantity,
    discountKobo: resultLines.reduce((total, line) => total + line.discountKobo, 0),
    lines: resultLines,
  };
}
