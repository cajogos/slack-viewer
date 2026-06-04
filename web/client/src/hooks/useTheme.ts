import { useState } from 'react';

export type Theme = 'dark' | 'light' | 'pastel' | 'terminal';

const VALID: Set<string> = new Set(['dark', 'light', 'pastel', 'terminal']);

export function useTheme()
{
    const [theme, setThemeState] = useState<Theme>(() =>
    {
        const stored = localStorage.getItem('theme') ?? '';
        return VALID.has(stored) ? (stored as Theme) : 'dark';
    });

    function setTheme(t: Theme)
    {
        setThemeState(t);
        localStorage.setItem('theme', t);
    }

    return { theme, setTheme };
}
