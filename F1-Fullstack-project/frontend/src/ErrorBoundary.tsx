import React from 'react';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class GlobalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-tarmac text-chalk flex items-center justify-center px-6">
          <div className="w-full max-w-xl" role="alert">
            <div className="h-1 w-16 bg-red-600 mb-6" aria-hidden="true" />
            <h1 className="text-3xl font-black tracking-tight">Red flag: the app stopped</h1>
            <p className="mt-3 text-neutral-400 leading-relaxed">
              Something on this page crashed. Reload to get back on track. If it keeps happening, the
              details below help pin down the cause.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 px-5 py-2.5 rounded-md bg-red-600 hover:bg-red-500 text-white font-bold transition-colors"
            >
              Reload Page
            </button>
            {this.state.error && (
              <details className="mt-8 rounded-md border border-neutral-800 bg-neutral-950">
                <summary className="cursor-pointer px-4 py-3 text-sm text-neutral-400 hover:text-chalk">
                  Error details
                </summary>
                <pre className="px-4 pb-4 text-xs text-red-300 whitespace-pre-wrap wrap-break-word overflow-auto max-h-80">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}