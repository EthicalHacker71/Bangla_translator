import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ color: '#ef4444', fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 'bold' }}>⚠️ Component Crashed!</h1>
          <p style={{ marginBottom: '1rem', color: '#4b5563' }}>The React application threw an error while rendering.</p>
          <pre style={{ background: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '0.5rem', overflowX: 'auto', border: '1px solid #f87171' }}>
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)