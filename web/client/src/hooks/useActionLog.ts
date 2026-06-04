import { useState, useCallback } from 'react';

export interface ActionEntry
{
    type: 'channel' | 'thread' | 'export';
    label: string;
    ts: number;
}

const MAX_LOG = 20;
const STORAGE_KEY = 'action-log';

function loadLog(): ActionEntry[]
{
    try
    {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as ActionEntry[]) : [];
    }
    catch
    {
        return [];
    }
}

function saveLog(entries: ActionEntry[]): void
{
    try
    {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
    catch { /* quota exceeded — ignore */ }
}

export function useActionLog()
{
    const [log, setLog] = useState<ActionEntry[]>(loadLog);

    const addAction = useCallback((type: ActionEntry['type'], label: string) =>
    {
        setLog(prev =>
        {
            const entry: ActionEntry = { type, label, ts: Date.now() };
            const next = [...prev, entry].slice(-MAX_LOG);
            saveLog(next);
            return next;
        });
    }, []);

    return { log, addAction };
}
