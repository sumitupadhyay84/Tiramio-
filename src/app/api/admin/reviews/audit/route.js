import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { getAuditLogsForAdmin } from '@/lib/reviewsStore';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100));
  return NextResponse.json({ auditLogs: getAuditLogsForAdmin(limit) });
}
