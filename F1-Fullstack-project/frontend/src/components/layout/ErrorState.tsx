import React from 'react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 text-lg mb-4">{message || 'Gagal Memuat Data'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Coba Lagi
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorState;
