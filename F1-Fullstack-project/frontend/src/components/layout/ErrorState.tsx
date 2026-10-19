import React from 'react';
import { RotateCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="min-h-screen bg-tarmac flex items-center justify-center px-6">
      <div className="max-w-md text-center" role="alert">
        <div className="mx-auto mb-5 h-1 w-12 bg-red-600" aria-hidden="true" />
        <p className="text-lg font-bold text-chalk">{message || 'Gagal Memuat Data'}</p>
        <p className="mt-2 text-sm text-neutral-400">
          Periksa koneksi ke server data, lalu coba lagi.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-md transition-colors"
          >
            <RotateCw size={16} aria-hidden="true" />
            Coba Lagi
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorState;