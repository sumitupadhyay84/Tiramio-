import { NextResponse } from 'next/server';
import { trackOrder } from '@/lib/ordersStore';
import { hasDatabase } from '@/lib/pgDb';
import { trackOrderPg } from '@/lib/pgStore';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { orderRef } = await params;
    const { searchParams } = new URL(request.url);
    const phone = String(searchParams.get('phone') || '').trim();

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ message: 'A valid 10-digit mobile number is required.' }, { status: 400 });
    }

    const order = hasDatabase() ? await trackOrderPg(orderRef, phone) : trackOrder(orderRef, phone);
    if (!order) {
      return NextResponse.json({ message: 'No matching order was found. Check the reference and phone number.' }, { status: 404 });
    }

    return NextResponse.json({
      orderRef: order.order_ref,
      customerName: order.customer_name,
      fulfilment: order.fulfilment,
      status: order.status,
      paymentMethod: order.payment_method,
      paymentId: order.payment_id,
      paymentStatus: order.payment_status,
      total: order.total_paise / 100,
      items: order.items,
      events: order.events,
      createdAt: order.created_at,
      updatedAt: order.updated_at
    });
  } catch (error) {
    console.error('GET /api/orders/[orderRef]/track error:', error);
    return NextResponse.json({ message: 'Unable to track order.' }, { status: 500 });
  }
}
