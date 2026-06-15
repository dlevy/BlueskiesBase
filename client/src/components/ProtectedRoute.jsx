import { Navigate, useLocation } from 'react-router-dom';
import { PSpinner, PText, PButtonPure } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
    const { user, isAdmin, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--p-color-canvas)' }}>
                <PSpinner size="large" aria={{ 'aria-label': 'Loading' }} />
                <PText color="contrast-medium">Loading…</PText>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--p-color-canvas)' }}>
                <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1e26] p-8 text-center space-y-4">
                    <p className="text-xl font-semibold" style={{ color: 'var(--p-color-error)' }}>Access Denied</p>
                    <PText color="contrast-medium">You do not have permission to access the admin panel.</PText>
                    <a href="/">
                        <PButtonPure icon="arrow-left">Return to Home</PButtonPure>
                    </a>
                </div>
            </div>
        );
    }

    return children;
}
