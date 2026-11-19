import { NextResponse } from 'next/server';

export async function GET() {
  const products = [
    {
      id: 'mini',
      name: 'Dear Misu Mini',
      weightGrams: 100,
      price: 69,
      shortDescription: 'Your personal pause. Just enough to make the day sweeter.',
      badge: 'PERSONAL TREAT · SAVE ₹10',
      imageUrl: '/images/dearmisu-mini-card.webp'
    },
    {
      id: 'classic',
      name: 'Dear Misu Classic',
      weightGrams: 200,
      price: 129,
      shortDescription: 'The just-right box for your favourite dessert moment.',
      badge: 'MOST LOVED · SAVE ₹11',
      imageUrl: '/images/dearmisu-classic-card.webp'
    },
    {
      id: 'share',
      name: 'Dear Misu Share Box',
      weightGrams: 300,
      price: 189,
      shortDescription: 'More layers, more spoons, more reasons to gather.',
      badge: 'BEST VALUE · SAVE ₹21',
      imageUrl: '/images/dearmisu-share-card.webp'
    }
  ];

  return NextResponse.json({ products });
}

