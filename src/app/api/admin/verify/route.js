import { NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/adminAuth';

export async function GET(request) {
  const admin = getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    role: admin.role,
    user: admin.username,
    verifiedAt: new Date().toISOString()
  });
}
