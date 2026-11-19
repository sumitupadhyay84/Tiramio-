import { NextResponse } from 'next/server';
import { getPublicStats } from '@/lib/reviewsStore';

export async function GET() {
  const stats = getPublicStats();
  return NextResponse.json(stats);
}
