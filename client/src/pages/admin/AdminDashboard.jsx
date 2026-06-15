import { Link } from 'react-router-dom';
import { PHeading, PText, PButton } from '@porsche-design-system/components-react';

const cards = [
    { to: '/admin/shows', label: 'Shows', description: 'Manage concert shows, setlists, and performance details' },
    { to: '/admin/songs', label: 'Songs', description: 'Manage song catalog and track performance history' },
    { to: '/admin/albums', label: 'Albums', description: 'Manage album catalog and tracklists' },
    { to: '/admin/venues', label: 'Venues', description: 'Manage venue information and locations' },
];

export default function AdminDashboard() {
    return (
        <div className="space-y-8">
            <PHeading size="2xl" tag="h1">Admin Dashboard</PHeading>

            {/* Nav Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map(({ to, label, description }) => (
                    <Link
                        key={to}
                        to={to}
                        className="block rounded-2xl border border-white/10 bg-[#1a1e26] p-6 hover:border-white/25 hover:bg-white/5 transition-all space-y-2"
                    >
                        <PHeading size="md" tag="h2">{label}</PHeading>
                        <PText size="sm" color="contrast-medium">{description}</PText>
                        <PText size="xs" color="contrast-low">Manage {label} →</PText>
                    </Link>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
                <PHeading size="lg" tag="h2">Quick Actions</PHeading>
                <div className="flex flex-wrap gap-3">
                    <Link to="/admin/shows/new"><PButton>+ Add New Show</PButton></Link>
                    <Link to="/admin/songs"><PButton variant="secondary">+ Add New Song</PButton></Link>
                    <Link to="/admin/albums"><PButton variant="secondary">+ Add New Album</PButton></Link>
                    <Link to="/admin/venues"><PButton variant="secondary">+ Add New Venue</PButton></Link>
                </div>
            </div>
        </div>
    );
}
