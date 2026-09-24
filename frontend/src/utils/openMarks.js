import { useCallback, useEffect, useState } from 'react';

// Penanda "resi ini yang keberapa aku buka".
//
// Dipakai saat membongkar paket di meja: tiap resi yang dibuka diberi nomor
// urut, lalu nomor itu jadi patokan waktu menyortir foto arrival — foto ke-3
// milik resi bernomor 3. Begitu resi itu selesai (labelnya sudah dicetak DAN
// foto arrival sudah masuk), penandanya hilang sendiri dan nomor mulai dari 1
// lagi.
//
// Catatan: penanda ini sengaja hanya disimpan di komputer ini (localStorage),
// bukan di database. Sifatnya catatan kerja sesaat untuk satu orang di satu
// meja, bukan data resi yang perlu dilihat orang lain.

const KEY = 'wh_open_marks';

const safe = fn => { try { return fn(); } catch { return null; } };

const read = () => safe(() => JSON.parse(localStorage.getItem(KEY) || '{}')) || {};
const write = marks => safe(() => localStorage.setItem(KEY, JSON.stringify(marks)));

// Sudah selesai = label tercetak dan foto arrival sudah ada
const isDone = (mark, parcel) => !!(mark?.printed && parcel?.photo_url);

export function useOpenMarks(parcels) {
  const [marks, setMarks] = useState(read);

  const save = useCallback(next => { setMarks(next); write(next); }, []);

  // Bersihkan sendiri begitu resinya selesai, atau resinya sudah tidak ada
  useEffect(() => {
    if (!parcels?.length || !Object.keys(marks).length) return;
    const byId = new Map(parcels.map(p => [String(p.id), p]));
    const next = {};
    let changed = false;
    for (const [id, mark] of Object.entries(marks)) {
      const parcel = byId.get(id);
      if (parcel && isDone(mark, parcel)) { changed = true; continue; }
      next[id] = mark;
    }
    if (changed) save(next);
  }, [parcels, marks, save]);

  const nextNumber = Math.max(0, ...Object.values(marks).map(m => m.order || 0)) + 1;

  const mark = useCallback(id => {
    const current = read();
    const next = Math.max(0, ...Object.values(current).map(m => m.order || 0)) + 1;
    save({ ...current, [String(id)]: { order: next, printed: false } });
  }, [save]);

  const unmark = useCallback(id => {
    const next = { ...read() };
    delete next[String(id)];
    save(next);
  }, [save]);

  // Dipanggil setelah label benar-benar dicetak
  const markPrinted = useCallback(ids => {
    const current = read();
    const next = { ...current };
    let changed = false;
    for (const id of ids) {
      const key = String(id);
      if (next[key] && !next[key].printed) { next[key] = { ...next[key], printed: true }; changed = true; }
    }
    if (changed) save(next);
  }, [save]);

  const clearAll = useCallback(() => save({}), [save]);

  const get = useCallback(id => marks[String(id)] || null, [marks]);

  return { marks, get, mark, unmark, markPrinted, clearAll, nextNumber, count: Object.keys(marks).length };
}
