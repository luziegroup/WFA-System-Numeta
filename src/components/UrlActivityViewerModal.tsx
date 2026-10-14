import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Globe, X } from 'lucide-react';
import { dbRef, get } from '../lib/firebase';
import { UrlDomainSummary, UrlVisitRecord, User } from '../types';
import { formatDuration } from '../utils/hubstaffUtils';

const safeKey = (s: string) => s.replace(/[.#$\[\]/]/g, '_');
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const faviconFor = (domain: string) => `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`;

export const UrlActivityViewerModal: React.FC<{ member: User; date: string; onClose: () => void }> = ({ member, date, onClose }) => {
  const [visits, setVisits] = useState<UrlVisitRecord[] | null>(null);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  useEffect(() => {
    get(dbRef(`urlActivity/${date}/${safeKey(member.id)}/visits`))
      .then((snap) => {
        const val = (snap.val() || {}) as Record<string, UrlVisitRecord>;
        setVisits(Object.values(val).sort((a, b) => b.ts - a.ts));
      })
      .catch(() => setVisits([]));
  }, [date, member.id]);

  const domains: UrlDomainSummary[] = useMemo(() => {
    if (!visits) return [];
    const map = new Map<string, UrlDomainSummary>();
    visits.forEach((v) => {
      const cur = map.get(v.domain) || { domain: v.domain, seconds: 0, visits: 0 };
      cur.seconds += v.seconds || 0;
      cur.visits += 1;
      map.set(v.domain, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.seconds - a.seconds);
  }, [visits]);

  const totalSeconds = domains.reduce((t, d) => t + d.seconds, 0);
  const filtered = activeDomain ? (visits || []).filter((v) => v.domain === activeDomain) : visits || [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Globe className="w-4 h-4 text-blue-600" />
            <span>Riwayat Alamat &mdash; {member.name} &bull; {date}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Tutup"><X className="w-5 h-5" /></button>
        </div>

        {visits === null ? (
          <div className="text-center text-xs text-slate-400 py-12">Memuat...</div>
        ) : visits.length === 0 ? (
          <div className="text-center text-xs text-slate-400 py-12 px-5">
            Belum ada data untuk tanggal ini. Pastikan ekstensi browser sudah dipasang dan dipasangkan (pairing).
          </div>
        ) : (
          <div className="flex flex-1 min-h-0">
            <div className="w-56 border-r border-slate-100 overflow-y-auto p-3 space-y-1 shrink-0">
              <button
                onClick={() => setActiveDomain(null)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-between ${
                  !activeDomain ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>Semua Situs</span>
                <span className="font-mono font-normal">{formatDuration(totalSeconds)}</span>
              </button>
              {domains.map((d) => (
                <button
                  key={d.domain}
                  onClick={() => setActiveDomain(d.domain)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 ${
                    activeDomain === d.domain ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <img src={faviconFor(d.domain)} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0" />
                  <span className="flex-1 truncate">{d.domain}</span>
                  <span className="font-mono text-[10px] shrink-0">{formatDuration(d.seconds)}</span>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              {filtered.map((v, i) => (
                <a
                  key={`${v.ts}-${i}`}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 group"
                >
                  <img src={faviconFor(v.domain)} alt="" className="w-4 h-4 rounded-sm shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{v.title || v.url}</div>
                    <div className="text-[10px] text-slate-400 truncate">{v.url}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-mono text-slate-500">{fmtTime(v.ts)}</div>
                    <div className="text-[10px] font-bold text-slate-600">{formatDuration(v.seconds)}</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-500 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
