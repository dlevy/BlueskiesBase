import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PHeading, PText, PButton, PInlineNotification } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || '/admin';

    // Auto-redirect when SIGNED_IN fires cross-tab (e.g. another tab refreshed the token
    // and this tab got redirected here while user was already authenticated elsewhere).
    useEffect(() => {
        if (user) navigate(from, { replace: true });
    }, [user, navigate, from]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signIn(email, password);
            navigate(from, { replace: true });
        } catch (err) {
            setError(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{ background: 'var(--p-color-canvas)' }}>
            <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-[#1a1e26] p-8">
                <div className="text-center space-y-1">
                    <PHeading size="xl" tag="h1" align="center">Admin Login</PHeading>
                    <PText size="sm" color="contrast-medium" align="center">Sign in to access the admin panel</PText>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <PInlineNotification heading="Sign in failed" description={error} state="error" dismissButton={false} />
                    )}

                    <div className="space-y-3">
                        <div>
                            <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Email address
                            </label>
                            <input id="email" name="email" type="email" autoComplete="email" required
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@example.com" className={inputClass} />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Password
                            </label>
                            <input id="password" name="password" type="password" autoComplete="current-password" required
                                value={password} onChange={(e) => setPassword(e.target.value)}
                                placeholder="Your password" className={inputClass} />
                        </div>
                    </div>

                    <PButton type="submit" loading={loading} className="w-full">
                        Sign in
                    </PButton>
                </form>
            </div>
        </div>
    );
}
