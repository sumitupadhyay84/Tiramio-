import { NextResponse } from 'next/server';
import { getNextOrderRef } from '@/lib/ordersStore';
import { hasDatabase } from '@/lib/pgDb';
import { getNextOrderRefPg } from '@/lib/pgStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const orderRef = hasDatabase() ? await getNextOrderRefPg() : getNextOrderRef();
    return NextResponse.json({ orderRef });
  } catch (error) {
    console.error('GET /api/orders/next-ref error:', error);
    return NextResponse.json({ orderRef: getNextOrderRef() });
  }
}
