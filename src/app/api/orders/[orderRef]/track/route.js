import { NextResponse } from 'next/server';
import { trackOrder } from '@/lib/ordersStore';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { orderRef } = await params;
  const { searchParams } = new URL(request.url);
  const phone = String(searchParams.get('phone') || '').trim();

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ message: 'A valid 10-digit mobile number is required.' }, { status: 400 });
  }

  const order = trackOrder(orderRef, phone);
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
}
