import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { downloadExport } from '@/api/client';
import type { Channel } from '@/types';

interface ExportMenuProps
{
    workspace: string;
    channel: Channel;
    threadTs?: string;
}

export function ExportMenu({ workspace, channel, threadTs }: ExportMenuProps)
{
    const [isExporting, setIsExporting] = useState(false);

    async function handleExport(format: string)
    {
        if (isExporting)
        {
            return;
        }
        setIsExporting(true);
        try
        {
            const { blob, filename } = await downloadExport(
                workspace,
                channel.id,
                channel.name,
                format,
                threadTs ? { threadTs } : undefined,
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch (err)
        {
            console.error('Export failed:', err);
        }
        finally
        {
            setIsExporting(false);
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isExporting}>
                    {isExporting
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />
                    }
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export {threadTs ? 'thread' : 'channel'} as</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport('json')}>JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('markdown')}>Markdown</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('html')}>HTML</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
