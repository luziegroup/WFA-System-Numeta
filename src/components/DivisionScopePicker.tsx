import React from 'react';

/** Pemilih cakupan divisi untuk satu fitur monitoring. Array kosong = semua divisi. */
export const DivisionScopePicker: React.FC<{
  label?: string;
  divisions: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}> = ({ label = 'Berlaku untuk divisi', divisions, selected, onChange, disabled }) => {
  const isAll = selected.length === 0;
  const toggle = (d: string) => onChange(selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d]);

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
        <button
          type="button"
          onClick={() => onChange([])}
          className={`py-2 rounded-xl border text-xs font-bold transition-colors ${
            isAll ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Semua Divisi
        </button>
        <button
          type="button"
          onClick={() => { if (isAll) onChange(divisions.slice(0, 1)); }}
          className={`py-2 rounded-xl border text-xs font-bold transition-colors ${
            !isAll ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Divisi Tertentu
        </button>
      </div>
      {!isAll && (
        <div className="mt-2 rounded-xl border border-slate-100 divide-y divide-slate-100 max-h-48 overflow-y-auto">
          {divisions.length === 0 ? (
            <div className="p-3 text-[11px] text-slate-400">Belum ada data divisi.</div>
          ) : (
            divisions.map((d) => (
              <label key={d} className="flex items-center justify-between p-2.5 text-xs cursor-pointer hover:bg-slate-50">
                <span className="font-semibold text-slate-700">{d}</span>
                <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} className="w-4 h-4 accent-blue-600" />
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
};
