'use client';

import { useEffect, useState, useCallback } from 'react';
import { Star, ThumbsUp, ChevronDown, Camera, ArrowUpRight, Filter } from 'lucide-react';

const api = process.env.NEXT_PUBLIC_API_URL || '';

const productFilters = [
  { value: '', label: 'All Products' },
  { value: 'Dear Misu Mini (100g)', label: 'Dear Misu Mini' },
  { value: 'Dear Misu Classic (200g)', label: 'Dear Misu Classic' },
  { value: 'Dear Misu Share Box (300g)', label: 'Dear Misu Share Box' },
];

const ratingFilters = [
  { value: '', label: 'All Ratings' },
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★' },
  { value: '3', label: '★★★' },
  { value: '2', label: '★★' },
  { value: '1', label: '★' },
];

const sortOptions = [
  { value: 'oldest', label: 'Date: Earliest First' },
  { value: 'newest', label: 'Date: Most Recent' },
  { value: 'highest', label: 'Highest Rated' },
  { value: 'lowest', label: 'Lowest Rated' },
  { value: 'helpful', label: 'Most Helpful' },
];

function Stars({ rating, size = 14 }) {
  return (
    <span className="rev-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={size} fill={s <= rating ? '#d4a35e' : 'none'} stroke={s <= rating ? '#d4a35e' : '#d8c8b0'} strokeWidth={1.5} />
      ))}
    </span>
  );
}

function ReviewCard({ review, onHelpful }) {
  const [voted, setVoted] = useState(false);

  const handleHelpful = async () => {
    if (voted) return;
    try {
      const res = await fetch(`${api}/api/reviews/${review.id}/helpful`, { method: 'POST' });
      const data = await res.json();
      if (data.helpful) setVoted(true);
      onHelpful(review.id);
    } catch { /* silent */ }
  };

  return (
    <article className="rev-card">
      <header className="rev-card-header">
        <div className="rev-card-avatar">{review.customer_name?.[0]?.toUpperCase() || '♡'}</div>
        <div className="rev-card-meta">
          <strong>{review.customer_name}</strong>
          <span className="rev-card-product">{review.product_name}</span>
        </div>
        <time className="rev-card-date">{new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</time>
      </header>

      <div className="rev-card-rating">
        <Stars rating={review.overall_rating} />
        {review.verified_purchase && <span className="rev-verified-badge">✓ Verified</span>}
      </div>

      <p className="rev-card-comment">{review.comment}</p>

      {review.feedback_tags?.length > 0 && (
        <div className="rev-card-tags">
          {review.feedback_tags.map(tag => <span key={tag} className="rev-card-tag">{tag}</span>)}
        </div>
      )}

      {/* Taste detail ratings */}
      {(review.taste_rating || review.creaminess_rating || review.coffee_intensity_rating) && (
        <div className="rev-card-taste">
          {[
            { key: 'taste_rating', label: 'Taste' },
            { key: 'creaminess_rating', label: 'Creaminess' },
            { key: 'coffee_intensity_rating', label: 'Coffee' },
            { key: 'sweetness_rating', label: 'Sweetness' },
            { key: 'texture_rating', label: 'Texture' },
            { key: 'chocolate_rating', label: 'Chocolate' },
            { key: 'presentation_rating', label: 'Presentation' },
          ].filter(({ key }) => review[key]).map(({ key, label }) => (
            <div key={key} className="rev-taste-mini">
              <span>{label}</span>
              <Stars rating={review[key]} size={10} />
            </div>
          ))}
        </div>
      )}

      {review.customer_image_url && (
        <div className="rev-card-image">
          <img src={`${api}${review.customer_image_url}`} alt={`Photo by ${review.customer_name}`} loading="lazy" />
        </div>
      )}

      <footer className="rev-card-footer">
        <button className={`rev-helpful-btn ${voted ? 'voted' : ''}`} onClick={handleHelpful} disabled={voted}>
          <ThumbsUp size={13} /> Helpful {review.helpful_count > 0 && `(${review.helpful_count})`}
        </button>
        {review.recommendation === 'Definitely!' && (
          <span className="rev-rec-badge">♡ Recommends</span>
        )}
      </footer>
    </article>
  );
}

function RatingBar({ star, count = 0, total = 0, percentage }) {
  const countVal = typeof count === 'object' && count !== null ? (count.count ?? 0) : (Number(count) || 0);
  const pct = percentage !== undefined
    ? percentage
    : (typeof count === 'object' && count !== null && count.percentage !== undefined
        ? count.percentage
        : (total > 0 ? (countVal / total) * 100 : 0));
  return (
    <div className="rev-dist-row">
      <span className="rev-dist-label">{star}★</span>
      <div className="rev-dist-bar"><div className="rev-dist-fill" style={{ width: `${pct}%` }} /></div>
      <span className="rev-dist-count">{countVal}</span>
    </div>
  );
}

export default function CustomerReviews() {
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [product, setProduct] = useState('');
  const [rating, setRating] = useState('');
  const [sort, setSort] = useState('oldest');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [galleryImage, setGalleryImage] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${api}/api/reviews/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchReviews = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 6, sort });
      if (product) params.set('product', product);
      if (rating) params.set('rating', rating);
      const res = await fetch(`${api}/api/reviews?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (p === 1) setReviews(data.reviews);
        else setReviews(prev => [...prev, ...data.reviews]);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [product, rating, sort]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchReviews(1); }, [fetchReviews]);

  const handleHelpful = (id) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, helpful_count: (r.helpful_count || 0) + 1 } : r));
  };

  const customerPhotos = reviews.filter(r => r.customer_image_url);

  return (
    <section className="rev-section" id="reviews">
      <div className="rev-section-inner section-wrap">
        <div className="rev-heading">
          <div className="eyebrow left">CUSTOMER LOVE <span className="eyebrow-line" /></div>
          <h2>A little love from our customers ♡</h2>
          <p className="rev-heading-sub">Every spoonful tells a story. Share yours with us.</p>
          <p className="rev-heading-note">Real moments. Real reviews. Made with love.</p>
        </div>

        {/* Stats Summary */}
        {stats && stats.totalReviews > 0 ? (
          <div className="rev-stats">
            <div className="rev-stats-main">
              <div className="rev-stats-score">
                <span className="rev-big-rating">{Number(stats.averageRating).toFixed(1)}</span>
                <span className="rev-out-of">/ 5</span>
              </div>
              <Stars rating={Math.round(stats.averageRating)} size={22} />
              <p className="rev-stats-total">Based on {stats.totalReviews} customer review{stats.totalReviews !== 1 ? 's' : ''}</p>
              {stats.recommendationPercentage > 0 && (
                <p className="rev-stats-rec">♡ {stats.recommendationPercentage}% would recommend</p>
              )}
            </div>
            <div className="rev-stats-dist">
              {[5, 4, 3, 2, 1].map(s => {
                const item = stats.distribution?.[s];
                const count = typeof item === 'object' && item !== null ? (item.count ?? 0) : (item || 0);
                const percentage = typeof item === 'object' && item !== null ? item.percentage : undefined;
                return (
                  <RatingBar key={s} star={s} count={count} total={stats.totalReviews} percentage={percentage} />
                );
              })}
            </div>
          </div>
        ) : !loading ? (
          <div className="rev-empty-state">
            <p className="rev-empty-text">Be the first to share your Dear Misu moment ♡</p>
            <a href="/review" className="rev-write-cta">
              Write a Review <ArrowUpRight size={15} />
            </a>
          </div>
        ) : (
          <div className="rev-skeleton-stats">
            <div className="rev-skeleton-block" style={{ width: '120px', height: '60px' }} />
            <div className="rev-skeleton-block" style={{ width: '200px', height: '80px' }} />
          </div>
        )}

        {/* Customer Photo Gallery */}
        {customerPhotos.length > 0 && (
          <div className="rev-gallery">
            <h3 className="rev-gallery-title"><Camera size={16} /> Customer moments</h3>
            <div className="rev-gallery-grid">
              {customerPhotos.slice(0, 6).map(r => (
                <button key={r.id} className="rev-gallery-item" onClick={() => setGalleryImage(r)}>
                  <img src={`${api}${r.customer_image_url}`} alt={`Photo by ${r.customer_name}`} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Gallery Modal */}
        {galleryImage && (
          <div className="rev-gallery-modal" onClick={() => setGalleryImage(null)}>
            <div className="rev-gallery-modal-content" onClick={e => e.stopPropagation()}>
              <button className="rev-gallery-close" onClick={() => setGalleryImage(null)}>✕</button>
              <img src={`${api}${galleryImage.customer_image_url}`} alt={`Photo by ${galleryImage.customer_name}`} />
              <div className="rev-gallery-info">
                <strong>{galleryImage.customer_name}</strong>
                <Stars rating={galleryImage.overall_rating} size={14} />
                <p>{galleryImage.comment}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters & Sort */}
        {stats && stats.totalReviews > 0 && (
          <>
            <div className="rev-toolbar">
              <button className="rev-filter-toggle" onClick={() => setShowFilters(!showFilters)}>
                <Filter size={14} /> Filter & Sort <ChevronDown size={14} className={showFilters ? 'rev-chevron-up' : ''} />
              </button>
              <a href="/review" className="rev-write-cta">
                Write a Review <ArrowUpRight size={15} />
              </a>
            </div>

            {showFilters && (
              <div className="rev-filters">
                <select value={product} onChange={e => setProduct(e.target.value)} aria-label="Filter by product">
                  {productFilters.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={rating} onChange={e => setRating(e.target.value)} aria-label="Filter by rating">
                  {ratingFilters.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort reviews">
                  {sortOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            )}

            {/* Review Cards */}
            <div className="rev-grid">
              {reviews.map(review => (
                <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
              ))}
            </div>

            {loading && (
              <div className="rev-loading">
                {[1, 2, 3].map(i => <div key={i} className="rev-skeleton-card" />)}
              </div>
            )}

            {!loading && reviews.length === 0 && (
              <p className="rev-no-results">No reviews match your filters. Try adjusting your selection.</p>
            )}

            {page < totalPages && !loading && (
              <div className="rev-load-more">
                <button className="rev-load-more-btn" onClick={() => fetchReviews(page + 1)}>
                  Load More Reviews <ChevronDown size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

