import { Link } from 'react-router-dom';
import { PHeading, PText } from '@porsche-design-system/components-react';
import { useAuth } from '../../contexts/AuthContext';

const cards = [
    { to: '/admin/shows', label: 'Shows', description: 'Manage concert shows, setlists, and performance details' },
    { to: '/admin/songs', label: 'Songs', description: 'Manage song catalog and track performance history' },
    { to: '/admin/albums', label: 'Albums', description: 'Manage album catalog and tracklists' },
    { to: '/admin/links', label: 'Links', description: 'Manage categorized links shown on the public Links page' },
    { to: '/admin/tours', label: 'Tours', description: 'Manage tours and assign a default Instagram post style' },
    { to: '/admin/venues', label: 'Venues', description: 'Manage venue information and locations' },
    // Full admins only — matches the same gating on the nav bar in AdminLayout.
    { to: '/admin/users', label: 'Users', description: 'View user signups, confirmation status, and resend activation emails', adminOnly: true },
    { to: '/admin/settings', label: 'Site Settings', description: 'Edit the header title/subtitle shown on every page', adminOnly: true },
];

export default function AdminDashboard() {
    const { isAdmin } = useAuth();
    const visibleCards = cards.filter(c => !c.adminOnly || isAdmin);

    return (
        <div className="space-y-8">
            <PHeading size="2xl" tag="h1">Admin Dashboard</PHeading>

            {/* Nav Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleCards.map(({ to, label, description }) => (
                    <Link
                        key={to}
                        to={to}
                        className="block rounded-2xl border border-white/10 bg-[#1a1e26] p-6 hover:border-white/25 hover:bg-white/5 transition-all space-y-2"
                    >
                        <PHeading size="md" tag="h2">{label}</PHeading>
                        <PText size="sm" color="contrast-medium">{description}</PText>
                        <PText size="xs" color="contrast-medium">Manage {label} →</PText>
                    </Link>
                ))}
            </div>
        </div>
    );
}
