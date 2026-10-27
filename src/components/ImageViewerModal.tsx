import React, { useEffect, useState } from 'react';
import { Columns2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { ViewerImageItem } from '../types/consensus';

interface ImageViewerModalProps {
  items: ViewerImageItem[];
  activeId: string | null;
  onSelectId: (id: string) => void;
  onCloseItem: (id: string) => void;
  onCloseAll: () => void;
}

interface TransformState {
  zoom: number;
  panX: number;
  panY: number;
}

const DEFAULT_TRANSFORM: TransformState = { zoom: 1, panX: 0, panY: 0 };

const ZoomableSvgStage: React.FC<{ item: ViewerImageItem }> = ({ item }) => {
  const [transform, setTransform] = useState<TransformState>(DEFAULT_TRANSFORM);
  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  useEffect(() => {
    setTransform(DEFAULT_TRANSFORM);
  }, [item.src]);

  const adjustZoom = (delta: number) => {
    setTransform((prev) => {
      const nextZoom = Math.max(1, Math.min(4, Math.round((prev.zoom + delta) * 100) / 100));
      if (nextZoom === 1) {
        return DEFAULT_TRANSFORM;
      }
      return { ...prev, zoom: nextZoom };
    });
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!e.deltaY) return;
    adjustZoom(e.deltaY < 0 ? 0.2 : -0.2);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (transform.zoom <= 1) return;
    setDragging(true);
    setDragOrigin({
      x: e.clientX,
      y: e.clientY,
      panX: transform.panX,
      panY: transform.panY,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const dx = (dragOrigin.x - e.clientX) / transform.zoom;
    const dy = (dragOrigin.y - e.clientY) / transform.zoom;
    const maxOffset = 500 - 500 / transform.zoom;
    setTransform((prev) => ({
      ...prev,
      panX: Math.max(-maxOffset, Math.min(maxOffset, dragOrigin.panX + dx)),
      panY: Math.max(-maxOffset, Math.min(maxOffset, dragOrigin.panY + dy)),
    }));
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const viewWidth = 1000 / transform.zoom;
  const viewHeight = 760 / transform.zoom;
  const viewX = (1000 - viewWidth) / 2 + transform.panX;
  const viewY = (760 - viewHeight) / 2 + transform.panY;

  return (
    <div className="flex flex-col min-h-0 h-full bg-[#060f1c] rounded-xl border border-slate-400/20 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-400/15 bg-slate-900/80">
        <div className="min-w-0">
          <div className="text-xs font-bold text-cyan-200 truncate">{item.title}</div>
          {item.subtitle && (
            <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => adjustZoom(-0.25)}
            disabled={transform.zoom <= 1}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-400/25 bg-white/5 text-slate-200 hover:bg-white/10"
            title="Réduire le zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="min-w-12 text-center text-[11px] font-extrabold text-cyan-100">
            {Math.round(transform.zoom * 100)} %
          </span>
          <button
            type="button"
            onClick={() => adjustZoom(0.25)}
            disabled={transform.zoom >= 4}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-400/25 bg-white/5 text-slate-200 hover:bg-white/10"
            title="Augmenter le zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTransform(DEFAULT_TRANSFORM)}
            disabled={transform.zoom <= 1}
            className="inline-flex items-center gap-1 px-2 h-7 rounded-lg border border-slate-400/25 bg-white/5 text-[11px] text-slate-200 hover:bg-white/10"
            title="Taille d'origine"
          >
            <RotateCcw className="w-3 h-3" />
            100 %
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <svg
          className={`w-full h-full select-none ${
            transform.zoom > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
          }`}
          viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={() =>
            transform.zoom > 1 ? setTransform(DEFAULT_TRANSFORM) : adjustZoom(1)
          }
        >
          <image
            href={item.src}
            x="40"
            y="30"
            width="920"
            height="700"
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      </div>
    </div>
  );
};

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  items,
  activeId,
  onSelectId,
  onCloseItem,
  onCloseAll,
}) => {
  const [splitCompare, setSplitCompare] = useState(false);

  useEffect(() => {
    if (!items.length) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items.length, onCloseAll]);

  if (!items.length) return null;

  const activeItem = items.find((i) => i.id === activeId) || items[items.length - 1];
  const secondaryItem =
    items.length > 1
      ? items.find((i) => i.id !== activeItem.id) || items[0]
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCloseAll();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Visionneuse d'images QA"
        className="flex flex-col w-full max-w-6xl h-[86vh] rounded-2xl border border-cyan-400/35 bg-[#07111f] shadow-2xl overflow-hidden"
      >
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-400/20 bg-slate-900/90">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5">
            {items.map((item) => {
              const isSelected = item.id === activeItem.id;
              return (
                <div
                  key={item.id}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                    isSelected
                      ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100 font-semibold'
                      : 'border-slate-400/20 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectId(item.id)}
                    className="truncate max-w-44 text-left"
                  >
                    {item.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCloseItem(item.id)}
                    className="text-slate-400 hover:text-rose-300"
                    title="Fermer cette image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setSplitCompare((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  splitCompare
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                    : 'border-slate-400/25 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                Comparer côte à côte
              </button>
            )}
            <button
              type="button"
              onClick={onCloseAll}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-400/25 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-rose-500/20 hover:border-rose-400/40"
            >
              <X className="w-3.5 h-3.5" />
              Fermer (Échap)
            </button>
          </div>
        </header>

        <div
          className={`flex-1 min-h-0 p-3 grid gap-3 ${
            splitCompare && secondaryItem ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          <ZoomableSvgStage item={activeItem} />
          {splitCompare && secondaryItem && <ZoomableSvgStage item={secondaryItem} />}
        </div>

        <footer className="px-4 py-2 border-t border-slate-400/15 bg-slate-950/60 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Molette ou double-clic pour zoomer jusqu’à 400 % · Glisser pour déplacer l’image zoomée.</span>
          <span>Astuce : cliquez sur l’image principale puis sur une image produit pour les comparer côte à côte.</span>
        </footer>
      </section>
    </div>
  );
};
