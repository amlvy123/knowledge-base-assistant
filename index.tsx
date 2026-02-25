import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found in index.html');
}

// 简单的错误边界组件，捕获 React 渲染树内部错误
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("React Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: 40, color: '#ef4444', fontFamily: 'sans-serif'}}>
          <h1 style={{fontSize: 24, marginBottom: 16}}>Something went wrong.</h1>
          <pre style={{background: '#f1f5f9', padding: 20, borderRadius: 8, overflow: 'auto'}}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{marginTop: 20, padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer'}}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function renderError(error: any) {
    if (!container) return;
    container.innerHTML = `
    <div style="padding: 40px; text-align: center; color: #ef4444; font-family: sans-serif;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">App Initialization Failed</h1>
      <p style="margin-bottom: 16px; color: #64748b;">A critical error occurred while loading dependencies.</p>
      <pre style="background:#f1f5f9; padding:20px; text-align:left; display:inline-block; border-radius:8px; max-width: 800px; overflow:auto;">${error instanceof Error ? error.message : String(error)}</pre>
      <br/>
      <pre style="margin-top:10px; font-size:12px; color:#94a3b8;">${error?.stack || ''}</pre>
    </div>
  `;
}

try {
  const root = createRoot(container);
  
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
           <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
  
  console.log('React application mounted.');
} catch (error) {
  console.error("Mounting Error:", error);
  renderError(error);
}