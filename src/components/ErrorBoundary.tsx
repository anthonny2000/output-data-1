import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { parseStructuredFirestoreError } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const parsed = parseStructuredFirestoreError(this.state.error);
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-rose-400/40 bg-slate-900/95 p-6 shadow-2xl">
          <div className="flex items-center gap-3 text-rose-300 mb-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h2 className="text-lg font-bold text-white m-0">Une erreur est survenue</h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{parsed.userMessage}</p>
          {parsed.upgradeUrl && (
            <p className="text-xs text-cyan-300 mb-4">
              <a
                href={parsed.upgradeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-cyan-100"
              >
                Consulter les détails des quotas Firebase Spark / Cloud Firestore ↗
              </a>
            </p>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30"
          >
            <RotateCcw className="w-4 h-4" />
            Reprendre la session
          </button>
        </div>
      </div>
    );
  }
}
