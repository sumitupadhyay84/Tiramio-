import { NextResponse } from 'next/server';

export async function GET() {
  const products = [
    {
      id: 'mini',
      name: 'Dear Misu Mini',
      price: 119,
      shortDescription: 'Your personal pause. Just enough to make the day sweeter.',
      badge: 'PERSONAL TREAT · SAVE ₹10',
      imageUrl: '/images/dearmisu-mini-card.webp'
    },
    {
      id: 'classic',
      name: 'Dear Misu Classic',
      price: 179,
      shortDescription: 'The just-right box for your favourite dessert moment.',
      badge: 'MOST LOVED · SAVE ₹11',
      imageUrl: '/images/dearmisu-classic-card.webp'
    },
    {
      id: 'share',
      name: 'Dear Misu Share Box',
      price: 229,
      shortDescription: 'More layers, more spoons, more reasons to gather.',
      badge: 'BEST VALUE · SAVE ₹21',
      imageUrl: '/images/dearmisu-share-card.webp'
    }
  ];

  return NextResponse.json({ products });
}

