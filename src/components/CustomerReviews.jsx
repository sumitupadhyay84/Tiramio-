'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Star, ThumbsUp, ChevronDown, ChevronLeft, ChevronRight,
  ArrowUpRight, Filter, ShieldCheck
} from 'lucide-react';

const api = process.env.NEXT_PUBLIC_API_URL || '';

const productFilters = [
  { value: '', label: 'All Products' },
  { value: 'Dear Misu Mini', label: 'Dear Misu Mini' },
  { value: 'Dear Misu Classic', label: 'Dear Misu Classic' },
  { value: 'Dear Misu Share Box', label: 'Dear Misu Share Box' },
];

const ratingFilters = [
  { value: '', label: 'All Ratings' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '2', label: '2 Stars' },
  { value: '1', label: '1 Star' },
];

const verificationFilters = [
  { value: '', label: 'All Purchases' },
  { value: 'VERIFIED_PURCHASE', label: 'Verified Purchases Only' },
];

const sortOptions = [
  { value: 'chronological', label: 'Earliest → Latest' },
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'highest', label: 'Highest Rated' },
  { value: 'lowest', label: 'Lowest Rated' },
  { value: 'helpful', label: 'Most Helpful' },
];

function getBrowserVoterId() {
  if (typeof window === 'undefined') return '';
  try {
    let vid = localStorage.getItem('dearmisu_voter_id');
    if (!vid) {
      vid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('dearmisu_voter_id', vid);
    }
    return vid;
  } catch {
    return '';
  }
}

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
  const [voteNotice, setVoteNotice] = useState('');
  const [showBadgeInfo, setShowBadgeInfo] = useState(false);

  const isVerifiedPurchase = review.purchase_verification_status === 'VERIFIED_PURCHASE';
  const wasEdited = Boolean(review.customer_edited);

  useEffect(() => {
    try {
      const votedIds = JSON.parse(localStorage.getItem('dearmisu_voted_reviews') || '[]');
      if (Array.isArray(votedIds) && votedIds.includes(review.id)) {
        setVoted(true);
      }
    } catch { /* ignore */ }
  }, [review.id]);

  const handleHelpful = async () => {
    if (voted) return;
    try {
      const voterId = getBrowserVoterId();
      const res = await fetch(`${api}/api/reviews/${review.id}/helpful`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(voterId ? { 'x-voter-id': voterId } : {})
        },
        body: JSON.stringify({ voterId })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.helpful) {
        setVoted(true);
        try {
          const votedIds = JSON.parse(localStorage.getItem('dearmisu_voted_reviews') || '[]');
          if (Array.isArray(votedIds) && !votedIds.includes(review.id)) {
            localStorage.setItem('dearmisu_voted_reviews', JSON.stringify([...votedIds, review.id]));
          }
        } catch { /* ignore */ }
        onHelpful(review.id, data.helpfulCount);
      } else if (res.status === 409 || data.duplicate) {
        setVoted(true);
        setVoteNotice('Already voted');
        if (typeof data.helpfulCount === 'number') {
          onHelpful(review.id, data.helpfulCount);
        }
      }
    } catch { /* silent */ }
  };

  return (
    <article className="rev-card">
      <header className="rev-card-header">
        <div className="rev-card-avatar" aria-hidden="true">{review.customer_name?.[0]?.toUpperCase() || '♡'}</div>
        <div className="rev-card-meta">
          <strong>{review.customer_name}</strong>
          <span className="rev-card-product">{review.product_name}</span>
        </div>
        <div className="rev-card-date-wrap">
          <time className="rev-card-date" dateTime={review.created_at}>
            {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </time>
          {wasEdited && <span className="rev-edited-tag">Edited</span>}
        </div>
      </header>

      <div className="rev-card-rating">
        <Stars rating={review.overall_rating} />
        {isVerifiedPurchase ? (
          <div className="rev-badge-wrap">
            <button
              type="button"
              className="rev-verified-badge-btn"
              onClick={() => setShowBadgeInfo(!showBadgeInfo)}
              onMouseEnter={() => setShowBadgeInfo(true)}
              onMouseLeave={() => setShowBadgeInfo(false)}
              title="This review is linked to a completed order for this product."
              aria-expanded={showBadgeInfo}
            >
              <ShieldCheck size={11} />
              <span>Verified Purchase</span>
            </button>
            {showBadgeInfo && (
              <div className="rev-badge-popover" role="tooltip">
                This review is linked to a completed order for this product.
              </div>
            )}
          </div>
        ) : (
          <span className="rev-customer-review-badge">Customer Review</span>
        )}
      </div>

      <p className="rev-card-comment">{review.comment}</p>

      {review.feedback_tags?.length > 0 && (
        <div className="rev-card-tags">
          {review.feedback_tags.map(tag => <span key={tag} className="rev-card-tag">{tag}</span>)}
        </div>
      )}

      {(review.taste_rating || review.creaminess_rating || review.coffee_intensity_rating || review.sweetness_rating || review.texture_rating || review.chocolate_rating || review.presentation_rating) && (
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

      <footer className="rev-card-footer">
        <button
          type="button"
          className={`rev-helpful-btn ${voted ? 'voted' : ''}`}
          onClick={handleHelpful}
          disabled={voted}
          aria-label={`Mark review by ${review.customer_name} as helpful`}
        >
          <ThumbsUp size={13} />
          <span>{voteNotice || 'Helpful'} {review.helpful_count > 0 && `(${review.helpful_count})`}</span>
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
  const [product, setProduct] = useState('');
  const [rating, setRating] = useState('');
  const [verification, setVerification] = useState('');
  const [sort, setSort] = useState('chronological'); // Default: Earliest -> Latest left-to-right (latest 10 reviews)
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const trackRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${api}/api/reviews/stats`);
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '10', sort });
      if (product) params.set('product', product);
      if (rating) params.set('rating', rating);
      if (verification) params.set('verification', verification);
      const res = await fetch(`${api}/api/reviews?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReviews((data.reviews || []).slice(0, 10));
        setTotal(data.total || 0);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [product, rating, verification, sort]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const checkScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);

    const firstItem = el.querySelector('.rev-slider-item');
    const cardStep = firstItem ? firstItem.getBoundingClientRect().width + 22 : 372;
    const idx = Math.min(
      Math.max(0, Math.round(scrollLeft / cardStep)),
      Math.max(0, reviews.length - 1)
    );
    setActiveIndex(idx);
  }, [reviews.length]);

  useEffect(() => {
    checkScroll();
    const rafId = requestAnimationFrame(checkScroll);
    const el = trackRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        cancelAnimationFrame(rafId);
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
    return () => cancelAnimationFrame(rafId);
  }, [checkScroll, reviews]);

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.scrollTo({ left: 0, behavior: 'auto' });
      setActiveIndex(0);
    }
  }, [product, rating, verification, sort]);

  const scrollPrev = () => {
    const el = trackRef.current;
    if (!el) return;
    const firstItem = el.querySelector('.rev-slider-item');
    const step = firstItem ? firstItem.getBoundingClientRect().width + 22 : 372;
    el.scrollBy({ left: -step, behavior: 'smooth' });
  };

  const scrollNext = () => {
    const el = trackRef.current;
    if (!el) return;
    const firstItem = el.querySelector('.rev-slider-item');
    const step = firstItem ? firstItem.getBoundingClientRect().width + 22 : 372;
    el.scrollBy({ left: step, behavior: 'smooth' });
  };

  const scrollToReview = (idx) => {
    const el = trackRef.current;
    if (!el) return;
    const items = el.querySelectorAll('.rev-slider-item');
    if (items[idx]) {
      items[idx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  };

  const handleHelpful = (id, updatedCount) => {
    setReviews(prev => prev.map(r => r.id === id
      ? { ...r, helpful_count: typeof updatedCount === 'number' ? updatedCount : (r.helpful_count || 0) + 1 }
      : r));
  };

  return (
    <section className="rev-section" id="reviews">
      <div className="rev-section-inner section-wrap">
        <div className="rev-heading">
          <div className="eyebrow left">CUSTOMER REVIEWS <span className="eyebrow-line" /></div>
          <h2>Real Experiences. Genuine Dessert Love.</h2>
          <p className="rev-heading-sub">Discover what our customers think about their Dear Misu experience.</p>
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
              <p className="rev-stats-total">
                Based on {stats.totalReviews} published customer review{stats.totalReviews !== 1 ? 's' : ''}
              </p>
              <p className="rev-stats-verified-count">
                <ShieldCheck size={13} />
                <span>{stats.verifiedPurchaseCount || 0} verified purchase{(stats.verifiedPurchaseCount || 0) === 1 ? '' : 's'}</span>
              </p>
              {stats.recommendationPercentage !== null && stats.recommendationResponseCount > 0 && (
                <p className="rev-stats-rec">
                  ♡ {stats.recommendationPercentage}% would recommend ({stats.recommendationResponseCount} response{stats.recommendationResponseCount !== 1 ? 's' : ''})
                </p>
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
            <p className="rev-empty-text">Be the first to share your Dear Misu experience ♡</p>
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

        {/* Filters, Sort & Cards */}
        {stats && stats.totalReviews > 0 && (
          <>
            <div className="rev-toolbar">
              <div className="rev-toolbar-left">
                <button
                  type="button"
                  className="rev-filter-toggle"
                  onClick={() => setShowFilters(!showFilters)}
                  aria-expanded={showFilters}
                >
                  <Filter size={14} /> Filter &amp; Sort <ChevronDown size={14} className={showFilters ? 'rev-chevron-up' : ''} />
                </button>
                <select
                  className="rev-inline-sort"
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                  aria-label="Sort customer reviews"
                >
                  {sortOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
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
                <select value={verification} onChange={e => setVerification(e.target.value)} aria-label="Filter by purchase verification">
                  {verificationFilters.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            )}

            <div className="rev-slider-container">
              <div className="rev-slider-top-bar">
                <div className="rev-queue-status">
                  <span className="rev-public-subnote">
                    Customer experiences
                  </span>
                </div>
                <div className="rev-nav-controls">
                  <button
                    type="button"
                    className="rev-nav-arrow"
                    onClick={scrollPrev}
                    disabled={!canScrollLeft}
                    aria-label="Previous customer reviews"
                    title="Previous reviews"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    className="rev-nav-arrow"
                    onClick={scrollNext}
                    disabled={!canScrollRight}
                    aria-label="Next customer reviews"
                    title="Next reviews"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div className="rev-slider-viewport">
                <div
                  ref={trackRef}
                  className="rev-slider-track"
                  tabIndex={0}
                  role="region"
                  aria-label="Customer Reviews Carousel"
                >
                  {loading ? (
                    [1, 2, 3].map(i => (
                      <div key={i} className="rev-slider-item">
                        <div className="rev-skeleton-card" />
                      </div>
                    ))
                  ) : reviews.length === 0 ? (
                    <p className="rev-no-results">No published reviews match your selected filters.</p>
                  ) : (
                    reviews.map((review, idx) => (
                      <div key={review.id} className="rev-slider-item" data-index={idx}>
                        <ReviewCard review={review} onHelpful={handleHelpful} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {reviews.length > 1 && (
                <div className="rev-slider-footer">
                  <div className="rev-slider-dots">
                    {reviews.map((r, idx) => (
                      <button
                        key={r.id}
                        type="button"
                        className={`rev-slider-dot ${idx === activeIndex ? 'active' : ''}`}
                        onClick={() => scrollToReview(idx)}
                        aria-label={`View review ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}


      </div>
    </section>
  );
}
