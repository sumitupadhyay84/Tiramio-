import { NextResponse } from 'next/server';
import { getPublicStats } from '@/lib/reviewsStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = getPublicStats();
  return NextResponse.json(stats);
}
