import type { Audience, CategorySummary, WholesaleConditionScope } from "../../shared/contracts";

function titleCase(value: string) {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

export function wholesaleAudienceLabel(audiences: Audience[]) {
  if (audiences.length > 1) return "Mixed audience";
  return audiences[0] === "kids" ? "Kids" : titleCase(audiences[0] ?? "Mixed audience");
}

export function wholesaleConditionLabel(condition: WholesaleConditionScope) {
  return condition === "mixed" ? "Mixed condition" : titleCase(condition);
}

export function wholesaleCategoryLabel(categories: CategorySummary[]) {
  const names = categories.map((category) => category.name);
  if (names.length <= 1) return names[0] ?? "Assorted clothing";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
