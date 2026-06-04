import type { ActionEntry } from '@/hooks/useActionLog';

interface ActionLogBarProps
{
    log: ActionEntry[];
}

const TYPE_ICON: Record<ActionEntry['type'], string> = {
    channel: '💬',
    thread: '↳',
    export: '⬇',
};

export function ActionLogBar({ log }: ActionLogBarProps)
{
    if (log.length === 0) return null;

    return (
        <div className="flex items-center gap-2 px-3 py-1 border-t border-border bg-card/50 overflow-x-auto flex-shrink-0 scrollbar-hide">
            <span className="text-xs text-muted-foreground flex-shrink-0">Activity:</span>
            <div className="flex items-center gap-1.5 flex-row-reverse">
                {[...log].reverse().map((entry, i) => (
                    <span
                        key={`${entry.ts}-${i}`}
                        className="flex-shrink-0 flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                        title={new Date(entry.ts).toLocaleTimeString()}
                    >
                        <span>{TYPE_ICON[entry.type]}</span>
                        <span>{entry.label}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}
