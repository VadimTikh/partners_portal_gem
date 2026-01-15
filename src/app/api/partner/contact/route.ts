import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { createSupportTicket } from '@/lib/services/odoo';

/**
 * POST /api/partner/contact
 *
 * Send a contact/support request.
 * Creates a helpdesk ticket in Odoo.
 */
export async function POST(request: NextRequest) {
  return withAuth(request, async (req, user) => {
    try {
      const body = await req.json();
      const { subject, message } = body;

      // Validate required fields
      if (!subject) {
        return NextResponse.json(
          { error: 'Subject is required' },
          { status: 400 }
        );
      }

      // Create support ticket in Odoo
      const { ticketId } = await createSupportTicket({
        userName: user.name,
        userEmail: user.email,
        subject: subject.trim(),
        message: message?.trim(),
      });

      return NextResponse.json({
        success: true,
        message: 'Support request submitted successfully',
        ticketId,
      });
    } catch (error) {
      console.error('[Contact] Error:', error);
      return NextResponse.json(
        { error: 'Failed to submit support request' },
        { status: 500 }
      );
    }
  });
}
