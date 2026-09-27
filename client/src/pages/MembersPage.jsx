import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText, PButtonPure, PHeading } from '@porsche-design-system/components-react';
import { getMemberDirectory } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import Avatar from '../components/Avatar';

// Same badge look as ProfilePage.jsx's role badges, kept minimal here since a
// directory card only needs a compact indicator, not the full badge treatment.
const ROLE_LABEL = { admin: 'Admin', editor: 'Curator' };
const ROLE_RANK = { admin: 0, editor: 1 };

const nameOf = (m) => (m.displayName || m.username || '').toLowerCase();

function MemberCard({ member }) {
    const name = member.displayName || member.username;
    const roleLabel = ROLE_LABEL[member.role];

    return (
        <Link
            to={`/profile/${member.username}`}
            className="flex flex-col items-center text-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-amber-500/30 hover:-translate-y-0.5 transition-all"
        >
            <Avatar url={member.avatarUrl} name={name} size="lg" />
            <div className="min-w-0 w-full">
                <PText weight="semi-bold" ellipsis>{name}</PText>
                {member.location && (
                    <PText size="xs" color="contrast-medium" ellipsis>{member.location}</PText>
                )}
                {roleLabel && (
                    <span
                        className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(245,158,11,0.14)', color: '#fbbf24' }}
                    >
                        {roleLabel}
                    </span>
                )}
            </div>
        </Link>
    );
}

export default function MembersPage() {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!user) { setLoading(false); return; }

        let cancelled = false;
        setLoading(true);

        getMemberDirectory()
            .then(data => {
                if (cancelled) return;
                setMembers(data.members || []);
            })
            .catch(err => {
                console.error('[MembersPage] Error loading directory:', err);
                if (!cancelled) setError('Failed to load members');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [user]);

    const team = members
        .filter(m => m.role === 'admin' || m.role === 'editor')
        .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || nameOf(a).localeCompare(nameOf(b)));
    const regularMembers = members.filter(m => m.role !== 'admin' && m.role !== 'editor');

    const q = query.trim().toLowerCase();
    const filteredMembers = q
        ? regularMembers.filter(m => [m.username, m.displayName, m.location].some(f => f?.toLowerCase().includes(q)))
        : regularMembers;

    return (
        <div className="px-4 py-4 md:py-6 max-w-6xl mx-auto">
            <SEO
                title="Members"
                description="Browse members of the Sturgill Simpson and Johnny Blue Skies setlist archive community."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Members
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    {members.length > 0 ? `${members.length} member${members.length !== 1 ? 's' : ''}` : 'Browse the community'}
                </p>
            </div>

            {!user ? (
                <div className="py-16 text-center space-y-3">
                    <PText color="contrast-medium">
                        Log in to browse the member directory.
                    </PText>
                    <div>
                        <Link to="/member-login">
                            <PButtonPure>Log In</PButtonPure>
                        </Link>
                    </div>
                </div>
            ) : (
                <>
                    {loading && (
                        <div className="flex justify-center py-16">
                            <PSpinner size="medium" aria={{ 'aria-label': 'Loading members' }} />
                        </div>
                    )}

                    {!loading && error && (
                        <PText color="notification-error" align="center" className="py-16">{error}</PText>
                    )}

                    {!loading && !error && members.length === 0 && (
                        <PText color="contrast-medium" align="center" className="py-16">
                            No members yet.
                        </PText>
                    )}

                    {!loading && !error && team.length > 0 && (
                        <div className="mb-8">
                            <PHeading size="lg" tag="h2" className="mb-4">SkySets.org Team</PHeading>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {team.map(member => <MemberCard key={member.id} member={member} />)}
                            </div>
                        </div>
                    )}

                    {!loading && !error && members.length > 0 && (
                        <div>
                            <PHeading size="lg" tag="h2" className="mb-4">Members</PHeading>

                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by name or location…"
                                className="w-full max-w-md mb-6 rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500"
                            />

                            {filteredMembers.length === 0 ? (
                                <PText color="contrast-medium" align="center" className="py-16 block">
                                    {q ? `No members match "${query}".` : 'No members yet.'}
                                </PText>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {filteredMembers.map(member => <MemberCard key={member.id} member={member} />)}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
