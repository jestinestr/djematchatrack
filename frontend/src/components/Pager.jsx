import { useEffect, useState } from 'react';

// Potong daftar jadi halaman berisi `size` item. Halaman otomatis
// kembali ke batas akhir kalau jumlah item menyusut (mis. setelah filter).
export function usePaged(items, size = 10) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil((items?.length || 0) / size));

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const current = Math.min(page, pages);
  const start = (current - 1) * size;
  return {
    page: current,
    pages,
    setPage,
    items: (items || []).slice(start, start + size),
    from: items?.length ? start + 1 : 0,
    to: Math.min(start + size, items?.length || 0),
    total: items?.length || 0,
  };
}

export default function Pager({ paged, className = '' }) {
  const { page, pages, setPage, from, to, total } = paged;
  if (pages <= 1) return null;

  // Tampilkan maksimal 5 nomor halaman di sekitar halaman aktif
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);

  const btn = 'min-w-[30px] h-[30px] px-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30';

  return (
    <div className={`flex items-center justify-between gap-2 flex-wrap ${className}`}>
      <span className="text-xs text-gray-400">{from}–{to} dari {total}</span>
      <div className="flex items-center gap-1">
        <button className={`${btn} text-gray-500 hover:bg-cream-100`} disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
        {nums.map(n => (
          <button
            key={n}
            onClick={() => setPage(n)}
            className={`${btn} ${n === page ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:bg-cream-100'}`}
          >
            {n}
          </button>
        ))}
        <button className={`${btn} text-gray-500 hover:bg-cream-100`} disabled={page === pages} onClick={() => setPage(page + 1)}>›</button>
      </div>
    </div>
  );
}
