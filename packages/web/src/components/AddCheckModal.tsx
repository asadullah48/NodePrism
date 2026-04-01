'use client';

import { useState } from 'react';
import { CreateUptimeCheckInput } from '@nodeprism/shared';

interface AddCheckModalProps {
  onClose: () => void;
  onSubmit: (data: CreateUptimeCheckInput) => Promise<void>;
}

export function AddCheckModal({ onClose, onSubmit }: AddCheckModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'http' | 'tcp'>('http');
  const [target, setTarget] = useState('');
  const [intervalValue, setIntervalValue] = useState('60');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    if (!name.trim()) {
      setValidationError('Name is required.');
      return;
    }
    if (!type) {
      setValidationError('Type is required.');
      return;
    }
    if (!target.trim()) {
      setValidationError('Target is required.');
      return;
    }

    const intervalNum = Number(intervalValue);
    if (!Number.isFinite(intervalNum) || !Number.isInteger(intervalNum) || intervalNum < 10 || intervalNum > 3600) {
      setValidationError('Interval must be a whole number between 10 and 3600 seconds.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        type,
        target: target.trim(),
        interval: intervalNum,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const targetPlaceholder = type === 'http' ? 'https://example.com' : 'hostname:port';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (!submitting && e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal panel */}
      <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Add Uptime Check
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Monitor an HTTP endpoint or TCP port
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-4 mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 pb-5 space-y-5">

            {/* Name field */}
            <div className="space-y-1.5">
              <label htmlFor="check-name" className="block text-xs font-medium text-gray-300 uppercase tracking-wider">
                Name
              </label>
              <input
                id="check-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production API"
                autoComplete="off"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors"
              />
            </div>

            {/* Type toggle */}
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-gray-300 uppercase tracking-wider">
                Type
              </span>
              <div className="inline-flex rounded-lg border border-gray-600 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setType('http')}
                  className={`px-5 py-2 text-sm font-medium transition-colors ${
                    type === 'http'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
                  }`}
                >
                  HTTP
                </button>
                <button
                  type="button"
                  onClick={() => setType('tcp')}
                  className={`px-5 py-2 text-sm font-medium transition-colors border-l border-gray-600 ${
                    type === 'tcp'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750'
                  }`}
                >
                  TCP
                </button>
              </div>
            </div>

            {/* Target field */}
            <div className="space-y-1.5">
              <label htmlFor="check-target" className="block text-xs font-medium text-gray-300 uppercase tracking-wider">
                Target
              </label>
              <input
                id="check-target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={targetPlaceholder}
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors"
              />
              <p className="text-xs text-gray-500">
                {type === 'http'
                  ? 'Full URL including protocol (http:// or https://)'
                  : 'Hostname or IP address followed by colon and port number'}
              </p>
            </div>

            {/* Interval field */}
            <div className="space-y-1.5">
              <label htmlFor="check-interval" className="block text-xs font-medium text-gray-300 uppercase tracking-wider">
                Interval <span className="normal-case text-gray-500 font-normal">(seconds)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="check-interval"
                  type="number"
                  min={10}
                  max={3600}
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(e.target.value)}
                  className="w-32 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors"
                />
                <span className="text-xs text-gray-500">Range: 10 – 3600 s</span>
              </div>
            </div>

            {/* Validation / submission error */}
            {(validationError || error) && (
              <div className="flex items-start gap-2.5 bg-red-950/60 border border-red-800/60 rounded-lg px-3.5 py-3">
                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4.25a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0v-3.5zm.75 6.5a.875.875 0 110-1.75.875.875 0 010 1.75z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-300">{validationError ?? error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-800/50 border-t border-gray-700/60">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-transparent hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors shadow-lg shadow-cyan-900/30"
            >
              {submitting && (
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
              {submitting ? 'Adding…' : 'Add Check'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
