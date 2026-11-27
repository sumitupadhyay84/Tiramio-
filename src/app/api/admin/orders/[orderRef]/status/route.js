import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { updateOrderStatus } from '@/lib/ordersStore';
import { hasDatabase } from '@/lib/pgDb';
import { updateOrderStatusPg } from '@/lib/pgStore';

export async function PATCH(request, { params }) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  try {
    const { orderRef } = await params;
    const body = await request.json().catch(() => ({}));
    const updated = hasDatabase()
      ? await updateOrderStatusPg(orderRef, body.status, body.note)
      : updateOrderStatus(orderRef, body.status, body.note);
    if (!updated) {
      return NextResponse.json({ message: 'Order not found or invalid status.' }, { status: 404 });
    }

    return NextResponse.json({ orderRef: updated.order_ref, status: updated.status });
  } catch (error) {
    console.error('PATCH /api/admin/orders/[orderRef]/status error:', error);
    return NextResponse.json({ message: 'Failed to update order status.' }, { status: 500 });
  }
}
