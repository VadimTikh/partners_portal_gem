/**
 * Odoo integration service
 *
 * Creates helpdesk tickets in Odoo via JSON-RPC API.
 */

import { config } from '@/lib/config';

interface OdooRpcResponse {
  jsonrpc: string;
  id: number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data: {
      name: string;
      debug: string;
      message: string;
      arguments: string[];
    };
  };
}

interface OdooContact {
  id: number;
  name: string;
  email: string;
}

/**
 * Make a JSON-RPC call to Odoo
 */
async function odooRpc(
  method: string,
  params: unknown[]
): Promise<OdooRpcResponse> {
  const response = await fetch(config.odoo.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [
          config.odoo.db,
          config.odoo.userId,
          config.odoo.apiKey,
          ...params,
        ],
      },
      id: null,
    }),
  });

  return response.json() as Promise<OdooRpcResponse>;
}

/**
 * Search for an existing contact by email
 */
export async function findContactByEmail(email: string): Promise<OdooContact | null> {
  const response = await odooRpc('execute_kw', [
    'res.partner',
    'search_read',
    [[['email', '=', email]]],
    { fields: ['id', 'name', 'email'], limit: 1 },
  ]);

  if (response.error) {
    console.error('[Odoo] Error searching for contact:', response.error);
    throw new Error('Failed to search for contact in Odoo');
  }

  const contacts = response.result as OdooContact[];
  return contacts && contacts.length > 0 ? contacts[0] : null;
}

/**
 * Create a new contact in Odoo
 */
export async function createContact(
  name: string,
  email: string
): Promise<number> {
  const response = await odooRpc('execute_kw', [
    'res.partner',
    'create',
    [{
      name,
      email,
      phone: '',
      type: 'contact',
    }],
  ]);

  if (response.error) {
    console.error('[Odoo] Error creating contact:', response.error);
    throw new Error('Failed to create contact in Odoo');
  }

  return response.result as number;
}

/**
 * Create a helpdesk ticket in Odoo
 */
export async function createHelpdeskTicket(data: {
  subject: string;
  partnerEmail: string;
  partnerId: number;
  teamId?: number;
  userId?: number;
}): Promise<number> {
  const response = await odooRpc('execute_kw', [
    'helpdesk.ticket',
    'create',
    [{
      name: data.subject,
      partner_email: data.partnerEmail,
      partner_id: data.partnerId,
      team_id: data.teamId || 77, // Default team ID from n8n
      user_id: data.userId || 18, // Default user ID from n8n
    }],
  ]);

  if (response.error) {
    console.error('[Odoo] Error creating ticket:', response.error);
    throw new Error('Failed to create ticket in Odoo');
  }

  return response.result as number;
}

/**
 * Create a support ticket with contact creation if needed
 *
 * This is the main function used by the contact endpoint.
 * It will:
 * 1. Search for existing contact by email
 * 2. Create contact if not found
 * 3. Create helpdesk ticket linked to the contact
 */
export async function createSupportTicket(data: {
  userName: string;
  userEmail: string;
  subject: string;
  message?: string;
}): Promise<{ ticketId: number; contactId: number }> {
  // Find or create contact
  const contact = await findContactByEmail(data.userEmail);
  let contactId: number;

  if (contact) {
    contactId = contact.id;
  } else {
    contactId = await createContact(data.userName, data.userEmail);
  }

  // Create ticket
  const ticketSubject = `New Partner Request - ${data.subject.replace(/"/g, "'")}`;
  const ticketId = await createHelpdeskTicket({
    subject: ticketSubject,
    partnerEmail: data.userEmail,
    partnerId: contactId,
  });

  return { ticketId, contactId };
}
