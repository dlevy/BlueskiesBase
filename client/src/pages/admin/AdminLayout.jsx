import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { PHeading, PText, PButton, PButtonPure } from '@porsche-design-system/components-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLayout() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        if (isSigningOut) return;
        setIsSigningOut(true);
        try {
            await signOut();
            navigate('/');
        } catch (error) {
            console.error('[AdminLayout] Error signing out:', error);
            alert('Failed to sign out. Please try again.');
        } finally {
            setIsSigningOut(false);
        }
    };

    const navLinkClass = "text-sm font-medium transition-opacity hover:opacity-70";

    return (
        <div className="min-h-screen" style={{ background: 'var(--p-color-canvas)' }}>
            <div className="container mx-auto px-4">
                {/* Admin Header */}
                <header className="py-4 shadow-xl border-b border-white/10 rounded-t-2xl mt-4"
                    style={{ background: 'var(--p-color-surface)' }}>
                    <div className="px-4 flex justify-between items-center">
                        <div>
                            <Link to="/admin" className="hover:opacity-80 transition-opacity">
                                <PHeading size="lg" tag="h1">SkySets.org admin</PHeading>
                            </Link>
                            <PText size="xs" color="contrast-low">Logged in as: {user?.email}</PText>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link to="/">
                                <PButtonPure icon="arrow-left">View Site</PButtonPure>
                            </Link>
                            <PButton variant="secondary" size="small" loading={isSigningOut} onClick={handleSignOut}>
                                Sign Out
                            </PButton>
                        </div>
                    </div>
                </header>

                {/* Admin Navigation */}
                <nav className="border-b border-white/10 px-4" style={{ background: 'var(--p-color-surface)' }}>
                    <ul className="flex gap-6 py-3">
                        {[
                            { to: '/admin', label: 'Dashboard' },
                            { to: '/admin/shows', label: 'Shows' },
                            { to: '/admin/songs', label: 'Songs' },
                            { to: '/admin/albums', label: 'Albums' },
                            { to: '/admin/venues', label: 'Venues' },
                        ].map(({ to, label }) => (
                            <li key={to}>
                                <Link to={to} className={navLinkClass} style={{ color: 'var(--p-color-primary)' }}>
                                    {label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Main Content */}
                <main className="px-4 py-8 rounded-b-2xl mb-4" style={{ background: 'var(--p-color-canvas)' }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
