import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const ICONS = {
  parcel_add: '➕',
  parcel_edit: '✏️',
  parcel_owner: '👤',
  parcel_delete: '🗑',
  request_approve: '✅',
  request_reject: '✖️',
  request_owner: '👤',
  batch_complete: '📦',
  batch_tarif: '💰',
  batch_private: '🔒',
  code_add: '🔑',
  code_edit: '🔑',
  code_delete: '🔑',
  note: '📝',
};

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'parcel', label: '📦 Resi' },
  { key: 'request', label: '📬 Setoran' },
  { key: 'note', label: '📝 Catatanku' },
];

const dayKey = iso => new Date(iso).toDateString();

const dayTitle = iso => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hari ini';
  if (d.toDateString() === yest.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};

const clock = iso =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

export default function AdminLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch('/api/logs')
      .then(r => r.json())
      .then(d => { setLogs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: note.trim() }),
      });
      if (res.ok) {
        const saved = await res.json();
        setLogs(prev => [saved, ...prev]);
        setNote('');
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeLog(id) {
    if (!window.confirm('Hapus baris catatan ini?')) return;
    await fetch(`/api/logs/${id}`, { method: 'DELETE' });
    setLogs(prev => prev.filter(l => l.id !== id));
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(l => {
      if (filter === 'note' && l.action !== 'note') return false;
      if (filter === 'parcel' && !l.action.startsWith('parcel')) return false;
      if (filter === 'request' && !l.action.startsWith('request')) return false;
      if (q && !`${l.summary} ${l.detail || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, search, filter]);

  // Kelompokkan per hari, urut dari yang terbaru
  const days = useMemo(() => {
    const map = new Map();
    for (const l of shown) {
      const k = dayKey(l.created_at);
      if (!map.has(k)) map.set(k, { key: k, at: l.created_at, items: [] });
      map.get(k).items.push(l);
    }
    return [...map.values()];
  }, [shown]);

  return (
    <div className="p-5 md:p-7 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-3xl">📝</span>
        <div>
          <h1 className="text-xl font-bold text-matcha-800">Catatan</h1>
          <p className="text-sm text-gray-500">Riwayat perubahan yang kamu lakukan, per hari</p>
        </div>
      </div>

      {/* Tulis catatan sendiri */}
      <form onSubmit={addNote} className="flex gap-2 mb-4">
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Tulis catatan sendiri... (cth: koper batch 2 berangkat Jumat)"
          className="input-field flex-1 text-sm"
        />
        <button type="submit" disabled={saving || !note.trim()} className="btn-primary px-4 disabled:opacity-40">
          {saving ? '...' : '+ Catat'}
        </button>
      </form>

      {/* Cari + saring */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, nomor resi, atau kata apa saja..."
            className="input-field pl-9 pr-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          )}
        </div>
        <div className="flex gap-1 bg-cream-50 border border-cream-200 rounded-xl p-0.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filter === f.key ? 'bg-matcha-800 text-white' : 'text-gray-500 hover:text-matcha-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lembar catatan */}
      {loading ? (
        <LoadingSpinner text="Membuka catatan..." />
      ) : days.length === 0 ? (
        <div className="bg-white rounded-2xl border border-cream-200 p-14 text-center text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-medium">{logs.length === 0 ? 'Belum ada catatan' : 'Tidak ada yang cocok'}</p>
          <p className="text-sm mt-1">
            {logs.length === 0
              ? 'Setiap perubahan resi, setoran, dan tarif akan tercatat di sini otomatis'
              : 'Coba ganti kata kunci atau saringannya'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map(day => (
            <div key={day.key}>
              {/* Tanggal */}
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-sm font-bold text-matcha-800">{dayTitle(day.at)}</h2>
                <span className="text-xs text-gray-400">{day.items.length} catatan</span>
                <div className="flex-1 h-px bg-cream-300" />
              </div>

              {/* Baris-baris catatan */}
              <div className="bg-white rounded-2xl border border-cream-200 shadow-soft overflow-hidden">
                {day.items.map((l, i) => (
                  <div
                    key={l.id}
                    className={`group flex gap-3 px-4 py-2.5 hover:bg-cream-50/70 transition-colors ${
                      i > 0 ? 'border-t border-cream-100' : ''
                    } ${l.action === 'note' ? 'bg-amber-50/40' : ''}`}
                  >
                    <span className="text-xs font-mono text-gray-400 pt-0.5 w-10 flex-shrink-0">
                      {clock(l.created_at)}
                    </span>
                    <span className="text-sm flex-shrink-0">{ICONS[l.action] || '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{l.summary}</p>
                      {l.detail && (
                        <p className="text-xs text-gray-400 mt-0.5">{l.detail}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeLog(l.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 px-1"
                      title="Hapus baris ini"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
