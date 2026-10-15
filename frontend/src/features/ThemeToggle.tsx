import React from 'react';
import { Form } from 'react-bootstrap';
import { useTheme } from '../theme/themeContext';

const iconSize = 16;

interface IconProps {
    onClick: () => void
}

// The icons are mouse shortcuts that pick their own theme; the switch is the accessible control
function SunIcon({ onClick }: IconProps) {
    return (
        <svg className="theme-icon theme-icon-light" aria-hidden="true" onClick={onClick} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
    );
}

function MoonIcon({ onClick }: IconProps) {
    return (
        <svg className="theme-icon theme-icon-dark" aria-hidden="true" onClick={onClick} width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
    );
}

interface Props {
    className?: string
}

// A switch between the light and dark themes, on when dark
function ThemeToggle({ className = '' }: Props) {
    const { theme, setTheme } = useTheme();

    return (
        <div className={`theme-toggle d-flex align-items-center ${className}`}>
            <SunIcon onClick={() => setTheme('light')}/>
            <Form.Check
                type="switch"
                id="theme-toggle"
                role="switch"
                className="mx-2"
                checked={theme === 'dark'}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setTheme(event.target.checked ? 'dark' : 'light')}
                label={<span className="sr-only">Dark mode</span>}
            />
            <MoonIcon onClick={() => setTheme('dark')}/>
        </div>
    );
}

export default ThemeToggle;
