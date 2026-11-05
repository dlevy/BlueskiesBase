import { Link } from 'react-router-dom';

// Italic uses _underscores_ rather than single *asterisks*, same as
// standard Markdown — a lone "*" shows up constantly in ordinary prose
// (footnotes, censoring, "2*3=6"), and since matching is pairwise, any two
// stray asterisks anywhere in a post would italicize everything between
// them. Underscore pairs are far less common outside of actual emphasis.
//
// The link form only ever matches a path starting with /show/ (no scheme,
// no //, no spaces/parens inside it) — the compose toolbar is the only
// thing that writes this syntax, but since it's just text in the body,
// nothing stops a member from typing it by hand, so the pattern itself has
// to be the thing that keeps this safe: it can never become a javascript:
// URI or an external redirect, only ever our own show route.
const TOKEN_RE = /\[([^\]\n]+)\]\((\/show\/[^()\s]+)\)|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|_([^_\n]+)_|@([a-zA-Z0-9_]+)/g;

/**
 * Renders a forum post body's lightweight markup — the subset the compose
 * toolbar writes into the plain-text body (**bold**, _italic_, ~~strike~~,
 * and [label](/show/...) links) — plus @mention linkification. Anything
 * that isn't a recognized pattern (including an @word that isn't a real
 * member's username) passes through as literal text unchanged.
 */
export function renderForumMarkup(text, usernameSet) {
    const nodes = [];
    let lastIndex = 0;
    let key = 0;

    for (const m of text.matchAll(TOKEN_RE)) {
        if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index));
        const [, linkLabel, linkPath, boldText, strikeText, italicText, mentionName] = m;

        if (linkLabel !== undefined) {
            nodes.push(
                <Link key={key++} to={linkPath} className="hover:underline" style={{ color: 'var(--p-color-info)' }}>
                    {linkLabel}
                </Link>
            );
        } else if (boldText !== undefined) {
            nodes.push(<strong key={key++}>{boldText}</strong>);
        } else if (strikeText !== undefined) {
            nodes.push(<s key={key++}>{strikeText}</s>);
        } else if (italicText !== undefined) {
            nodes.push(<em key={key++}>{italicText}</em>);
        } else if (mentionName !== undefined) {
            if (usernameSet?.has(mentionName.toLowerCase())) {
                nodes.push(
                    <Link key={key++} to={`/profile/${mentionName.toLowerCase()}`} className="hover:underline" style={{ color: 'var(--p-color-primary)' }}>
                        @{mentionName}
                    </Link>
                );
            } else {
                nodes.push(`@${mentionName}`);
            }
        }

        lastIndex = m.index + m[0].length;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
    return nodes;
}

/**
 * Renders a forum post body at the block level — paragraphs, plus "- " bullet
 * lists (the shape "Insert Setlist" writes: a set-name line, then one "- "
 * line per song). Lines are grouped into runs of consecutive list lines vs.
 * everything else; each run becomes one <ul> or one paragraph, with the
 * inline tokenizer (bold/italic/strike/links/mentions) applied within it.
 * Blank lines are pure block separators (dropped, not rendered as content)
 * — spacing between blocks comes from layout, not literal newlines.
 */
export function renderForumBody(text, usernameSet) {
    const lines = text.split('\n');
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
        if (lines[i].trim() === '') { i++; continue; } // blank lines are pure separators, never block content
        if (lines[i].startsWith('- ')) {
            const items = [];
            while (i < lines.length && lines[i].startsWith('- ')) {
                items.push(lines[i].slice(2));
                i++;
            }
            blocks.push({ type: 'list', items });
        } else {
            const paraLines = [];
            while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('- ')) {
                paraLines.push(lines[i]);
                i++;
            }
            blocks.push({ type: 'para', text: paraLines.join('\n') });
        }
    }

    return blocks.map((b, i) => b.type === 'list' ? (
            <ul key={i} className="list-disc list-outside pl-5 space-y-0.5 text-sm">
                {b.items.map((item, j) => <li key={j}>{renderForumMarkup(item, usernameSet)}</li>)}
            </ul>
        ) : (
            <p key={i} className="text-sm whitespace-pre-wrap">{renderForumMarkup(b.text, usernameSet)}</p>
        ));
}

/** Strips the toolbar's markup back down to plain text, for short previews/snippets. */
export function stripForumMarkup(text) {
    return text
        .replace(/\[([^\]\n]+)\]\(\/show\/[^()\s]+\)/g, '$1')
        .replace(/\*\*([^*\n]+)\*\*/g, '$1')
        .replace(/~~([^~\n]+)~~/g, '$1')
        .replace(/_([^_\n]+)_/g, '$1')
        .replace(/^- /gm, '')
        .replace(/\n+/g, ' ')
        .trim();
}
