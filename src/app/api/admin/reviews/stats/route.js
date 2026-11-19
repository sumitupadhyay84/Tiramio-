import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';
import { getAdminStats } from '@/lib/reviewsStore';

export async function GET(request) {
  if (!verifyAdminRequest(request)) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  const stats = getAdminStats();
  return NextResponse.json(stats);
}
