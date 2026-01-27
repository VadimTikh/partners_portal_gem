'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';

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

/**
 * Filter tickets by name - client-side, instant search
 */
function filterTicketsByName(
  tickets: Array<{ id: number; name: string }>,
  query: string
): number[] {
  if (!query.trim()) {
    return tickets.map(t => t.id);
  }

  const searchTerms = query.toLowerCase().trim().split(/\s+/);

  return tickets
    .filter(ticket => {
      const nameLower = ticket.name.toLowerCase();
      // All search terms must be found in the ticket name
      return searchTerms.every(term => nameLower.includes(term));
    })
    .map(t => t.id);
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

  // Client-side filtering - instant, no API call needed
  const handleFilter = useCallback(() => {
    if (!query.trim() || disabled) return;

    const matchingIds = filterTicketsByName(tickets, query.trim());
    onFilter(matchingIds, `Search: "${query.trim()}"`);
  }, [query, tickets, onFilter, disabled]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFilter();
    }
  };

  const handleClear = () => {
    setQuery('');
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
            className="pl-10"
            disabled={disabled}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleFilter}
          disabled={!query.trim() || disabled}
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
    </div>
  );
}

// Legacy export for backward compatibility
export const AIFilterInput = TicketNameFilterInput;
