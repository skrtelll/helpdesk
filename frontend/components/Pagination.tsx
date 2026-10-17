export default function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn small" disabled={page === 0} onClick={() => onChange(page - 1)}>← Назад</button>
      <span className="muted">Страница {page + 1} из {totalPages}</span>
      <button className="btn small" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>Вперёд →</button>
    </div>
  );
}
