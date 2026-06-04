import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LoadMoreButtonProps
{
    hasMore: boolean;
    isLoading: boolean;
    onLoadMore: () => void;
}

export function LoadMoreButton({ hasMore, isLoading, onLoadMore }: LoadMoreButtonProps)
{
    if (!hasMore && !isLoading)
    {
        return null;
    }

    return (
        <div className="flex justify-center py-3">
            <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoading || !hasMore}
            >
                {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                {isLoading ? 'Loading…' : 'Load earlier messages'}
            </Button>
        </div>
    );
}
