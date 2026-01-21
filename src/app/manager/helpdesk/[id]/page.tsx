'use client';

import { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { de, enUS, uk } from 'date-fns/locale';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  User,
  Mail,
  Tag,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Brain,
  Target,
  Languages,
  TrendingUp,
  FileText,
  Lightbulb,
  Heart,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { TicketAIAnalysis, TicketAIAnalysisPhase1 } from '@/lib/types/helpdesk';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

function getPriorityColor(priority: number): string {
  switch (priority) {
    case 3: return 'bg-red-100 text-red-800';
    case 2: return 'bg-orange-100 text-orange-800';
    case 1: return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityLabel(priority: number, t: Record<string, unknown>): string {
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;
  switch (priority) {
    case 3: return (helpdesk?.urgent as string) || 'Urgent';
    case 2: return (helpdesk?.high as string) || 'High';
    case 1: return (helpdesk?.normal as string) || 'Normal';
    default: return (helpdesk?.low as string) || 'Low';
  }
}

function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-300';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    default: return 'bg-green-100 text-green-800 border-green-300';
  }
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'frustrated': return 'text-red-600';
    case 'concerned': return 'text-orange-600';
    case 'neutral': return 'text-gray-600';
    case 'satisfied': return 'text-green-600';
    default: return 'text-gray-600';
  }
}

function getSentimentEmoji(sentiment: string): string {
  switch (sentiment) {
    case 'frustrated': return '😤';
    case 'concerned': return '😟';
    case 'neutral': return '😐';
    case 'satisfied': return '😊';
    default: return '😐';
  }
}

interface AIAnalysisPanelProps {
  ticketId: number;
  analysis: TicketAIAnalysis | TicketAIAnalysisPhase1 | null;
  isLoading: boolean;
  onAnalyze: (mode: 'full' | 'quick') => void;
  helpdesk: Record<string, unknown> | undefined;
}

function AIAnalysisPanel({ ticketId, analysis, isLoading, onAnalyze, helpdesk }: AIAnalysisPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isFullAnalysis = analysis && 'summary' in analysis;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg">{(helpdesk?.aiAnalysis as string) || 'AI Analysis'}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {!analysis && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAnalyze('quick')}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4 mr-2" />
                  )}
                  Quick
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onAnalyze('full')}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {(helpdesk?.analyzeWithAI as string) || 'Analyze'}
                </Button>
              </>
            )}
            {analysis && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
        {!analysis && (
          <CardDescription>
            Use AI to analyze this ticket and get insights
          </CardDescription>
        )}
      </CardHeader>

      {analysis && isExpanded && (
        <CardContent className="space-y-4">
          {/* Phase 1 Results - Always shown */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Urgency */}
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{(helpdesk?.urgency as string) || 'Urgency'}</span>
              </div>
              <Badge className={getUrgencyColor(analysis.urgency)}>
                {analysis.urgency.toUpperCase()}
              </Badge>
              {analysis.urgencyReason && (
                <p className="text-xs text-muted-foreground mt-2">{analysis.urgencyReason}</p>
              )}
            </div>

            {/* Category */}
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{(helpdesk?.category as string) || 'Category'}</span>
              </div>
              <Badge variant="outline" className="capitalize">{analysis.category.replace('_', ' ')}</Badge>
            </div>

            {/* Language */}
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{(helpdesk?.language as string) || 'Language'}</span>
              </div>
              <Badge variant="secondary">{analysis.language.toUpperCase()}</Badge>
            </div>

            {/* Extracted Data */}
            {analysis.extractedData && (
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{(helpdesk?.extractedData as string) || 'Extracted Data'}</span>
                </div>
                <div className="space-y-1 text-xs">
                  {analysis.extractedData.orderNumber && (
                    <p><span className="text-muted-foreground">{(helpdesk?.orderNumber as string) || 'Order'}:</span> {analysis.extractedData.orderNumber}</p>
                  )}
                  {analysis.extractedData.eventName && (
                    <p><span className="text-muted-foreground">{(helpdesk?.eventName as string) || 'Event'}:</span> {analysis.extractedData.eventName}</p>
                  )}
                  {analysis.extractedData.customerEmail && (
                    <p><span className="text-muted-foreground">{(helpdesk?.customer as string) || 'Customer'}:</span> {analysis.extractedData.customerEmail}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Phase 2 Results - Only for full analysis */}
          {isFullAnalysis && (
            <>
              <Separator />

              {/* Summary */}
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{(helpdesk?.summary as string) || 'Summary'}</span>
                </div>
                <p className="text-sm">{(analysis as TicketAIAnalysis).summary}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Customer Intent */}
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{(helpdesk?.customerIntent as string) || 'Customer Intent'}</span>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {(analysis as TicketAIAnalysis).customerIntent.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Sentiment */}
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{(helpdesk?.sentiment as string) || 'Sentiment'}</span>
                  </div>
                  <p className={`text-lg font-medium capitalize ${getSentimentColor((analysis as TicketAIAnalysis).sentiment)}`}>
                    {getSentimentEmoji((analysis as TicketAIAnalysis).sentiment)} {(analysis as TicketAIAnalysis).sentiment}
                  </p>
                </div>

                {/* Recommended Action */}
                <div className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{(helpdesk?.actionRequired as string) || 'Recommended Action'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(analysis as TicketAIAnalysis).actionRequired}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Run Full Analysis button if only quick was done */}
          {analysis && !isFullAnalysis && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => onAnalyze('full')}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {(helpdesk?.analyzeWithAI as string) || 'Run Full Analysis'}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const ticketId = parseInt(resolvedParams.id, 10);

  const { t, locale } = useI18n();
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const queryClient = useQueryClient();
  const helpdesk = t.helpdesk as Record<string, unknown> | undefined;

  const dateLocale = locale === 'de' ? de : locale === 'uk' ? uk : enUS;

  const [aiAnalysis, setAiAnalysis] = useState<TicketAIAnalysis | TicketAIAnalysisPhase1 | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['helpdesk-ticket', ticketId],
    queryFn: () => api.getHelpdeskTicket(ticketId),
    enabled: hasHydrated && !isNaN(ticketId),
  });

  const analyzeMutation = useMutation({
    mutationFn: ({ mode }: { mode: 'full' | 'quick' }) =>
      api.analyzeHelpdeskTicket(ticketId, mode, mode === 'full' && aiAnalysis ? aiAnalysis as TicketAIAnalysisPhase1 : undefined),
    onSuccess: (result) => {
      if (result.analysis) {
        setAiAnalysis(result.analysis);
      }
    },
  });

  const handleAnalyze = (mode: 'full' | 'quick') => {
    analyzeMutation.mutate({ mode });
  };

  if (!hasHydrated || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.ticket) {
    return (
      <div className="space-y-6">
        <Link href="/manager/helpdesk">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {(helpdesk?.backToList as string) || 'Back to Tickets'}
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{(helpdesk?.ticketNotFound as string) || 'Ticket not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { ticket, messages } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manager/helpdesk">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {(helpdesk?.backToList as string) || 'Back'}
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">#{ticket.id}</h1>
              <Badge variant="outline" className={
                ticket.stage_status === 'new' ? 'border-blue-500 text-blue-700' :
                ticket.stage_status === 'in_progress' ? 'border-yellow-500 text-yellow-700' :
                ticket.stage_status === 'waiting_customer' ? 'border-purple-500 text-purple-700' :
                ticket.stage_status === 'solved' ? 'border-green-500 text-green-700' :
                ticket.stage_status === 'cancelled' ? 'border-gray-500 text-gray-600' :
                'border-gray-300'
              }>
                {ticket.stage_name}
              </Badge>
              <Badge className={getPriorityColor(ticket.priority)}>
                {getPriorityLabel(ticket.priority, t)}
              </Badge>
            </div>
            <h2 className="text-lg text-muted-foreground">{ticket.name}</h2>
          </div>
        </div>
      </div>

      {/* AI Analysis Panel */}
      <AIAnalysisPanel
        ticketId={ticketId}
        analysis={aiAnalysis}
        isLoading={analyzeMutation.isPending}
        onAnalyze={handleAnalyze}
        helpdesk={helpdesk}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {ticket.description && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{(helpdesk?.ticketDescription as string) || 'Description'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: ticket.description }}
                />
              </CardContent>
            </Card>
          )}

          {/* Messages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {(helpdesk?.messages as string) || 'Messages'} ({messages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {(helpdesk?.noMessages as string) || 'No messages yet'}
                </p>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 rounded-lg border ${
                        message.message_type === 'comment'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {message.author_name || (helpdesk?.system as string) || 'System'}
                          </span>
                          {message.message_type === 'comment' && (
                            <Badge variant="secondary" className="text-xs">
                              {(helpdesk?.internalNote as string) || 'Internal'}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.date), 'PPp', { locale: dateLocale })}
                        </span>
                      </div>
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: message.body }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{(helpdesk?.ticketInfo as string) || 'Ticket Info'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{(helpdesk?.created as string) || 'Created'}</p>
                  <p className="text-sm">{format(new Date(ticket.create_date), 'PPp', { locale: dateLocale })}</p>
                </div>
              </div>

              {ticket.close_date && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{(helpdesk?.closed as string) || 'Closed'}</p>
                    <p className="text-sm">{format(new Date(ticket.close_date), 'PPp', { locale: dateLocale })}</p>
                  </div>
                </div>
              )}

              {ticket.partner_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{(helpdesk?.customerEmail as string) || 'Customer Email'}</p>
                    <p className="text-sm">{ticket.partner_email}</p>
                  </div>
                </div>
              )}

              {ticket.ticket_type_name && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{(helpdesk?.ticketType as string) || 'Type'}</p>
                    <p className="text-sm">{ticket.ticket_type_name}</p>
                  </div>
                </div>
              )}

              {ticket.user_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">{(helpdesk?.assignedTo as string) || 'Assigned To'}</p>
                    <p className="text-sm">{ticket.user_name}</p>
                  </div>
                </div>
              )}

              {ticket.tag_ids && ticket.tag_ids.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{(helpdesk?.tags as string) || 'Tags'}</p>
                  <div className="flex flex-wrap gap-1">
                    {ticket.tag_ids.map((tagId) => (
                      <Badge key={tagId} variant="secondary" className="text-xs">
                        Tag #{tagId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
