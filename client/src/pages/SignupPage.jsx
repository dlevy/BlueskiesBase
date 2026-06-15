import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PHeading, PText, PButton, PInlineNotification } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

        setLoading(true);
        try {
            await signUp(email, password);
            setSuccess(true);
            setTimeout(() => navigate('/'), 2000);
        } catch (err) {
            setError(err.message || 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{ background: 'var(--p-color-canvas)' }}>
            <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-[#1a1e26] p-8">
                <div className="text-center space-y-1">
                    <PHeading size="xl" tag="h1" align="center">Create Your Account</PHeading>
                    <PText size="sm" color="contrast-medium" align="center">Join SkySets.org to track your shows</PText>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
                    )}
                    {success && (
                        <PInlineNotification
                            heading="Account created!"
                            description="Check your email to confirm your account. Redirecting…"
                            state="success"
                            dismissButton={false}
                        />
                    )}

                    <div className="space-y-3">
                        <div>
                            <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Email address
                            </label>
                            <input id="email" name="email" type="email" autoComplete="email" required
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com" className={inputClass} />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Password
                            </label>
                            <input id="password" name="password" type="password" autoComplete="new-password" required
                                value={password} onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters" className={inputClass} />
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Confirm Password
                            </label>
                            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required
                                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password" className={inputClass} />
                        </div>
                    </div>

                    <PButton type="submit" loading={loading} disabled={success} className="w-full">
                        Sign up
                    </PButton>
                </form>

                <div className="text-center">
                    <PText size="xs" color="contrast-medium">
                        Already have an account?{' '}
                        <Link to="/member-login" className="text-[var(--p-color-info)] hover:opacity-80 transition-opacity">
                            Sign in
                        </Link>
                    </PText>
                </div>
            </div>
        </div>
    );
}
