import { Link, useSearchParams } from "react-router-dom";
import type { Audience, ProductCondition } from "../../shared/contracts";

const audiences: Array<{ value: Audience; label: string }> = [
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
  { value: "kids", label: "Kids" },
];

export function AudienceTabs({ condition, current }: { condition: ProductCondition; current: Audience }) {
  const [searchParams] = useSearchParams();

  function href(audience: Audience) {
    const next = new URLSearchParams(searchParams);
    next.delete("category");
    next.delete("page");
    const query = next.toString();
    return `/${condition}/${audience}${query ? `?${query}` : ""}`;
  }

  return (
    <nav className="audience-tabs" aria-label="Shop by audience">
      {audiences.map(({ value, label }) => (
        <Link key={value} to={href(value)} aria-current={current === value ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
