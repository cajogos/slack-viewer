import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Theme } from '@/hooks/useTheme';

interface ThemeSwatch
{
    id: Theme;
    label: string;
    fill: string;
    rim: string;
}

const SWATCHES: ThemeSwatch[] = [
    { id: 'dark',     label: 'Dark',     fill: '#0b0f1a', rim: '#2d3748' },
    { id: 'light',    label: 'Light',    fill: '#ffffff', rim: '#cbd5e0' },
    { id: 'pastel',   label: 'Pastel',   fill: '#ede9f7', rim: '#b39ddb' },
    { id: 'terminal', label: 'Terminal', fill: '#000000', rim: '#00ff00' },
];

interface ThemeSwitcherProps
{
    theme: Theme;
    setTheme: (t: Theme) => void;
}

export function ThemeSwitcher({ theme, setTheme }: ThemeSwitcherProps)
{
    return (
        <div className="flex items-center gap-1.5">
            {SWATCHES.map(s => (
                <Tooltip key={s.id}>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setTheme(s.id)}
                            aria-label={s.label}
                            style={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: s.fill,
                                border: `2px solid ${s.rim}`,
                                outline: theme === s.id ? `2px solid ${s.rim}` : 'none',
                                outlineOffset: 2,
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'outline 0.1s',
                            }}
                        />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        <p>{s.label}</p>
                    </TooltipContent>
                </Tooltip>
            ))}
        </div>
    );
}
