import { NextResponse } from 'next/server';
import { getNextOrderRef } from '@/lib/ordersStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ orderRef: getNextOrderRef() });
}
