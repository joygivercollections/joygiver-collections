export function Pagination({ page, pageSize, total, onPageChange, label = "results" }: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav className="pagination" aria-label={`${label} pages`}>
      <p>{first}–{last} of {total} {label}</p>
      <div>
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Previous</button>
        <span>Page {page} of {pageCount}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>Next</button>
      </div>
    </nav>
  );
}
