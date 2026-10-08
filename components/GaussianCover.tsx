import React, { useEffect, useRef, useState } from 'react';
import type { GaussianSceneMetadata } from '../utils/gaussianViewer';
import type { Lang } from '../types';

interface GaussianCoverProps {
  sceneUrl: string;
  alt: string;
  width: number;
  height: number;
  mobile: boolean;
  lang: Lang;
}

const GaussianCover: React.FC<GaussianCoverProps> = ({ sceneUrl, alt, width, height, mobile, lang }) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'processing' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const host = surfaceRef.current;
    if (!host) return;
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    setStatus('loading');
    setProgress(0);
    const load = async () => {
      const manifestUrl = new URL(sceneUrl, window.location.href);
      const response = await fetch(manifestUrl, { signal: controller.signal });
      if (!response.ok) throw new Error('3D scene unavailable');
      const metadata: GaussianSceneMetadata = await response.json();
      if (!metadata.src || !(metadata.fov > 0 && metadata.fov < 170) || !(metadata.focusDepth > 0)) {
        throw new Error('Invalid 3D scene');
      }
      const variant = mobile && metadata.mobile ? metadata.mobile : metadata;
      const download = await fetch(new URL(variant.src, manifestUrl), { signal: controller.signal });
      if (!download.ok) throw new Error('3D download failed');
      const total = Number(download.headers.get('content-length')) || variant.bytes;
      let bytes: Uint8Array;
      if (download.body) {
        const reader = download.body.getReader();
        const chunks: Uint8Array[] = [];
        let loaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          if (!controller.signal.aborted && total > 0) setProgress(Math.min(100, Math.floor(loaded / total * 100)));
        }
        bytes = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      } else bytes = new Uint8Array(await download.arrayBuffer());
      return { metadata, bytes };
    };
    Promise.all([import('../utils/gaussianViewer'), load()]).then(async ([module, { metadata, bytes }]) => {
      if (controller.signal.aborted) return;
      setStatus('processing');
      dispose = await module.createGaussianViewer(host, metadata, bytes, mobile, controller.signal, () => {
        if (!controller.signal.aborted) setStatus('error');
      });
      if (controller.signal.aborted) dispose();
      else setStatus('ready');
    }).catch(() => {
      if (!controller.signal.aborted) {
        setStatus('error');
        controller.abort();
      }
    });
    return () => { controller.abort(); dispose?.(); };
  }, [sceneUrl, mobile, retry]);

  const failed = lang === 'en' ? 'Unable to load 3D' : lang === 'tw' ? '3D 載入失敗' : '3D 加载失败';
  const retryLabel = lang === 'en' ? 'Retry' : lang === 'tw' ? '重試' : '重试';
  return (
    <div role="img" aria-label={`${alt} — 3D`} data-gaussian-cover className="relative w-full bg-white select-none" style={{ aspectRatio: `${width} / ${height}` }}>
      <div ref={surfaceRef} className={`absolute inset-0 transition-opacity duration-200 ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`} />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[10px] tracking-[0.12em] text-gray-400">
          {status === 'error' ? <>
            <span role="status">{failed}</span>
            <button type="button" onClick={(event) => { event.stopPropagation(); setRetry((value) => value + 1); }}
              onMouseDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}
              className="text-black underline underline-offset-4">{retryLabel}</button>
          </> : <>
            <span role="status">3D {status === 'loading' ? `${progress}%` : '…'}</span>
            <span aria-hidden="true" className="h-px w-16 bg-gray-100 overflow-hidden">
              <span className="block h-full bg-gray-400 transition-[width] duration-200" style={{ width: `${status === 'processing' ? 100 : progress}%` }} />
            </span>
          </>}
        </div>
      )}
    </div>
  );
};

export default GaussianCover;
