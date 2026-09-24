import React from 'react';
import { useApp } from '../context/AppContext';
import { X, ExternalLink, Image as ImageIcon } from 'lucide-react';

export const ImageModal: React.FC = () => {
  const { activeImageModal, closeImageModal } = useApp();

  if (!activeImageModal) return null;

  return (
    <div
      id="proof-image-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={closeImageModal}
    >
      <div
        id="proof-image-modal-content"
        className="relative max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm md:text-base">
                {activeImageModal.title || 'Foto Bukti Pekerjaan'}
              </h3>
              <p className="text-xs text-slate-500">Lampiran bukti to-do list WFA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={activeImageModal.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Buka Tab Baru</span>
            </a>
            <button
              onClick={closeImageModal}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Content */}
        <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950/5 min-h-[300px]">
          <img
            src={activeImageModal.url}
            alt="Bukti Pekerjaan"
            referrerPolicy="no-referrer"
            className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain shadow-sm border border-slate-200"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-500">
          <span>Verifikasi bukti pekerjaan to-do list</span>
          <button
            onClick={closeImageModal}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
