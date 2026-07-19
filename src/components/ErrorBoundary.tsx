import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
              Service Temporarily Unavailable
            </h1>
            
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              We encountered an unexpected rendering error. Our systems have logged the issue and we are actively working on a resolution.
            </p>
            
            <button
              onClick={this.handleReload}
              className="w-full bg-gray-900 text-white font-bold py-3 px-6 rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 group"
            >
              <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
              Reload Application
            </button>
            
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-8 text-left bg-red-50 p-4 rounded-lg overflow-auto text-xs text-red-800 border border-red-100">
                <p className="font-mono font-bold mb-1">{this.state.error.toString()}</p>
                <p className="font-mono whitespace-pre-wrap">{this.state.error.stack}</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
