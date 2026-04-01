'use client';

import { useState } from 'react';

interface DeleteCheckModalProps {
  checkName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteCheckModal({ checkName, onClose, onConfirm }: DeleteCheckModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setDeleting(false);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (!deleting && e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal panel */}
      <div className="relative w-full max-w-sm mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header accent line — red to match destructive intent */}
        <div className="h-0.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-red-400" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            {/* Trash icon */}
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-950/70 border border-red-800/50 shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M6 2h4M2 4h12M5.5 4l.5 8m4.5 0 .5-8M3.5 4l1 9a1 1 0 001 .9h5a1 1 0 001-.9l1-9"
                  stroke="#f87171"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Delete Check
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                This action cannot be undone
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            disabled={deleting}
            className="ml-4 mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            Delete{' '}
            <span className="font-semibold text-white">{checkName}</span>?{' '}
            This will remove all its incident history.
          </p>

          {/* Inline error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-950/60 border border-red-800/60 rounded-lg px-3.5 py-3">
              <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4.25a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zm.75 6.5a.875.875 0 110-1.75.875.875 0 010 1.75z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-800/50 border-t border-gray-700/60">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-transparent border border-gray-600 hover:border-gray-500 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-red-900/30"
          >
            {deleting && (
              <svg
                className="w-4 h-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12" cy="12" r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
