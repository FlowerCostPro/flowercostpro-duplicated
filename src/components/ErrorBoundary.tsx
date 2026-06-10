import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Error Details:</h2>
              <div className="bg-red-100 border border-red-300 rounded p-4 mb-4">
                <pre className="text-sm text-red-800 whitespace-pre-wrap">
                  {this.state.error && this.state.error.toString()}
                </pre>
              </div>
            </div>

            {this.state.errorInfo && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">Component Stack:</h2>
                <div className="bg-gray-100 border border-gray-300 rounded p-4">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-64">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}