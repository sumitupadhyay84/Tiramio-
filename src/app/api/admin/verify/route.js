import { NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/adminAuth';

export async function GET(request) {
  const isAuth = verifyAdminRequest(request);
  if (!isAuth) {
    return NextResponse.json({ message: 'Unauthorized. Admin privileges required.' }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    role: 'administrator',
    user: 'admin',
    verifiedAt: new Date().toISOString()
  });
}
