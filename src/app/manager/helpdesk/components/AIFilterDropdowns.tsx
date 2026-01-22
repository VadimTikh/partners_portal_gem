'use client';

import { useState } from 'react';
import { ChevronDown, Sparkles, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  AIUrgency,
  AICategory,
  AISentiment,
  SatisfactionLevel,
  AITicketFilters,
} from '@/lib/types/helpdesk';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface AIFilterDropdownsProps {
  filters: Partial<AITicketFilters>;
  onFiltersChange: (filters: Partial<AITicketFilters>) => void;
  disabled?: boolean;
  disabledReason?: string;
}

const URGENCY_OPTIONS: { value: AIUrgency; labelKey: string; color: string }[] = [
  { value: 'critical', labelKey: 'urgencyCritical', color: 'bg-red-500' },
  { value: 'high', labelKey: 'urgencyHigh', color: 'bg-orange-500' },
  { value: 'medium', labelKey: 'urgencyMedium', color: 'bg-yellow-500' },
  { value: 'low', labelKey: 'urgencyLow', color: 'bg-green-500' },
];

const CATEGORY_OPTIONS: { value: AICategory; labelKey: string }[] = [
  { value: 'missing_dates', labelKey: 'categoryMissingDates' },
  { value: 'refund_request', labelKey: 'categoryRefundRequest' },
  { value: 'voucher_not_received', labelKey: 'categoryVoucherNotReceived' },
  { value: 'voucher_expired', labelKey: 'categoryVoucherExpired' },
  { value: 'booking_change', labelKey: 'categoryBookingChange' },
  { value: 'complaint', labelKey: 'categoryComplaint' },
  { value: 'general_inquiry', labelKey: 'categoryGeneralInquiry' },
  { value: 'partner_issue', labelKey: 'categoryPartnerIssue' },
  { value: 'payment_issue', labelKey: 'categoryPaymentIssue' },
  { value: 'technical_issue', labelKey: 'categoryTechnicalIssue' },
  { value: 'other', labelKey: 'categoryOther' },
];

const SENTIMENT_OPTIONS: { value: AISentiment; labelKey: string; color: string }[] = [
  { value: 'angry', labelKey: 'sentimentAngry', color: 'bg-red-500' },
  { value: 'frustrated', labelKey: 'sentimentFrustrated', color: 'bg-orange-500' },
  { value: 'neutral', labelKey: 'sentimentNeutral', color: 'bg-gray-500' },
  { value: 'positive', labelKey: 'sentimentPositive', color: 'bg-green-500' },
];

const SATISFACTION_OPTIONS: { value: SatisfactionLevel; labelKey: string }[] = [
  { value: 1, labelKey: 'satisfaction1' },
  { value: 2, labelKey: 'satisfaction2' },
  { value: 3, labelKey: 'satisfaction3' },
  { value: 4, labelKey: 'satisfaction4' },
  { value: 5, labelKey: 'satisfaction5' },
];

export function AIFilterDropdowns({
  filters,
  onFiltersChange,
  disabled = false,
  disabledReason,
}: AIFilterDropdownsProps) {
  const { t } = useI18n();
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;
  const [isOpen, setIsOpen] = useState(false);

  // Count active AI filters
  const activeFilterCount =
    (filters.aiUrgency?.length || 0) +
    (filters.aiCategory?.length || 0) +
    (filters.aiSentiment?.length || 0) +
    (filters.aiSatisfaction?.length || 0) +
    (filters.aiIsResolved !== undefined ? 1 : 0) +
    (filters.awaitingAnswer ? 1 : 0);

  const handleToggleArrayFilter = <T extends string | number>(
    field: keyof AITicketFilters,
    value: T
  ) => {
    const currentValues = (filters[field] as T[] | undefined) || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    onFiltersChange({
      ...filters,
      [field]: newValues.length > 0 ? newValues : undefined,
    });
  };

  const handleClearFilters = () => {
    // Clear AI-specific filters
    onFiltersChange({
      aiUrgency: undefined,
      aiCategory: undefined,
      aiSentiment: undefined,
      aiSatisfaction: undefined,
      aiIsResolved: undefined,
      awaitingAnswer: undefined,
    });
  };

  return (
    <Collapsible open={isOpen && !disabled} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`w-full justify-between ${disabled ? 'opacity-60' : ''}`}
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          <div className="flex items-center gap-2">
            <Sparkles className={`h-4 w-4 ${disabled ? 'text-gray-400' : 'text-purple-500'}`} />
            <span>{(helpdesk?.aiFilters as string) || 'AI Filters'}</span>
            {activeFilterCount > 0 && !disabled && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
            {disabled && disabledReason && (
              <span className="text-xs text-muted-foreground ml-1">
                ({disabledReason})
              </span>
            )}
          </div>
          {!disabled && (
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4 rounded-lg border bg-card p-4">
        {/* Clear filters button */}
        {activeFilterCount > 0 && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              {(helpdesk?.clearFilters as string) || 'Clear Filters'}
            </Button>
          </div>
        )}

        {/* Urgency Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {(helpdesk?.filterByUrgency as string) || 'Urgency'}
          </Label>
          <div className="flex flex-wrap gap-2">
            {URGENCY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={filters.aiUrgency?.includes(option.value) || false}
                  onCheckedChange={() =>
                    handleToggleArrayFilter('aiUrgency', option.value)
                  }
                />
                <span className="flex items-center gap-1 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${option.color}`}
                  />
                  {(helpdesk?.[option.labelKey] as string) || option.value}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {(helpdesk?.filterByCategory as string) || 'Category'}
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={filters.aiCategory?.includes(option.value) || false}
                  onCheckedChange={() =>
                    handleToggleArrayFilter('aiCategory', option.value)
                  }
                />
                <span className="text-sm">{(helpdesk?.[option.labelKey] as string) || option.value}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sentiment Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {(helpdesk?.filterBySentiment as string) || 'Sentiment'}
          </Label>
          <div className="flex flex-wrap gap-2">
            {SENTIMENT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={filters.aiSentiment?.includes(option.value) || false}
                  onCheckedChange={() =>
                    handleToggleArrayFilter('aiSentiment', option.value)
                  }
                />
                <span className="flex items-center gap-1 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full ${option.color}`}
                  />
                  {(helpdesk?.[option.labelKey] as string) || option.value}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Satisfaction Level Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {(helpdesk?.filterBySatisfaction as string) || 'Satisfaction Level'}
          </Label>
          <div className="flex flex-wrap gap-2">
            {SATISFACTION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={filters.aiSatisfaction?.includes(option.value) || false}
                  onCheckedChange={() =>
                    handleToggleArrayFilter('aiSatisfaction', option.value)
                  }
                />
                <span className="text-sm">{(helpdesk?.[option.labelKey] as string) || option.value}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Boolean Filters */}
        <div className="space-y-3 pt-2 border-t">
          {/* AI Resolved Filter */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium min-w-[120px]">
              {(helpdesk?.aiResolved as string) || 'AI Resolved Status'}
            </Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="aiResolved"
                  checked={filters.aiIsResolved === undefined}
                  onChange={() =>
                    onFiltersChange({ ...filters, aiIsResolved: undefined })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">
                  {(helpdesk?.all as string) || 'All'}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="aiResolved"
                  checked={filters.aiIsResolved === true}
                  onChange={() =>
                    onFiltersChange({ ...filters, aiIsResolved: true })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">
                  {(helpdesk?.resolved as string) || 'Resolved'}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="aiResolved"
                  checked={filters.aiIsResolved === false}
                  onChange={() =>
                    onFiltersChange({ ...filters, aiIsResolved: false })
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm">
                  {(helpdesk?.unresolved as string) || 'Unresolved'}
                </span>
              </label>
            </div>
          </div>

          {/* Awaiting Answer Filter */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={filters.awaitingAnswer || false}
              onCheckedChange={(checked) =>
                onFiltersChange({
                  ...filters,
                  awaitingAnswer: checked ? true : undefined,
                })
              }
            />
            <span className="text-sm font-medium">
              {(helpdesk?.awaitingAnswer as string) ||
                'Awaiting Answer (Last message not from support)'}
            </span>
          </label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
