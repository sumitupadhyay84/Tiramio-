import { NextResponse } from 'next/server';
import { getPublicReviews, createReview } from '@/lib/reviewsStore';
import { hasDatabase } from '@/lib/pgDb';
import { getPublicReviewsPg, createReviewPg } from '@/lib/pgStore';
import { getClientIp } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const VALID_PRODUCTS = new Set([
  'Dear Misu Mini',
  'Dear Misu Classic',
  'Dear Misu Share Box',
  'Dear Misu Mini (100g)',
  'Dear Misu Classic (200g)',
  'Dear Misu Share Box (300g)'
]);

const submissionRateMap = new Map();
function checkSubmitRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const entry = submissionRateMap.get(ip);
  if (!entry || now - entry.start > windowMs) {
    submissionRateMap.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count += 1;
  return true;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';
    const product = searchParams.get('product') || '';
    const rating = searchParams.get('rating') || '';
    const verification = searchParams.get('verification') || '';
    const sort = searchParams.get('sort') || 'chronological';

    const query = { page, limit, product, rating, verification, sort };
    const data = hasDatabase()
      ? await getPublicReviewsPg(query)
      : getPublicReviews(query);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching public reviews:', error);
    return NextResponse.json({ reviews: [], total: 0, page: 1, totalPages: 1 }, { status: 200 });
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    if (!checkSubmitRateLimit(ip)) {
      return NextResponse.json(
        { message: 'Too many review submissions from this network. Please wait a few minutes.' },
        { status: 429 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let payload = {};

    if (contentType.includes('application/json')) {
      payload = await request.json().catch(() => ({}));
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        for (const [key, val] of formData.entries()) {
          if (key === 'feedbackTags') {
            try { payload[key] = JSON.parse(val); } catch { payload[key] = []; }
          } else if (key !== 'image') {
            payload[key] = val;
          }
        }
      }
    } else {
      payload = await request.json().catch(() => ({}));
    }

    // Honeypot check (anti-bot)
    if (payload.honeypot) {
      return NextResponse.json({ message: 'Thank you for your review!' }, { status: 200 });
    }

    // Server-side validation (never trust client status/verification fields)
    const cleanName = String(payload.customerName || '').replace(/<[^>]*>/g, '').trim();
    const productName = String(payload.productName || '').trim();
    const overallRating = Number(payload.overallRating);
    const cleanComment = String(payload.comment || '').replace(/<[^>]*>/g, '').trim();
    const customerEmail = payload.customerEmail ? String(payload.customerEmail).trim().toLowerCase() : null;
    const customerPhone = payload.customerPhone ? String(payload.customerPhone).replace(/\D/g, '').slice(-10) : null;
    const orderRef = payload.orderRef ? String(payload.orderRef).trim().toUpperCase() : null;

    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      return NextResponse.json({ message: 'Please provide a valid display name (2 to 80 characters).' }, { status: 400 });
    }
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return NextResponse.json({ message: 'Please provide a valid email address.' }, { status: 400 });
    }
    if (customerPhone && !/^[6-9]\d{9}$/.test(customerPhone)) {
      return NextResponse.json({ message: 'If providing a mobile number for verification, enter a valid 10-digit number.' }, { status: 400 });
    }
    if (!productName || !VALID_PRODUCTS.has(productName)) {
      return NextResponse.json({ message: 'Please select a valid Dear Misu product.' }, { status: 400 });
    }
    if (!Number.isInteger(overallRating) || overallRating < 1 || overallRating > 5) {
      return NextResponse.json({ message: 'Overall rating must be an integer between 1 and 5 stars.' }, { status: 400 });
    }
    if (!cleanComment || cleanComment.length < 10 || cleanComment.length > 1000) {
      return NextResponse.json({ message: 'Your review comment must be between 10 and 1000 characters.' }, { status: 400 });
    }

    // Explicitly strip any spoofed privilege fields
    const sanitizedInput = {
      customerName: cleanName,
      customerEmail,
      customerPhone,
      orderRef,
      productName,
      overallRating,
      tasteRating: payload.tasteRating,
      creaminessRating: payload.creaminessRating,
      coffeeIntensityRating: payload.coffeeIntensityRating,
      sweetnessRating: payload.sweetnessRating,
      textureRating: payload.textureRating,
      chocolateRating: payload.chocolateRating,
      presentationRating: payload.presentationRating,
      sweetnessPreference: payload.sweetnessPreference || null,
      coffeePreference: payload.coffeePreference || null,
      texturePreference: payload.texturePreference || null,
      feedbackTags: Array.isArray(payload.feedbackTags) ? payload.feedbackTags.map(t => String(t).replace(/<[^>]*>/g, '').trim()).filter(Boolean) : [],
      comment: cleanComment,
      recommendation: payload.recommendation || null
    };

    const result = hasDatabase()
      ? await createReviewPg(sanitizedInput)
      : createReview(sanitizedInput);
    if (result.error) {
      return NextResponse.json(
        { message: result.error, code: result.code, existingReviewId: result.existingReviewId },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: 'Thank you for your review! It is now awaiting moderation before publication.',
      reviewId: result.review.id,
      verificationStatus: result.verificationStatus,
      verificationReason: result.verificationReason,
      editToken: result.editToken
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/reviews error:', error);
    return NextResponse.json({ message: 'Failed to submit review. Please try again.' }, { status: 500 });
  }
}
