import { PHeading, PText } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthDebugPage() {
    const { user, profile, isAdmin, loading } = useAuth();

    return (
        <div className="px-4 py-8 max-w-4xl mx-auto space-y-4">
            <PHeading size="2xl" tag="h1">Auth Debug Info</PHeading>

            {[
                {
                    title: 'Loading State',
                    content: (
                        <PText size="small">
                            Loading:{' '}
                            <span style={{ color: loading ? 'var(--p-color-warning)' : 'var(--p-color-success)' }}>
                                {loading ? 'TRUE (still loading...)' : 'FALSE (loaded)'}
                            </span>
                        </PText>
                    )
                },
                {
                    title: 'User State',
                    content: user ? (
                        <div className="space-y-1">
                            <PText size="small" style={{ color: 'var(--p-color-success)' }}>✅ User is logged in</PText>
                            <PText size="small">Email: <span style={{ color: 'var(--p-color-info)' }}>{user.email}</span></PText>
                            <PText size="x-small" color="contrast-low">ID: {user.id}</PText>
                        </div>
                    ) : (
                        <PText size="small" style={{ color: 'var(--p-color-error)' }}>❌ No user logged in</PText>
                    )
                },
                {
                    title: 'Profile State',
                    content: profile ? (
                        <div className="space-y-1">
                            <PText size="small" style={{ color: 'var(--p-color-success)' }}>✅ Profile loaded</PText>
                            <PText size="small">Username: <span style={{ color: 'var(--p-color-info)' }}>{profile.username}</span></PText>
                            <PText size="small">
                                Is Admin:{' '}
                                <span style={{ color: profile.is_admin ? 'var(--p-color-success)' : 'var(--p-color-error)' }}>
                                    {profile.is_admin ? 'YES ✅' : 'NO ❌'}
                                </span>
                            </PText>
                            <PText size="x-small" color="contrast-low">
                                Created: {new Date(profile.created_at).toLocaleString()}
                            </PText>
                        </div>
                    ) : (
                        <PText size="small" style={{ color: 'var(--p-color-warning)' }}>⚠️ No profile loaded</PText>
                    )
                },
                {
                    title: 'Admin Status',
                    content: (
                        <PText size="small">
                            isAdmin:{' '}
                            <span style={{ color: isAdmin ? 'var(--p-color-success)' : 'var(--p-color-error)' }}>
                                {isAdmin ? 'TRUE ✅' : 'FALSE ❌'}
                            </span>
                        </PText>
                    )
                },
                {
                    title: 'Raw Data (JSON)',
                    content: (
                        <pre className="text-xs overflow-auto" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            {JSON.stringify({
                                loading,
                                user: user ? { id: user.id, email: user.email } : null,
                                profile,
                                isAdmin
                            }, null, 2)}
                        </pre>
                    )
                }
            ].map(({ title, content }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4 space-y-2">
                    <PHeading size="md" tag="h2">{title}</PHeading>
                    {content}
                </div>
            ))}
        </div>
    );
}
