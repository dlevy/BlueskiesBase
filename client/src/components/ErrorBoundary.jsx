import { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
        this.setState({ error });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--p-color-canvas)' }}>
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1e26] p-8 space-y-4">
                        <p className="text-xl font-semibold" style={{ color: 'var(--p-color-error)' }}>Something went wrong</p>
                        <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            The application encountered an unexpected error.
                        </p>

                        {this.state.error && (
                            <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                                <p className="text-xs font-mono break-all" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80"
                                style={{ background: 'var(--p-color-primary)' }}
                            >
                                Return to Home
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors border border-white/10 hover:bg-white/5"
                                style={{ color: 'var(--p-color-contrast-medium)' }}
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
