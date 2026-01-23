import { NextRequest, NextResponse } from 'next/server';
// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';
import { withManager } from '@/lib/auth/middleware';
import {
  getAllBookingsForManager,
  countAllBookingsForManager,
  getPartnersWithBookings,
  getManagerBookingStats,
  DbManagerBooking,
} from '@/lib/db/queries/bookings';
import { query, MAGENTO_ATTRIBUTES } from '@/lib/db/mysql';
import { RowDataPacket } from 'mysql2';
import { BookingStatus, ManagerBooking, PartnerSummary, ManagerBookingStats } from '@/lib/types';

// Magento order data for enriching bookings
interface MagentoOrderData extends RowDataPacket {
  order_id: number;
  order_item_id: number;
  customer_firstname: string;
  customer_lastname: string;
  customer_email: string;
  customer_phone: string | null;
  product_name: string;
  event_date: string | null;
  event_time: string | null;
  qty_ordered: number;
  item_price: number;
}

/**
 * Fetch Magento order details for multiple order items
 */
async function fetchMagentoOrderDetails(
  orderItemIds: number[]
): Promise<Map<number, MagentoOrderData>> {
  if (orderItemIds.length === 0) {
    return new Map();
  }

  const placeholders = orderItemIds.map(() => '?').join(', ');

  const sql = `
    SELECT
      so.entity_id AS order_id,
      soi.item_id AS order_item_id,
      so.customer_firstname,
      so.customer_lastname,
      so.customer_email,
      soa.telephone AS customer_phone,
      soi.name AS product_name,
      CASE
        WHEN soi.sku REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.sku, '-', -3)
        WHEN soi.name REGEXP '[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN SUBSTRING_INDEX(soi.name, '-', -3)
        ELSE NULL
      END AS event_date,
      begin_time.value AS event_time,
      CAST(soi.qty_ordered AS UNSIGNED) AS qty_ordered,
      ROUND(COALESCE(soi_parent.row_total_incl_tax, soi.row_total_incl_tax, 0), 2) AS item_price
    FROM sales_flat_order_item AS soi
    INNER JOIN sales_flat_order AS so
      ON soi.order_id = so.entity_id
    LEFT JOIN sales_flat_order_address AS soa
      ON so.entity_id = soa.parent_id
      AND soa.address_type = 'billing'
    LEFT JOIN sales_flat_order_item AS soi_parent
      ON soi.parent_item_id = soi_parent.item_id
    LEFT JOIN catalog_product_entity_varchar AS begin_time
      ON soi.product_id = begin_time.entity_id
      AND begin_time.attribute_id = ${MAGENTO_ATTRIBUTES.BEGIN_TIME}
      AND begin_time.store_id = 0
    WHERE soi.item_id IN (${placeholders})
  `;

  const rows = await query<MagentoOrderData[]>(sql, orderItemIds);

  const result = new Map<number, MagentoOrderData>();
  for (const row of rows) {
    result.set(row.order_item_id, row);
  }

  return result;
}

/**
 * Transform database booking + Magento data to API response format
 */
function transformBooking(
  dbBooking: DbManagerBooking,
  magentoData: MagentoOrderData | undefined
): ManagerBooking {
  return {
    id: dbBooking.id,
    status: dbBooking.status,
    reminderCount: dbBooking.reminder_count,
    odooTicketId: dbBooking.odoo_ticket_id,
    createdAt: dbBooking.created_at,
    confirmedAt: dbBooking.confirmed_at,
    declinedAt: dbBooking.declined_at,
    declineReason: dbBooking.decline_reason,
    declineNotes: dbBooking.decline_notes,
    escalatedAt: dbBooking.escalated_at,

    partnerId: dbBooking.partner_id,
    partnerName: dbBooking.partner_name,
    partnerEmail: dbBooking.partner_email,
    customerNumber: dbBooking.customer_number,

    orderNumber: dbBooking.magento_order_increment_id || '',
    customerName: magentoData
      ? `${magentoData.customer_firstname} ${magentoData.customer_lastname}`
      : '',
    customerEmail: magentoData?.customer_email || '',
    customerPhone: magentoData?.customer_phone || '',
    courseName: magentoData?.product_name || '',
    eventDate: magentoData?.event_date || '',
    eventTime: magentoData?.event_time || '',
    participants: magentoData?.qty_ordered || 0,
    price: Number(magentoData?.item_price) || 0,
  };
}

/**
 * GET /api/manager/bookings
 *
 * Get all booking confirmations for manager dashboard.
 * Combines PostgreSQL confirmation data with Magento order details.
 *
 * Query params:
 * - status: 'pending' | 'confirmed' | 'declined' (optional)
 * - partnerId: string (optional)
 * - page: number (default: 1)
 * - limit: number (default: 20)
 */
export async function GET(request: NextRequest) {
  return withManager(request, async () => {
    try {
      const { searchParams } = new URL(request.url);

      // Parse query parameters
      const status = searchParams.get('status') as BookingStatus | null;
      const partnerId = searchParams.get('partnerId');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
      const offset = (page - 1) * limit;

      // Build filter options
      const filterOptions: {
        status?: BookingStatus;
        partnerId?: string;
        limit?: number;
        offset?: number;
      } = { limit, offset };

      if (status && ['pending', 'confirmed', 'declined'].includes(status)) {
        filterOptions.status = status;
      }

      if (partnerId) {
        filterOptions.partnerId = partnerId;
      }

      // Fetch bookings, count, stats, and partners in parallel
      const [dbBookings, total, stats, partners] = await Promise.all([
        getAllBookingsForManager(filterOptions),
        countAllBookingsForManager({
          status: filterOptions.status,
          partnerId: filterOptions.partnerId,
        }),
        getManagerBookingStats(),
        getPartnersWithBookings(),
      ]);

      // Get Magento order details for all bookings
      const orderItemIds = dbBookings.map((b) => b.magento_order_item_id);
      const magentoDataMap = await fetchMagentoOrderDetails(orderItemIds);

      // Transform bookings with Magento data
      const bookings: ManagerBooking[] = dbBookings.map((dbBooking) => {
        const magentoData = magentoDataMap.get(dbBooking.magento_order_item_id);
        return transformBooking(dbBooking, magentoData);
      });

      // Transform partners for dropdown
      const partnerList: PartnerSummary[] = partners.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
      }));

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        success: true,
        bookings,
        total,
        page,
        limit,
        totalPages,
        stats: stats as ManagerBookingStats,
        partners: partnerList,
      });
    } catch (error) {
      console.error('[Manager Bookings] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      );
    }
  });
}
