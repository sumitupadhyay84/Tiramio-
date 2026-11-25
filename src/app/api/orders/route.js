import { NextResponse } from 'next/server';
import { createOrder } from '@/lib/ordersStore';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const customerName = String(body.customerName || '').trim();
    const phone = String(body.phone || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (customerName.length < 2 || !/^[6-9]\d{9}$/.test(phone) || items.length === 0) {
      return NextResponse.json({ message: 'Please check order customer name, phone, and items.' }, { status: 400 });
    }
    if (body.fulfilment === 'Delivery' && !String(body.address || '').trim()) {
      return NextResponse.json({ message: 'Delivery address is required for delivery orders.' }, { status: 400 });
    }

    const order = createOrder(body);
    return NextResponse.json({
      orderRef: order.order_ref,
      status: order.status,
      total: order.total_paise / 100,
      paymentMethod: order.payment_method,
      createdAt: order.created_at
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json({ message: 'Unable to create order.' }, { status: 500 });
  }
}
