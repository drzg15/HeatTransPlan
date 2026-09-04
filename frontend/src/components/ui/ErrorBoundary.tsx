import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useProjectStore } from '../../store/projectStore';

interface Props {
  children?: ReactNode;
  onReset: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-color, #f4f5f7)',
            color: 'var(--text-color, #333)',
            padding: '24px',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 600,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              background: 'var(--surface, #ffffff)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            }}
          >
            <h2 style={{ margin: 0, color: '#d32f2f' }}>⚠️ Application Error</h2>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              A critical error occurred while rendering the application. This could be due to
              corrupted local data or an unexpected state.
            </p>
            <div
              style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 8,
                overflow: 'auto',
                fontSize: 12,
                maxHeight: 150,
                color: '#d32f2f',
                fontFamily: 'monospace',
              }}
            >
              {this.state.error?.message}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => window.location.reload()}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #ccc',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  this.props.onReset();
                  window.location.reload();
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: '#d32f2f',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Reset All Local Data
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper to inject the Zustand store action into the class component
export default function ErrorBoundary({ children }: { children: ReactNode }) {
  const resetState = useProjectStore((s) => s.resetState);
  return <ErrorBoundaryClass onReset={resetState}>{children}</ErrorBoundaryClass>;
}
