// Tombol aksi kecil di baris tabel — kotak membulat bergaris dengan ikon
// garis di dalamnya. Dipakai di tabel Warehouse dan laci Arsip
// supaya aksinya kelihatan sebagai tombol, bukan emoji yang menempel di teks.

// Warnanya ikut tema panel: matcha untuk aksi biasa, strawberry khusus
// yang merusak — supaya tombol hapus tidak tenggelam di antara yang lain.
const TONE = {
  berry: 'border-matcha-200 text-matcha-600 hover:bg-matcha-50 hover:text-matcha-800 hover:border-matcha-400',
  danger: 'border-cream-300 text-gray-400 hover:bg-berry-50 hover:text-berry-600 hover:border-berry-300',
};

export default function ActionButton({ title, onClick, tone = 'berry', disabled, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-xl border-2 bg-white flex items-center justify-center
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${TONE[tone]}`}
    >
      {children}
    </button>
  );
}

// ── Ikon garis ──────────────────────────────────────────────────────
//  Sengaja SVG, bukan emoji: warnanya ikut tombol dan ketebalan garisnya
//  seragam di semua perangkat.
const base = {
  width: 15,
  height: 15,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconEye = () => (
  <svg {...base}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconPencil = () => (
  <svg {...base}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const IconPrinter = () => (
  <svg {...base}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 14h12v8H6z" />
  </svg>
);

export const IconTrash = () => (
  <svg {...base}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
