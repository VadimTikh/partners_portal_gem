/**
 * Odoo JSON-RPC API Client
 *
 * Provides methods for interacting with Odoo helpdesk via JSON-RPC.
 * Used for fetching tickets, stages, types, and messages.
 */

import {
  OdooTicket,
  OdooMessage,
  HelpdeskStage,
  HelpdeskTicketType,
  Ticket,
  TicketMessage,
  TicketPriority,
  AgeBucket,
  TicketLogicalStatus,
} from './types/helpdesk';

// ============================================
// Configuration
// ============================================

const ODOO_CONFIG = {
  url: process.env.ODOO_URL || '',           // https://odoo.example.com/jsonrpc
  db: process.env.ODOO_DB || '',             // your-odoo-database
  uid: Number(process.env.ODOO_USER_ID) || 1,
  apiKey: process.env.ODOO_API_KEY || '',
};

// Miomente helpdesk team ID
const MIOMENTE_TEAM_ID = 77;

// ============================================
// JSON-RPC Helper
// ============================================

interface OdooRPCResponse<T> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: {
      name: string;
      message: string;
      debug?: string;
    };
  };
}

/**
 * Execute an Odoo JSON-RPC call
 */
async function odooCall<T>(
  model: string,
  method: string,
  domain: unknown[],
  options: Record<string, unknown> = {}
): Promise<T> {
  if (!ODOO_CONFIG.url || !ODOO_CONFIG.db || !ODOO_CONFIG.apiKey) {
    throw new Error('Odoo configuration is incomplete. Check ODOO_URL, ODOO_DB, ODOO_USER_ID, and ODOO_API_KEY environment variables.');
  }

  const response = await fetch(ODOO_CONFIG.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_CONFIG.db,
          ODOO_CONFIG.uid,
          ODOO_CONFIG.apiKey,
          model,
          method,
          domain,
          options,
        ],
      },
      id: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Odoo HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as OdooRPCResponse<T>;

  if (data.error) {
    const errorMessage = data.error.data?.message || data.error.message || 'Unknown Odoo error';
    console.error('Odoo API error:', data.error);
    throw new Error(`Odoo API error: ${errorMessage}`);
  }

  return data.result as T;
}

// ============================================
// Data Normalization
// ============================================

/**
 * Map Odoo priority string to our enum
 */
function mapPriority(priority: string): TicketPriority {
  switch (priority) {
    case '3': return 'urgent';
    case '2': return 'high';
    case '1': return 'normal';
    default: return 'low';
  }
}

/**
 * Calculate age bucket based on creation date
 */
function calculateAgeBucket(createdAt: string): AgeBucket {
  const created = new Date(createdAt);
  const now = new Date();
  const hoursOld = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

  if (hoursOld < 24) return '<24h';
  if (hoursOld < 72) return '1-3d';  // 1-3 days
  if (hoursOld < 168) return '3-7d'; // 3-7 days
  return '>7d';
}

/**
 * Calculate age in hours
 */
function calculateAgeInHours(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.round((now.getTime() - created.getTime()) / (1000 * 60 * 60));
}

/**
 * Determine logical status from stage name
 * This interprets German stage names to logical statuses
 */
export function inferLogicalStatus(stageName: string, isClosed: boolean): TicketLogicalStatus {
  const nameLower = stageName.toLowerCase();

  if (isClosed) {
    return 'resolved';
  }

  // Check for dispute-related keywords
  if (
    nameLower.includes('disput') ||
    nameLower.includes('streit') ||
    nameLower.includes('eskaliert') ||
    nameLower.includes('escalat')
  ) {
    return 'disputed';
  }

  // Check for waiting/customer response keywords
  if (
    nameLower.includes('warten') ||
    nameLower.includes('waiting') ||
    nameLower.includes('kunde') && nameLower.includes('antwort') ||
    nameLower.includes('customer') && nameLower.includes('response')
  ) {
    return 'waiting_customer';
  }

  // Check for in-progress keywords
  if (
    nameLower.includes('bearbeitung') ||
    nameLower.includes('progress') ||
    nameLower.includes('verarbeitung') ||
    nameLower.includes('processing')
  ) {
    return 'in_progress';
  }

  // Check for new/open keywords
  if (
    nameLower.includes('neu') ||
    nameLower.includes('new') ||
    nameLower.includes('offen') ||
    nameLower.includes('open') ||
    nameLower.includes('eingang') ||
    nameLower.includes('inbox')
  ) {
    return 'new';
  }

  // Default to new if we can't determine
  return 'new';
}

/**
 * Normalize an Odoo ticket to our frontend format (snake_case)
 */
function normalizeTicket(raw: OdooTicket, stages: HelpdeskStage[]): Ticket {
  const stage_id = raw.stage_id ? raw.stage_id[0] : 0;
  const stage_name = raw.stage_id ? raw.stage_id[1] : 'Unknown';
  const stage = stages.find(s => s.id === stage_id);
  const is_closed = stage?.is_close ?? false;
  const stage_status = inferLogicalStatus(stage_name, is_closed);

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description || '',
    stage_id,
    stage_name,
    stage_status,
    is_closed,
    partner_id: raw.partner_id ? raw.partner_id[0] : null,
    partner_name: raw.partner_id ? raw.partner_id[1] : '',
    partner_email: raw.partner_email || '',
    user_id: raw.user_id ? raw.user_id[0] : null,
    user_name: raw.user_id ? raw.user_id[1] : '',
    create_date: raw.create_date,
    close_date: raw.close_date || null,
    priority: parseInt(raw.priority, 10) || 0,
    ticket_type_id: raw.ticket_type_id ? raw.ticket_type_id[0] : null,
    ticket_type_name: raw.ticket_type_id ? raw.ticket_type_id[1] : '',
    tag_ids: raw.tag_ids,
    age_in_hours: calculateAgeInHours(raw.create_date),
    age_bucket: calculateAgeBucket(raw.create_date),
  };
}

/**
 * Normalize an Odoo message to our frontend format (snake_case)
 */
function normalizeMessage(raw: OdooMessage): TicketMessage {
  return {
    id: raw.id,
    ticket_id: raw.res_id,
    date: raw.date,
    author_id: raw.author_id ? raw.author_id[0] : null,
    author_name: raw.author_id ? raw.author_id[1] : '',
    email_from: raw.email_from || '',
    body: raw.body,
    message_type: raw.message_type,
  };
}

// ============================================
// Public API
// ============================================

/**
 * Determine if a stage represents a closed/resolved state based on name
 */
function isClosedStage(stageName: string): boolean {
  const nameLower = stageName.toLowerCase();
  return (
    nameLower.includes('gelöst') ||
    nameLower.includes('solved') ||
    nameLower.includes('geschlossen') ||
    nameLower.includes('closed') ||
    nameLower.includes('erledigt') ||
    nameLower.includes('done') ||
    nameLower.includes('abgeschlossen') ||
    nameLower.includes('cancelled') ||
    nameLower.includes('storniert')
  );
}

/**
 * Fetch all helpdesk stages for Miomente team
 */
export async function getHelpdeskStages(): Promise<HelpdeskStage[]> {
  const rawStages = await odooCall<Array<{
    id: number;
    name: string;
    sequence: number;
    fold: boolean;
  }>>(
    'helpdesk.stage',
    'search_read',
    [[['team_ids', 'in', [MIOMENTE_TEAM_ID]]]],
    {
      fields: ['id', 'name', 'sequence', 'fold'],
      order: 'sequence asc',
    }
  );

  // Add is_close based on stage name analysis
  return rawStages.map(stage => ({
    ...stage,
    is_close: isClosedStage(stage.name),
  }));
}

/**
 * Fetch all ticket types (categories)
 * Returns empty array if the model doesn't exist in Odoo
 */
export async function getTicketTypes(): Promise<HelpdeskTicketType[]> {
  try {
    const types = await odooCall<Array<{
      id: number;
      name: string;
    }>>(
      'helpdesk.ticket.type',
      'search_read',
      [[]],
      { fields: ['id', 'name'] }
    );

    return types;
  } catch (error) {
    // Model might not exist in this Odoo installation
    console.warn('[Odoo] helpdesk.ticket.type model not available:', error);
    return [];
  }
}

/**
 * Fetch tickets with filters
 */
export async function getTickets(params: {
  stageIds?: number[];
  typeIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
  order?: string;
}): Promise<{ tickets: Ticket[]; total: number; stages: HelpdeskStage[] }> {
  // Build domain filter - Odoo domain is a list where each element is either:
  // - A tuple [field, operator, value]
  // - A string '|' or '&' for OR/AND operations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const domain: any[] = [
    ['team_id', '=', MIOMENTE_TEAM_ID],
  ];

  if (params.stageIds && params.stageIds.length > 0) {
    domain.push(['stage_id', 'in', params.stageIds]);
  }

  // Note: ticket_type_id filter disabled - field may not exist in Odoo
  // if (params.typeIds && params.typeIds.length > 0) {
  //   domain.push(['ticket_type_id', 'in', params.typeIds]);
  // }

  if (params.dateFrom) {
    domain.push(['create_date', '>=', params.dateFrom]);
  }

  if (params.dateTo) {
    domain.push(['create_date', '<=', params.dateTo]);
  }

  if (params.search) {
    // Search in name, description, and partner email using OR
    // Odoo OR syntax: '|' applies to the next 2 terms, so for 3 terms: '|', '|', term1, term2, term3
    domain.push('|');
    domain.push('|');
    domain.push(['name', 'ilike', params.search]);
    domain.push(['description', 'ilike', params.search]);
    domain.push(['partner_email', 'ilike', params.search]);
  }

  // Fetch stages first (needed for normalization)
  const stages = await getHelpdeskStages();

  // Get total count
  const totalCount = await odooCall<number>(
    'helpdesk.ticket',
    'search_count',
    [[...domain]],
    {}
  );

  // Fetch tickets
  const rawTickets = await odooCall<OdooTicket[]>(
    'helpdesk.ticket',
    'search_read',
    [[...domain]],
    {
      fields: [
        'id', 'name', 'description', 'stage_id', 'partner_id',
        'partner_email', 'user_id', 'create_date', 'close_date',
        'priority', 'tag_ids',
      ],
      order: params.order || 'create_date desc',
      limit: params.limit || 50,
      offset: params.offset || 0,
    }
  );

  const tickets = rawTickets.map(t => normalizeTicket(t, stages));

  return { tickets, total: totalCount, stages };
}

/**
 * Fetch a single ticket by ID
 */
export async function getTicket(id: number): Promise<Ticket | null> {
  const stages = await getHelpdeskStages();

  const rawTickets = await odooCall<OdooTicket[]>(
    'helpdesk.ticket',
    'search_read',
    [[['id', '=', id], ['team_id', '=', MIOMENTE_TEAM_ID]]],
    {
      fields: [
        'id', 'name', 'description', 'stage_id', 'partner_id',
        'partner_email', 'user_id', 'create_date', 'close_date',
        'priority', 'tag_ids',
      ],
    }
  );

  if (rawTickets.length === 0) {
    return null;
  }

  return normalizeTicket(rawTickets[0], stages);
}

/**
 * Fetch messages for a ticket
 */
export async function getTicketMessages(ticketId: number): Promise<TicketMessage[]> {
  const rawMessages = await odooCall<OdooMessage[]>(
    'mail.message',
    'search_read',
    [[
      ['model', '=', 'helpdesk.ticket'],
      ['res_id', '=', ticketId],
      ['message_type', 'in', ['email', 'comment']],
    ]],
    {
      fields: ['res_id', 'date', 'author_id', 'email_from', 'body', 'message_type'],
      order: 'date asc',
    }
  );

  return rawMessages.map(normalizeMessage);
}

/**
 * Fetch messages for multiple tickets (batch)
 */
export async function getTicketMessagesBatch(ticketIds: number[]): Promise<Map<number, TicketMessage[]>> {
  if (ticketIds.length === 0) {
    return new Map();
  }

  const rawMessages = await odooCall<OdooMessage[]>(
    'mail.message',
    'search_read',
    [[
      ['model', '=', 'helpdesk.ticket'],
      ['res_id', 'in', ticketIds],
      ['message_type', 'in', ['email', 'comment']],
    ]],
    {
      fields: ['res_id', 'date', 'author_id', 'email_from', 'body', 'message_type'],
      order: 'res_id, date asc',
    }
  );

  const messagesByTicket = new Map<number, TicketMessage[]>();

  for (const raw of rawMessages) {
    const message = normalizeMessage(raw);
    const existing = messagesByTicket.get(message.ticket_id) || [];
    existing.push(message);
    messagesByTicket.set(message.ticket_id, existing);
  }

  return messagesByTicket;
}

/**
 * Get analytics data for tickets
 */
export async function getTicketAnalytics(params: {
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  avgAgeHours: number;
  ticketsByStage: Map<number, number>;
  ticketsByType: Map<number, number>;
  ticketsByAgeBucket: Record<AgeBucket, number>;
}> {
  const domain: Array<[string, string, unknown]> = [
    ['team_id', '=', MIOMENTE_TEAM_ID],
  ];

  if (params.dateFrom) {
    domain.push(['create_date', '>=', params.dateFrom]);
  }

  if (params.dateTo) {
    domain.push(['create_date', '<=', params.dateTo]);
  }

  const stages = await getHelpdeskStages();

  // Fetch all tickets for the period (for analytics we need all)
  const rawTickets = await odooCall<OdooTicket[]>(
    'helpdesk.ticket',
    'search_read',
    [[...domain]],
    {
      fields: ['id', 'stage_id', 'create_date', 'close_date'],
      order: 'create_date desc',
    }
  );

  const closedStageIds = new Set(stages.filter(s => s.is_close).map(s => s.id));

  let totalTickets = rawTickets.length;
  let openTickets = 0;
  let closedTickets = 0;
  let totalAgeHours = 0;

  const ticketsByStage = new Map<number, number>();
  const ticketsByType = new Map<number, number>();
  const ticketsByAgeBucket: Record<AgeBucket, number> = {
    '<24h': 0,
    '1-3d': 0,
    '3-7d': 0,
    '>7d': 0,
  };

  for (const ticket of rawTickets) {
    const stageId = ticket.stage_id ? ticket.stage_id[0] : 0;
    const typeId = ticket.ticket_type_id ? ticket.ticket_type_id[0] : 0;
    const isClosed = closedStageIds.has(stageId);

    if (isClosed) {
      closedTickets++;
    } else {
      openTickets++;
      // Only count age for open tickets
      const ageHours = calculateAgeInHours(ticket.create_date);
      totalAgeHours += ageHours;
      ticketsByAgeBucket[calculateAgeBucket(ticket.create_date)]++;
    }

    // Count by stage
    ticketsByStage.set(stageId, (ticketsByStage.get(stageId) || 0) + 1);

    // Count by type (if available)
    if (typeId && typeId > 0) {
      ticketsByType.set(typeId, (ticketsByType.get(typeId) || 0) + 1);
    }
  }

  const avgAgeHours = openTickets > 0 ? Math.round(totalAgeHours / openTickets) : 0;

  return {
    totalTickets,
    openTickets,
    closedTickets,
    avgAgeHours,
    ticketsByStage,
    ticketsByType,
    ticketsByAgeBucket,
  };
}

/**
 * Check if Odoo is configured and reachable
 */
export async function checkOdooConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!ODOO_CONFIG.url || !ODOO_CONFIG.db || !ODOO_CONFIG.apiKey) {
      return { ok: false, error: 'Odoo configuration is incomplete' };
    }

    // Try to fetch stages as a simple health check
    await getHelpdeskStages();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
