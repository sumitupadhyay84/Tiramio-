import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { upvoteReviewHelpful } from '@/lib/reviewsStore';
import { hasDatabase } from '@/lib/pgDb';
import { upvoteReviewHelpfulPg } from '@/lib/pgStore';
import { getClientIp } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const voteRateMap = new Map();
function checkVoteRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const rec = voteRateMap.get(ip);
  if (!rec || now - rec.start > windowMs) {
    voteRateMap.set(ip, { start: now, count: 1 });
    return true;
  }
  if (rec.count >= 20) return false;
  rec.count += 1;
  return true;
}

export async function POST(request, { params }) {
  const { id } = await params;
  const ip = getClientIp(request);

  if (!checkVoteRateLimit(ip)) {
    return NextResponse.json(
      { helpful: false, message: 'Too many voting requests. Please slow down.' },
      { status: 429 }
    );
  }

  // Combine IP + optional client voter cookie/header if sent, hashed server-side
  const body = await request.json().catch(() => ({}));
  const accountOrVoterHint = String(request.headers.get('x-voter-id') || body.voterId || '').trim().slice(0, 64);
  const voterSource = accountOrVoterHint ? `${ip}:${accountOrVoterHint}` : ip;
  const voterHash = crypto.createHash('sha256').update(voterSource).digest('hex');

  try {
    const result = hasDatabase()
      ? await upvoteReviewHelpfulPg(id, voterHash)
      : upvoteReviewHelpful(id, voterHash);
    if (result.notFound) {
      return NextResponse.json({ helpful: false, message: 'Published review not found.' }, { status: 404 });
    }
    if (result.duplicate) {
      return NextResponse.json(
        { helpful: false, duplicate: true, helpfulCount: result.helpfulCount, message: 'You have already marked this review as helpful.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      helpful: Boolean(result.voted),
      helpfulCount: result.helpfulCount
    });
  } catch (error) {
    console.error('POST /api/reviews/[id]/helpful error:', error);
    return NextResponse.json({ helpful: false, message: 'Failed to record helpful vote.' }, { status: 500 });
  }
}
