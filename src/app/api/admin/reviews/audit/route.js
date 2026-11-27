import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';
import { getAuditLogsForAdmin } from '@/lib/reviewsStore';
import { hasDatabase } from '@/lib/pgDb';
import { getAuditLogsForAdminPg } from '@/lib/pgStore';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100', 10) || 100));
    const auditLogs = hasDatabase() ? await getAuditLogsForAdminPg(limit) : getAuditLogsForAdmin(limit);
    return NextResponse.json({ auditLogs });
  } catch (error) {
    console.error('GET /api/admin/reviews/audit error:', error);
    return NextResponse.json({ message: 'Failed to load audit log.' }, { status: 500 });
  }
}
