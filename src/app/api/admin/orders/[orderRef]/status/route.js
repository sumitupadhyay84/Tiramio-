import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { updateOrderStatus } from '@/lib/ordersStore';

export async function PATCH(request, { params }) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  const { orderRef } = await params;
  const body = await request.json().catch(() => ({}));
  const updated = updateOrderStatus(orderRef, body.status, body.note);
  if (!updated) {
    return NextResponse.json({ message: 'Order not found or invalid status.' }, { status: 404 });
  }

  return NextResponse.json({ orderRef: updated.order_ref, status: updated.status });
}
