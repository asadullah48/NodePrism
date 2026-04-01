'use client';
import { useState } from 'react';
import { UptimeCheckWithStatus, CreateUptimeCheckInput } from '@nodeprism/shared';
import { useUptimeChecks } from '../hooks/useUptimeChecks';
import { AddCheckModal } from './AddCheckModal';
import { DeleteCheckModal } from './DeleteCheckModal';

export function UptimeChecks() {
  const { checks, loading, addCheck, deleteCheck } = useUptimeChecks();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UptimeCheckWithStatus | null>(null);

  const handleAdd = async (data: CreateUptimeCheckInput) => {
    await addCheck(data);
    // AddCheckModal calls onClose() on success, which maps to () => setShowAdd(false)
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCheck(deleteTarget.id);
    // DeleteCheckModal calls onClose() on success, which maps to () => setDeleteTarget(null)
  };

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700">Uptime Checks</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Check
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <p className="text-sm text-gray-400">Loading uptime checks...</p>
      )}

      {/* Empty state */}
      {!loading && checks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow">
          <p className="text-gray-500 mb-4">No uptime checks configured yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add your first check
          </button>
        </div>
      )}

      {/* Checks grid */}
      {!loading && checks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {checks.map((check) => (
            <div
              key={check.id}
              className="bg-white rounded-xl shadow p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-800">{check.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {check.type.toUpperCase()} · {check.target}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    check.status === 'up'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {check.status.toUpperCase()}
                </span>
                <button
                  onClick={() => setDeleteTarget(check)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  aria-label={`Delete ${check.name}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddCheckModal onClose={() => setShowAdd(false)} onSubmit={handleAdd} />
      )}
      {deleteTarget && (
        <DeleteCheckModal
          checkName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
}
