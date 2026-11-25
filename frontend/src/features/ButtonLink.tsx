import React from 'react';
import type { ButtonVariant } from 'react-bootstrap/types';

interface Props {
    href: string,
    variant: ButtonVariant,
    className?: string,
    children: React.ReactNode
}

// A link drawn as a button. react-bootstrap's Button with an href renders a link with the button role
// (and a Space key handler), so screen readers would announce an action rather than a link to follow.
function ButtonLink({ href, variant, className, children }: Props) {
    return (
        <a href={href} className={['btn', `btn-${variant}`, className].filter(Boolean).join(' ')}>
            {children}
        </a>
    );
}

export default ButtonLink;
