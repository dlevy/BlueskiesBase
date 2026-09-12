import { useState, useEffect } from 'react';
import { PText } from '@porsche-design-system/components-react';
import { getShowAttendees } from '../services/api';

// Usernames only — never emails. Falls back to a bare "+N more" count for any
// attendee rows whose profile has no username set, rather than skipping them silently.
export default function WhoWasThereSection({ showId, refreshOn, isFutureShow }) {
    const [attendees, setAttendees] = useState([]);
    const [count, setCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        getShowAttendees(showId)
            .then(data => {
                if (cancelled) return;
                setAttendees(data.attendees || []);
                setCount(data.count || 0);
            })
            .catch(err => console.error('Error loading attendees:', err));
        return () => { cancelled = true; };
    }, [showId, refreshOn]);

    if (count === 0) return null;

    return (
        <div className="mt-5 pt-4 border-t border-white/[0.07]">
            <PText size="xs" className="uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--p-color-contrast-low)' }}>
                {isFutureShow ? 'Who Is Attending?' : 'Who Was There'}
            </PText>
            <div className="flex flex-wrap items-center gap-1.5">
                {attendees.map(a => (
                    <span
                        key={a.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-white/10 bg-white/5"
                        style={{ color: 'var(--p-color-contrast-medium)' }}
                    >
                        {a.username}
                    </span>
                ))}
                {count > attendees.length && (
                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        +{count - attendees.length} more
                    </span>
                )}
            </div>
        </div>
    );
}
