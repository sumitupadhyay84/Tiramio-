import { NextResponse } from 'next/server';
import { getPool, hasDatabase } from '@/lib/pgDb';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();
  if (!hasDatabase()) {
    return NextResponse.json({
      ok: true,
      service: 'dear-misu-api',
      db: 'file',
      timestamp,
    });
  }

  try {
    await getPool().query('SELECT 1');
    return NextResponse.json({
      ok: true,
      service: 'dear-misu-api',
      db: 'postgres',
      timestamp,
    });
  } catch (error) {
    console.error('Health check database error:', error);
    return NextResponse.json(
      {
        ok: false,
        service: 'dear-misu-api',
        db: 'postgres',
        message: 'Database connection failed.',
        timestamp,
      },
      { status: 500 }
    );
  }
}
