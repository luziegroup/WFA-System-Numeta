import React from 'react';
import { AlertTriangle, MapPin, X, Video, ArrowRight, ShieldAlert, ListChecks } from 'lucide-react';
import { ZoomMeetingInfo } from '../types';
import { SidebarMenuId } from './Sidebar';

interface AbsenRequiredModalProps {
  isOpen: boolean;
  meeting: ZoomMeetingInfo | null;
  userName: string;
  /** 'absen': belum absen pagi/siang. 'todo': sudah absen tapi To-Do List/centang tugas belum diisi. */
  reason: 'absen' | 'todo';
  onClose: () => void;
  onNavigateToAbsensi: () => void;
  onNavigateToTodo: () => void;
}

export const AbsenRequiredModal: React.FC<AbsenRequiredModalProps> = ({
  isOpen,
  meeting,
  userName,
  reason,
  onClose,
  onNavigateToAbsensi,
  onNavigateToTodo,
}) => {
  if (!isOpen || !meeting) return null;

  const isPagi = meeting.session === 'pagi';
  const sesiLabel = isPagi ? 'Pagi' : 'Siang';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header with Warning Icon */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-xs border border-amber-200">
              <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                {reason === 'absen'
                  ? `Wajib Absen ${sesiLabel} Terlebih Dahulu`
                  : isPagi
                  ? 'Wajib Isi To-Do List Dulu'
                  : 'Wajib Centang Tugas Dulu'}
              </h3>
              <p className="text-xs text-amber-700 font-semibold mt-0.5">
                {reason === 'absen'
                  ? 'Verifikasi kehadiran WFA sebelum gabung Google Meet'
                  : 'Selesaikan To-Do List sebelum gabung Google Meet'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Body */}
        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          {reason === 'absen' ? (
            <>
              <p>
                Halo, <strong className="text-slate-800">{userName}</strong>! Anda belum tercatat melakukan{' '}
                <strong>Absen {sesiLabel}</strong> hari ini.
              </p>
              <p className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 text-amber-900">
                Sesuai Standar Operasional Prosedur (SOP) WFA Luzie Group, setiap karyawan wajib melakukan{' '}
                <strong>Absen {sesiLabel} + Verifikasi GPS</strong> sebelum dapat bergabung ke ruang Google Meet
                koordinasi tim.
              </p>
            </>
          ) : (
            <>
              <p>
                Halo, <strong className="text-slate-800">{userName}</strong>! Absen {sesiLabel} Anda sudah tercatat,
                tapi {isPagi ? 'To-Do List rencana kerja' : 'centang tugas selesai'} hari ini{' '}
                <strong>belum diisi</strong>.
              </p>
              <p className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 text-amber-900">
                Supaya koordinator tetap bisa memantau progres kerja Anda, {isPagi ? 'tulis rencana tugas' : 'centang tugas yang sudah selesai beserta buktinya'} terlebih dahulu sebelum bergabung ke Google Meet.
              </p>
            </>
          )}

          {/* Meeting Summary Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Video className="w-3.5 h-3.5 text-blue-600" />
              <span>{meeting.title}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Jadwal: {meeting.date} &bull; {meeting.time} WIB &bull; Host: {meeting.hostName}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors"
          >
            Batal
          </button>
          {reason === 'absen' ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToAbsensi();
              }}
              className="px-5 py-2.5 rounded-xl bg-[#0066b2] hover:bg-[#005594] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span>Absen {sesiLabel} Sekarang</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToTodo();
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <ListChecks className="w-4 h-4" />
              <span>{isPagi ? 'Isi To-Do List Sekarang' : 'Centang Tugas Sekarang'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
