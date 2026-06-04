import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light' | 'pastel' | 'terminal';

const VALID: Set<string> = new Set(['dark', 'light', 'pastel', 'terminal']);

export function useTheme()
{
    const [theme, setThemeState] = useState<Theme>(() =>
    {
        const stored = localStorage.getItem('theme') ?? '';
        return VALID.has(stored) ? (stored as Theme) : 'dark';
    });

    // Apply to <html> so every element (including Radix portals) inherits the variables
    useEffect(() =>
    {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    function setTheme(t: Theme)
    {
        setThemeState(t);
        localStorage.setItem('theme', t);
        document.documentElement.setAttribute('data-theme', t);
    }

    return { theme, setTheme };
}
