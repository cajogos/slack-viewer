import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WorkspaceSwitcherProps
{
    workspaces: string[];
    current: string | null;
    onChange: (name: string) => void;
}

export function WorkspaceSwitcher({ workspaces, current, onChange }: WorkspaceSwitcherProps)
{
    if (workspaces.length <= 1)
    {
        return (
            <div className="px-3 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground truncate">
                    {current ?? workspaces[0] ?? 'No workspace'}
                </p>
            </div>
        );
    }

    return (
        <div className="px-3 py-3 border-b border-border">
            <Select value={current ?? ''} onValueChange={onChange}>
                <SelectTrigger className="h-8 text-sm font-semibold">
                    <SelectValue placeholder="Select workspace…" />
                </SelectTrigger>
                <SelectContent>
                    {workspaces.map(ws => (
                        <SelectItem key={ws} value={ws}>{ws}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
