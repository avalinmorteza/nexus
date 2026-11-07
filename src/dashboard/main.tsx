import React from 'react';
import { createRoot } from 'react-dom/client';
import '@nexus-font';
import '../styles.css';
import { initStore } from '../lib/store';
import { App } from './App';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-2 p-6 text-center">
          <div className="text-[15px] font-semibold">Something went wrong</div>
          <div className="max-w-md text-sm text-ink2">{this.state.error.message}</div>
          <button className="mt-2 text-sm text-accent hover:underline" onClick={() => location.reload()}>
            Reload NEXUS
          </button>
        </div>
      );
    return this.props.children;
  }
}

initStore();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
