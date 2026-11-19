import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { upvoteReviewHelpful } from '@/lib/reviewsStore';

export async function POST(request, { params }) {
  const { id } = await params;
  const ip = request.headers.get('x-forwarded-for') || 'local';
  const voterIpHash = crypto.createHash('sha256').update(ip).digest('hex');

  const result = upvoteReviewHelpful(id, voterIpHash);
  return NextResponse.json({ helpful: result.voted });
}
