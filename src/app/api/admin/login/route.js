import { NextResponse } from 'next/server';
import { validateAdminCredentials, createAdminToken, checkLoginRateLimit, recordFailedLogin, resetLoginAttempts } from '@/lib/adminAuth';

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';

    // Rate-limiting check (max 7 attempts per 15 min)
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, message: `Too many login attempts. Please wait ${rateCheck.minutesLeft} minutes before trying again.` },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const username = (body.username || '').trim();
    const password = (body.secretKey || body.password || '').trim();

    if (!username || !password) {
      recordFailedLogin(ip);
      return NextResponse.json(
        { success: false, message: 'Invalid administrative credentials. Access denied.' },
        { status: 401 }
      );
    }

    const isValid = validateAdminCredentials(username, password);
    if (!isValid) {
      recordFailedLogin(ip);
      return NextResponse.json(
        { success: false, message: 'Invalid administrative credentials. Access denied.' },
        { status: 401 }
      );
    }

    resetLoginAttempts(ip);
    const token = createAdminToken(username);

    return NextResponse.json({
      success: true,
      token,
      admin: {
        username,
        role: 'administrator',
        authenticatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}
