import React from 'react';

interface State {
  hasError: boolean;
}

/** Mencegah layar putih total kalau ada error tak terduga — tampilkan opsi muat ulang. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Terjadi error pada aplikasi:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6 font-sans">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md text-center">
          <h1 className="text-lg font-bold text-slate-900">Terjadi kesalahan</h1>
          <p className="text-sm text-slate-500 mt-2">
            Aplikasi mengalami masalah tak terduga. Data Anda aman di server — silakan muat ulang halaman.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 px-5 py-2.5 rounded-xl bg-[#004080] hover:bg-[#003366] text-white text-sm font-bold"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }
}
