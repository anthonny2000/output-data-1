import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ChevronDown,
  ClipboardCopy,
  CloudUpload,
  Database,
  FileSpreadsheet,
  LogIn,
  LogOut,
  Upload,
} from 'lucide-react';
import { pluralize } from '../utils/consensusEngine';

interface AppHeaderProps {
  hasModel: boolean;
  importing: boolean;
  firebaseExporting: boolean;
  exportableHitCount: number;
  storedExportsCount: number;
  currentUser: User | null;
  authReady: boolean;
  onTriggerFileSelect: () => void;
  onExportLocal: (format: 'csv' | 'tsv') => void;
  onCopyToClipboard: () => void;
  onOpenFirebaseModal: (initialTab: 'send' | 'stored') => void;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  hasModel,
  importing,
  firebaseExporting,
  exportableHitCount,
  storedExportsCount,
  currentUser,
  authReady,
  onTriggerFileSelect,
  onExportLocal,
  onCopyToClipboard,
  onOpenFirebaseModal,
  onSignInGoogle,
  onSignOutGoogle,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const localAvailable = exportableHitCount > 0;
  const exportLabel = localAvailable
    ? `Exporter · ${pluralize(exportableHitCount, 'HIT soumis exportable', 'HIT soumis exportables')}`
    : 'Exporter';

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 min-h-[70px] px-4 sm:px-8 py-3 border-b border-slate-400/20 bg-[#050e1b]/90 backdrop-blur-xl">
      <div className="flex items-center gap-3 min-w-0">
        <div
          aria-hidden="true"
          className="grid place-items-center w-10 h-10 shrink-0 rounded-xl border border-cyan-400/50 bg-gradient-to-br from-cyan-400/30 to-violet-500/25 text-cyan-50 font-black shadow-lg shadow-cyan-500/15"
        >
          WC
        </div>
        <div className="min-w-0">
          <h1 className="m-0 text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
            Worker Consensus Dashboard
          </h1>
          <p className="m-0 text-xs text-slate-400 truncate">
            Contrôle qualité · consensus manuel traçable · sauvegarde Firebase gratuite
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-end">
        {authReady && (
          currentUser ? (
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="max-w-36 truncate font-medium" title={currentUser.email || ''}>
                {currentUser.displayName || currentUser.email || 'Compte connecté'}
              </span>
              <button
                type="button"
                onClick={onSignOutGoogle}
                disabled={firebaseExporting}
                className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white"
                title="Se déconnecter de Firebase"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignInGoogle}
              className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/12 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/22 transition"
              title="Connecter votre compte Google pour sauvegarder et consulter vos exports Firebase"
            >
              <LogIn className="w-3.5 h-3.5" />
              Connexion Firebase
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onOpenFirebaseModal('stored')}
          className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/10 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20 transition"
          title="Consulter et télécharger les exports stockés dans votre base Firebase Firestore"
        >
          <Database className="w-3.5 h-3.5 text-cyan-300" />
          Base Firebase
          {currentUser && (
            <span className="ml-0.5 rounded-md bg-cyan-400/20 px-1.5 py-0.5 text-[10.5px] font-bold text-cyan-100">
              {storedExportsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onTriggerFileSelect}
          disabled={importing || firebaseExporting}
          className="inline-flex items-center gap-1.5 min-h-9 px-3.5 py-1.5 rounded-xl border border-cyan-400/55 bg-gradient-to-r from-sky-600/85 to-indigo-600/85 text-xs font-semibold text-white shadow-lg shadow-sky-500/20 hover:brightness-110 transition"
        >
          <Upload className="w-3.5 h-3.5" />
          Importer CSV / TSV
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            disabled={!hasModel && !currentUser}
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-xl border border-slate-400/25 bg-white/5 text-xs font-semibold text-slate-100 hover:bg-white/10 hover:border-cyan-300/45 transition"
          >
            {exportLabel}
            <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Choisir le format ou la destination d'export"
              className="absolute right-0 top-[calc(100%+7px)] z-40 grid min-w-56 p-1.5 rounded-xl border border-cyan-400/45 bg-[#07111f]/98 shadow-2xl"
            >
              <button
                type="button"
                role="menuitem"
                disabled={!localAvailable}
                onClick={() => {
                  setMenuOpen(false);
                  onExportLocal('csv');
                }}
                className="flex items-center gap-2 min-h-9 px-2.5 py-2 rounded-lg text-xs text-left text-slate-100 hover:bg-cyan-500/15 hover:text-cyan-100"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                Exporter en CSV (local)
              </button>

              <button
                type="button"
                role="menuitem"
                disabled={!localAvailable}
                onClick={() => {
                  setMenuOpen(false);
                  onExportLocal('tsv');
                }}
                className="flex items-center gap-2 min-h-9 px-2.5 py-2 rounded-lg text-xs text-left text-slate-100 hover:bg-cyan-500/15 hover:text-cyan-100"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                Exporter en TSV (local)
              </button>

              <div className="my-1 border-t border-slate-400/15" />

              <button
                type="button"
                role="menuitem"
                disabled={!hasModel || firebaseExporting}
                onClick={() => {
                  setMenuOpen(false);
                  onOpenFirebaseModal('send');
                }}
                className="flex items-center gap-2 min-h-9 px-2.5 py-2 rounded-lg text-xs font-semibold text-left text-emerald-200 hover:bg-emerald-500/18 hover:text-emerald-50"
              >
                <CloudUpload className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                Envoyer vers Firebase (Cloud)
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenFirebaseModal('stored');
                }}
                className="flex items-center gap-2 min-h-9 px-2.5 py-2 rounded-lg text-xs text-left text-cyan-200 hover:bg-cyan-500/15 hover:text-cyan-50"
              >
                <Database className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                Voir les données Firebase ({storedExportsCount})
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!localAvailable}
          onClick={onCopyToClipboard}
          className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-xl border border-slate-400/25 bg-white/5 text-xs font-semibold text-slate-100 hover:bg-white/10 transition"
          title="Copier les HIT soumis au format TSV avec en-têtes pour coller directement dans Excel ou Google Sheets"
        >
          <ClipboardCopy className="w-3.5 h-3.5 text-slate-300" />
          Copier pour tableur{localAvailable ? ` · ${exportableHitCount}` : ''}
        </button>
      </div>
    </header>
  );
};
