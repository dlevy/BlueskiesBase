import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PHeading, PText, PButton, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";

export default function ResetPasswordPage() {
    const { user, loading, updatePassword } = useAuth();
    // Admin-generated links carry a one-time token_hash in the query string
    // (server/routes/admin.js). It's redeemed only on submit, so a link
    // preview or email scanner opening the page can't use it up first.
    // Read once on mount: the token stays valid until submitted.
    const [tokenHash] = useState(() => new URLSearchParams(window.location.search).get('token_hash'));
    // Set once the token has been redeemed, so a retry after a failed
    // password update doesn't try to spend the same one-time token again.
    const [tokenRedeemed, setTokenRedeemed] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

        setSaving(true);
        try {
            if (tokenHash && !tokenRedeemed) {
                const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
                if (otpError) {
                    setError('This password reset link has expired or was already used. Contact an admin to have a new one sent.');
                    return;
                }
                setTokenRedeemed(true);
            }
            await updatePassword(password);
            setSuccess(true);
        } catch (err) {
            setError(err.message || 'Failed to update password. The reset link may have expired — request a new one.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{ background: 'var(--p-color-canvas)' }}>
            <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-[#1a1e26] p-8">
                <div className="text-center space-y-1">
                    <PHeading size="xl" tag="h1" align="center">Set a New Password</PHeading>
                    <PText size="sm" color="contrast-medium" align="center">SkySets.org</PText>
                </div>

                {loading && !tokenHash ? (
                    <div className="flex justify-center py-4"><PSpinner size="medium" /></div>
                ) : success ? (
                    <div className="space-y-4">
                        <PInlineNotification
                            heading="Password updated!"
                            description="You're all set."
                            state="success"
                            dismissButton={false}
                        />
                        <Link to="/">
                            <PButton className="w-full">Continue to SkySets.org</PButton>
                        </Link>
                    </div>
                ) : !user && !tokenHash ? (
                    <div className="space-y-4">
                        <PInlineNotification
                            heading="Link expired or invalid"
                            description="This password reset link is no longer valid. Contact an admin to have a new one sent."
                            state="error"
                            dismissButton={false}
                        />
                        <Link to="/member-login">
                            <PButton variant="secondary" className="w-full">Back to Login</PButton>
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
                        )}

                        <div className="space-y-3">
                            <div>
                                <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    New Password
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

                        <PButton type="submit" loading={saving} className="w-full">
                            Update Password
                        </PButton>
                    </form>
                )}
            </div>
        </div>
    );
}
