'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';

interface TicketNameFilterInputProps {
  /** Called when filter returns results */
  onFilter: (matchingIds: number[], interpretation: string) => void;
  /** Called when user clears the filter */
  onClear: () => void;
  /** Whether filter is currently active */
  isActive: boolean;
  /** Interpretation text from the last filter */
  interpretation?: string;
  /** Tickets to search within (with id and name) */
  tickets: Array<{ id: number; name: string }>;
  /** Match count to display */
  matchCount?: number;
  /** Whether component is disabled */
  disabled?: boolean;
}

export function TicketNameFilterInput({
  onFilter,
  onClear,
  isActive,
  interpretation,
  tickets,
  matchCount,
  disabled = false,
}: TicketNameFilterInputProps) {
  const { t } = useI18n();
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilter = useCallback(async () => {
    if (!query.trim() || isLoading || disabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.filterByQuery({
        tickets,
        query: query.trim(),
      });

      onFilter(result.matchingIds, result.interpretation);
    } catch (err) {
      console.error('[Filter] Error:', err);
      setError(err instanceof Error ? err.message : 'Filter failed');
    } finally {
      setIsLoading(false);
    }
  }, [query, tickets, onFilter, isLoading, disabled]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFilter();
    }
  };

  const handleClear = () => {
    setQuery('');
    setError(null);
    onClear();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={(helpdesk?.searchPlaceholder as string) || "Search by ticket name..."}
            className="pl-10 pr-10"
            disabled={disabled || isLoading}
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleFilter}
          disabled={!query.trim() || isLoading || disabled}
        >
          <Search className="h-4 w-4" />
        </Button>
        {isActive && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Active filter indicator */}
      {isActive && interpretation && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <Search className="h-3 w-3 mr-1" />
            {interpretation}
          </Badge>
          {matchCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              ({matchCount} {(helpdesk?.matches as string) || 'matches'})
            </span>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

// Legacy export for backward compatibility
export const AIFilterInput = TicketNameFilterInput;
