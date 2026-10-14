import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { isImageRef, loadImage } from '../lib/imageRef';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  /** Hanya dipakai bila gambar masih berupa referensi dan sedang diunduh / gagal. */
  wrapperClassName?: string;
}

/**
 * <img> yang paham referensi "rtdb:..." — gambar diunduh sekali saat tampil, lalu di-cache.
 * Untuk URL biasa / data URL lama berperilaku persis seperti <img>.
 */
export const RemoteImage: React.FC<Props> = ({ src, wrapperClassName, className, ...rest }) => {
  const [real, setReal] = useState<string | null>(isImageRef(src) ? null : src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (!isImageRef(src)) {
      setReal(src);
      return;
    }
    setReal(null);
    loadImage(src)
      .then((v) => alive && setReal(v))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [src]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${wrapperClassName || className || ''}`} title="Gambar tidak dapat dimuat">
        <ImageOff className="w-5 h-5" />
      </div>
    );
  }
  if (!real) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${wrapperClassName || className || ''}`}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  return <img src={real} className={className} {...rest} />;
};

/** Hook untuk mendapatkan data URL asli (mis. untuk tautan "Buka Tab Baru"). */
export function useResolvedImage(src?: string | null): string | null {
  const [real, setReal] = useState<string | null>(src && !isImageRef(src) ? src : null);
  useEffect(() => {
    let alive = true;
    if (!src) {
      setReal(null);
      return;
    }
    if (!isImageRef(src)) {
      setReal(src);
      return;
    }
    setReal(null);
    loadImage(src).then((v) => alive && setReal(v)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [src]);
  return real;
}
