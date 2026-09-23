// Sesi admin disimpan di localStorage supaya tidak logout tiap kali tab
// ditutup — penting di ponsel, karena membuka kamera/aplikasi lain sering
// membuat browser membuang sessionStorage.

const TOKEN = 'admin_token';
const ROLE = 'admin_role';

const safe = fn => { try { return fn(); } catch { return null; } };

export function getToken() {
  // Sesi lama masih di sessionStorage — pindahkan sekali, jangan sampai
  // yang sedang login ikut tertendang keluar.
  return safe(() => {
    const kept = localStorage.getItem(TOKEN);
    if (kept) return kept;
    const old = sessionStorage.getItem(TOKEN);
    if (old) {
      localStorage.setItem(TOKEN, old);
      localStorage.setItem(ROLE, sessionStorage.getItem(ROLE) || 'admin');
      sessionStorage.removeItem(TOKEN);
      sessionStorage.removeItem(ROLE);
    }
    return old;
  });
}

export const getRole = () => safe(() => localStorage.getItem(ROLE) || sessionStorage.getItem(ROLE)) || 'admin';

export const isUploader = () => getRole() === 'photo';

export function saveSession(token, role = 'admin') {
  safe(() => {
    localStorage.setItem(TOKEN, token);
    localStorage.setItem(ROLE, role);
  });
}

export function clearSession() {
  safe(() => {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(ROLE);
    sessionStorage.removeItem(TOKEN);
    sessionStorage.removeItem(ROLE);
  });
}
