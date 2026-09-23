import { useState } from 'react';
import AdminTarif from './AdminTarif';
import AdminPackages from './AdminPackages';
import AdminCodes from './AdminCodes';

const TABS = [
  { key: 'tarif', label: 'Tarif', hint: 'Biaya per gram, satuan, unboxing, denda' },
  { key: 'paket', label: 'Paket WH', hint: 'Kuota resi per pelanggan' },
  { key: 'kode',  label: 'Kode Akses', hint: 'Akun pelanggan dan hak aksesnya' },
];

export default function AdminSettings() {
  const [tab, setTab] = useState('tarif');
  const active = TABS.find(t => t.key === tab);

  return (
    <div>
      <div className="px-5 md:px-7 pt-5 md:pt-7 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">{active?.hint}</p>

        <div className="flex gap-1 mt-4 border-b border-slate-200">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm px-4 py-2 -mb-px border-b-2 font-medium transition-colors ${
                tab === t.key
                  ? 'border-slate-800 text-slate-800'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'tarif' && <AdminTarif />}
      {tab === 'paket' && <AdminPackages />}
      {tab === 'kode' && <AdminCodes />}
    </div>
  );
}
