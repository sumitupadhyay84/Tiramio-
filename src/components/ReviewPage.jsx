'use client';

import Link from 'next/link';
import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Star, Heart, ArrowUpRight, CheckCircle2, Sparkles,
  AlertCircle, ArrowLeft, Check, Coffee, Package, Lock,
  CakeSlice, ChevronDown, ChevronUp, User, Mail, Phone, Receipt, Copy, ShieldCheck
} from 'lucide-react';

const api = process.env.NEXT_PUBLIC_API_URL || '';

const productOptions = [
  {
    id: 'Dear Misu Mini',
    name: 'Dear Misu Mini',
    price: '₹119',
    tag: 'Personal Treat',
    image: '/images/dearmisu-mini-card.webp'
  },
  {
    id: 'Dear Misu Classic',
    name: 'Dear Misu Classic',
    price: '₹179',
    tag: 'Most Loved',
    image: '/images/dearmisu-classic-card.webp',
    featured: true
  },
  {
    id: 'Dear Misu Share Box',
    name: 'Dear Misu Share Box',
    price: '₹229',
    tag: 'Best Value',
    image: '/images/dearmisu-share-card.webp'
  }
];

const tasteCategories = [
  { key: 'tasteRating', label: 'Taste', hint: 'Harmony of ingredients' },
  { key: 'coffeeIntensityRating', label: 'Coffee Flavour', hint: 'Espresso soak balance' },
  { key: 'creaminessRating', label: 'Creaminess', hint: 'Silky mascarpone blend' },
  { key: 'sweetnessRating', label: 'Sweetness', hint: 'Sugar level balance' },
  { key: 'textureRating', label: 'Texture', hint: 'Cloud-soft sponge layers' },
  { key: 'chocolateRating', label: 'Chocolate', hint: 'Dusted cocoa finish' },
  { key: 'presentationRating', label: 'Presentation', hint: 'Visual craft & packaging' },
];

const feedbackTagOptions = [
  { text: 'Perfectly creamy', icon: Sparkles },
  { text: 'Rich coffee flavour', icon: Coffee },
  { text: 'Just the right sweetness', icon: Heart },
  { text: 'Soft and fluffy layers', icon: CakeSlice },
  { text: 'Loved the chocolate finish', icon: Sparkles },
  { text: 'Beautiful presentation', icon: Heart },
  { text: 'Perfect portion size', icon: Package },
  { text: 'Worth every spoonful', icon: Heart },
  { text: 'Fresh and delicious', icon: Sparkles },
  { text: 'Absolutely loved it', icon: Heart },
];

const ratingSentiments = [
  { label: 'Tap a star to rate', emoji: '✨', desc: 'How did every layer feel to you?' },
  { label: 'Not for me', emoji: '☕', desc: 'We appreciate your honest feedback.' },
  { label: 'Could be better', emoji: '🥄', desc: 'Tell us how we can improve our recipe.' },
  { label: 'Good & enjoyable', emoji: '🍰', desc: 'A lovely little sweet pause.' },
  { label: 'Loved every bite!', emoji: '♥', desc: 'So glad you enjoyed your box.' },
  { label: 'Pure bliss! Absolutely divine!', emoji: '✨', desc: 'The true Dear Misu experience!' }
];

function InteractiveStars({ value, onChange, size = 40, label = 'Overall rating' }) {
  const [hover, setHover] = useState(0);
  const activeRating = hover || value;

  return (
    <div className="rev-stars-container" role="radiogroup" aria-label={label}>
      <div className="rev-stars-interactive">
        {[1, 2, 3, 4, 5].map(star => {
          const isFilled = star <= activeRating;
          return (
            <button
              key={star}
              type="button"
              className={`rev-star-touch-btn ${isFilled ? 'is-filled' : ''} ${star <= value ? 'is-selected' : ''}`}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onKeyDown={e => {
                if (e.key === 'ArrowRight' && star < 5) onChange(star + 1);
                if (e.key === 'ArrowLeft' && star > 1) onChange(star - 1);
              }}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              aria-checked={star === value}
              role="radio"
              tabIndex={star === value || (!value && star === 1) ? 0 : -1}
            >
              <Star
                size={size}
                fill={isFilled ? '#c6a36a' : 'none'}
                stroke={isFilled ? '#c6a36a' : '#d1c0a8'}
                strokeWidth={1.8}
                className={`rev-star-svg ${isFilled ? 'star-pop' : ''}`}
              />
            </button>
          );
        })}
      </div>
      <div className="rev-stars-sentiment-badge">
        <span className="sentiment-emoji">{ratingSentiments[activeRating]?.emoji}</span>
        <strong>{ratingSentiments[activeRating]?.label}</strong>
        <small>{ratingSentiments[activeRating]?.desc}</small>
      </div>
    </div>
  );
}

function MiniStars({ value, onChange, label }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="rev-mini-stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          className="rev-mini-star-btn"
          onClick={() => onChange(value === s ? 0 : s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${s} stars`}
        >
          <Star
            size={18}
            fill={s <= active ? '#c6a36a' : 'none'}
            stroke={s <= active ? '#c6a36a' : '#c9b99a'}
            strokeWidth={1.6}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewFormInner() {
  const searchParams = useSearchParams();
  const editReviewId = searchParams.get('edit') || '';
  const editToken = searchParams.get('token') || '';
  const isEditMode = Boolean(editReviewId && editToken);

  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    orderRef: '',
    productName: '',
    overallRating: 0,
    tasteRating: 0,
    creaminessRating: 0,
    coffeeIntensityRating: 0,
    sweetnessRating: 0,
    textureRating: 0,
    chocolateRating: 0,
    presentationRating: 0,
    sweetnessPreference: '',
    coffeePreference: '',
    texturePreference: '',
    feedbackTags: [],
    comment: '',
    recommendation: '', // Never pre-select Yes so stats stay genuine
  });

  const [loadingExisting, setLoadingExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [copiedEditLink, setCopiedEditLink] = useState(false);
  const [showTasteDetail, setShowTasteDetail] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!isEditMode) return;
    setLoadingExisting(true);
    fetch(`${api}/api/reviews/${encodeURIComponent(editReviewId)}?token=${encodeURIComponent(editToken)}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.review) throw new Error(data.message || 'Unable to load your review for editing.');
        const r = data.review;
        setForm({
          customerName: r.customer_name || '',
          customerEmail: '',
          customerPhone: '',
          orderRef: '',
          productName: r.product_name || '',
          overallRating: r.overall_rating || 0,
          tasteRating: r.taste_rating || 0,
          creaminessRating: r.creaminess_rating || 0,
          coffeeIntensityRating: r.coffee_intensity_rating || 0,
          sweetnessRating: r.sweetness_rating || 0,
          textureRating: r.texture_rating || 0,
          chocolateRating: r.chocolate_rating || 0,
          presentationRating: r.presentation_rating || 0,
          sweetnessPreference: r.sweetness_preference || '',
          coffeePreference: r.coffee_preference || '',
          texturePreference: r.texture_preference || '',
          feedbackTags: Array.isArray(r.feedback_tags) ? r.feedback_tags : [],
          comment: r.comment || '',
          recommendation: r.recommendation || '',
        });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingExisting(false));
  }, [isEditMode, editReviewId, editToken]);

  const updateField = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [fieldErrors]);

  const toggleTag = useCallback(tag => {
    setForm(prev => ({
      ...prev,
      feedbackTags: prev.feedbackTags.includes(tag)
        ? prev.feedbackTags.filter(t => t !== tag)
        : prev.feedbackTags.length < 10 ? [...prev.feedbackTags, tag] : prev.feedbackTags
    }));
  }, []);

  const validate = () => {
    const errs = {};
    if (!form.customerName.trim() || form.customerName.trim().length < 2) {
      errs.customerName = 'Please enter your display name (at least 2 characters).';
    }
    if (!form.productName) {
      errs.productName = 'Please select which Dear Misu box you enjoyed.';
    }
    if (!form.overallRating) {
      errs.overallRating = 'Please tap a star to give your overall rating.';
    }
    if (!form.comment.trim() || form.comment.trim().length < 10) {
      errs.comment = 'Please share a few words about your experience (minimum 10 characters).';
    }
    if (form.comment.length > 1000) {
      errs.comment = 'Your review exceeds the 1000 character limit.';
    }
    if (form.customerPhone && !/^[6-9]\d{9}$/.test(form.customerPhone)) {
      errs.customerPhone = 'If providing a mobile number, enter a valid 10-digit number.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) {
      setError('Please check the highlighted fields above.');
      const firstError = document.querySelector('.rev-error-anchor');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail ? form.customerEmail.trim() : null,
        customerPhone: form.customerPhone ? form.customerPhone.trim() : null,
        orderRef: form.orderRef ? form.orderRef.trim().toUpperCase() : null,
        productName: form.productName,
        overallRating: Number(form.overallRating),
        sweetnessPreference: form.sweetnessPreference || null,
        coffeePreference: form.coffeePreference || null,
        texturePreference: form.texturePreference || null,
        feedbackTags: form.feedbackTags || [],
        comment: form.comment.trim(),
        recommendation: form.recommendation || null,
        honeypot: ''
      };

      // Only send category ratings explicitly set by the customer
      tasteCategories.forEach(({ key }) => {
        if (form[key]) payload[key] = Number(form[key]);
      });

      const url = isEditMode
        ? `${api}/api/reviews/${encodeURIComponent(editReviewId)}`
        : `${api}/api/reviews`;
      const method = isEditMode ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(isEditMode ? { 'x-review-edit-token': editToken } : {})
        },
        body: JSON.stringify(isEditMode ? { ...payload, editToken } : payload)
      });

      const responseText = await res.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        const errorMsg = data.message || (responseText && !responseText.startsWith('<') ? responseText : `Server error (${res.status}). Please try again.`);
        throw new Error(errorMsg);
      }

      setSubmitResult({
        isEdit: isEditMode,
        reviewId: data.reviewId || editReviewId,
        editToken: data.editToken || editToken,
        verificationStatus: data.verificationStatus || null,
        verificationReason: data.verificationReason || null,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Could not connect to the review server. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="rev-page-root">
        <div className="rev-page-wrap">
          <div className="rev-success-card">
            <p>Loading your review for editing...</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitResult) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const editUrl = submitResult.reviewId && submitResult.editToken
      ? `${origin}/review?edit=${encodeURIComponent(submitResult.reviewId)}&token=${encodeURIComponent(submitResult.editToken)}`
      : '';

    return (
      <div className="rev-page-root">
        <div className="rev-page-wrap">
          <div className="rev-success-card">
            <div className="rev-success-glow" aria-hidden="true" />
            <div className="rev-success-badge">
              <CheckCircle2 size={46} strokeWidth={2} />
            </div>
            <span className="rev-success-eyebrow">♡ THANK YOU FOR SHARING</span>
            <h2>
              {submitResult.isEdit
                ? 'Your review update has been received!'
                : 'Thank you for sharing your Dear Misu experience!'}
            </h2>
            <p className="rev-success-message">
              Your review has been submitted and will undergo brief moderation before publication on our website. Your original opinions and ratings are never altered.
            </p>

            {submitResult.verificationStatus && (
              <div className="rev-success-status-pill">
                <ShieldCheck size={14} />
                <span>Purchase Status:</span>{' '}
                <b>
                  {submitResult.verificationStatus === 'VERIFIED_PURCHASE'
                    ? 'Verified Purchase (Matched to Delivered Order)'
                    : 'Customer Review (Unverified Purchase)'}
                </b>
              </div>
            )}

            {editUrl && (
              <div className="rev-edit-link-box">
                <p>Save this private link if you ever wish to update your own review:</p>
                <div className="rev-edit-link-row">
                  <input type="text" readOnly value={editUrl} aria-label="Private review edit link" />
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard?.writeText(editUrl);
                      setCopiedEditLink(true);
                      setTimeout(() => setCopiedEditLink(false), 2500);
                    }}
                  >
                    {copiedEditLink ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                  </button>
                </div>
              </div>
            )}

            <div className="rev-success-actions">
              <Link href="/#reviews" className="button button-dark rev-action-btn">
                Back to Dear Misu <ArrowUpRight size={16} />
              </Link>
              <a href="/review-policy" className="button button-light rev-action-btn">
                Read Review Policy <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rev-page-root">
      <nav className="rev-top-nav">
        <Link href="/" className="rev-nav-back">
          <ArrowLeft size={16} /> <span>Back to Dear Misu</span>
        </Link>
        <Link href="/" className="rev-nav-brand">
          <img src="/images/dear-misu-badge.webp" alt="Dear Misu" width={34} height={34} />
          <strong>Dear Misu</strong>
        </Link>
        <a href="/review-policy" className="rev-nav-tag" style={{ textDecoration: 'none' }}>Review Policy</a>
      </nav>

      <div className="rev-page-wrap">
        <header className="rev-hero-card">
          <div className="rev-hero-corner-sparkle">✦</div>
          <div className="rev-hero-eyebrow">
            <span className="rev-eyebrow-pip" />
            <span>{isEditMode ? 'UPDATE YOUR FEEDBACK' : 'AUTHENTIC CUSTOMER FEEDBACK'}</span>
            <span className="rev-eyebrow-pip" />
          </div>
          <h1>
            {isEditMode ? <>Edit your <em>review</em></> : <>Enjoyed every <em>spoonful?</em></>}
          </h1>
          <p className="rev-hero-sub">
            {isEditMode
              ? 'Update your genuine thoughts below. Previous versions remain safely logged for transparency.'
              : 'Share your honest experience. Reviews are moderated only for spam and personal safety — never altered.'}
          </p>

          <div className="rev-hero-badges-row">
            <div className="rev-mini-badge">
              <Sparkles size={12} />
              <span>Honest &amp; Unaltered</span>
            </div>
            <div className="rev-mini-badge">
              <ShieldCheck size={12} />
              <span>Order Verification Optional</span>
            </div>
            <div className="rev-mini-badge">
              <Lock size={12} />
              <span>Private Details Protected</span>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="rev-form-container" noValidate>
          <div style={{ position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true">
            <input name="honeypot" tabIndex={-1} autoComplete="off" />
          </div>

          {/* STEP 1: PRODUCT */}
          <section className={`rev-step-card ${fieldErrors.productName ? 'rev-error-anchor' : ''}`}>
            <div className="rev-step-header">
              <span className="rev-step-number">01</span>
              <div>
                <h3>Which Dear Misu did you have? *</h3>
                <p>{isEditMode ? 'Product reviewed' : 'Tap your box to select'}</p>
              </div>
            </div>

            <div className="rev-products-grid">
              {productOptions.map(prod => {
                const isSelected = form.productName === prod.id;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    disabled={isEditMode}
                    className={`rev-product-pill-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => updateField('productName', prod.id)}
                  >
                    <div className="rev-product-thumb-wrap">
                      <img src={prod.image} alt={prod.name} width={80} height={80} />
                      {isSelected && (
                        <div className="rev-selected-check">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <div className="rev-product-card-copy">
                      <span className="rev-card-tagline">{prod.tag}</span>
                      <strong>{prod.name}</strong>
                      <span className="rev-card-weight">{prod.price}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {fieldErrors.productName && (
              <div className="rev-validation-note">
                <AlertCircle size={14} /> <span>{fieldErrors.productName}</span>
              </div>
            )}
          </section>

          {/* STEP 2: OVERALL RATING */}
          <section className={`rev-step-card ${fieldErrors.overallRating ? 'rev-error-anchor' : ''}`}>
            <div className="rev-step-header">
              <span className="rev-step-number">02</span>
              <div>
                <h3>Your overall rating *</h3>
                <p>Give your honest rating from 1 to 5 stars</p>
              </div>
            </div>

            <InteractiveStars
              value={form.overallRating}
              onChange={v => updateField('overallRating', v)}
              size={42}
            />

            {fieldErrors.overallRating && (
              <div className="rev-validation-note">
                <AlertCircle size={14} /> <span>{fieldErrors.overallRating}</span>
              </div>
            )}
          </section>

          {/* STEP 3: QUICK FEEDBACK TAGS */}
          <section className="rev-step-card">
            <div className="rev-step-header">
              <span className="rev-step-number">03</span>
              <div>
                <h3>What stood out most?</h3>
                <p>Tap any highlights that match your experience (optional)</p>
              </div>
            </div>

            <div className="rev-tags-cloud">
              {feedbackTagOptions.map(({ text, icon: Icon }) => {
                const isChecked = form.feedbackTags.includes(text);
                return (
                  <button
                    key={text}
                    type="button"
                    className={`rev-interactive-tag ${isChecked ? 'is-checked' : ''}`}
                    onClick={() => toggleTag(text)}
                  >
                    <Icon size={13} className="tag-icon" />
                    <span>{text}</span>
                    {isChecked && <Check size={12} className="tag-check-icon" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 4: WRITTEN EXPERIENCE */}
          <section className={`rev-step-card ${fieldErrors.comment ? 'rev-error-anchor' : ''}`}>
            <div className="rev-step-header">
              <span className="rev-step-number">04</span>
              <div>
                <h3>Tell us about your experience *</h3>
                <p>Your original feedback is published exactly as written</p>
              </div>
            </div>

            <div className="rev-textarea-wrap">
              <textarea
                rows={4}
                required
                minLength={10}
                maxLength={1000}
                value={form.comment}
                onChange={e => updateField('comment', e.target.value)}
                placeholder="Share your honest thoughts on taste, creaminess, coffee balance, packaging, or delivery..."
                className={fieldErrors.comment ? 'rev-input-has-error' : ''}
              />
              <div className="rev-counter-row">
                <span className="counter-guide">Min 10 characters</span>
                <span className={`counter-number ${form.comment.length > 950 ? 'counter-warn' : ''}`}>
                  {form.comment.length} / 1000
                </span>
              </div>
            </div>

            {fieldErrors.comment && (
              <div className="rev-validation-note">
                <AlertCircle size={14} /> <span>{fieldErrors.comment}</span>
              </div>
            )}
          </section>

          {/* STEP 5: OPTIONAL CATEGORY RATINGS */}
          <section className="rev-step-card rev-expandable-section">
            <button
              type="button"
              className="rev-taste-toggle-header"
              onClick={() => setShowTasteDetail(!showTasteDetail)}
            >
              <div className="rev-taste-toggle-copy">
                <span className="rev-step-number">05</span>
                <div>
                  <div className="rev-toggle-title-line">
                    <h3>Category Ratings</h3>
                    <span className="rev-optional-chip">Optional</span>
                  </div>
                  <p>Rate taste, coffee flavour, creaminess, sweetness &amp; more individually</p>
                </div>
              </div>
              <div className="rev-toggle-chevron">
                {showTasteDetail ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>

            {showTasteDetail && (
              <div className="rev-taste-expanded-body">
                <div className="rev-taste-matrix">
                  {tasteCategories.map(({ key, label, hint }) => (
                    <div key={key} className="rev-taste-matrix-row">
                      <div className="rev-taste-row-meta">
                        <strong>{label}</strong>
                        <small>{hint}</small>
                      </div>
                      <MiniStars
                        value={form[key]}
                        onChange={v => updateField(key, v)}
                        label={label}
                      />
                    </div>
                  ))}
                </div>

                <div className="rev-preferences-box">
                  <div className="rev-pref-category">
                    <span className="pref-category-title">Sweetness Balance</span>
                    <div className="pref-pills-row">
                      {['Too sweet', 'Just right', 'Less sweet'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`pref-pill-btn ${form.sweetnessPreference === opt ? 'active' : ''}`}
                          onClick={() => updateField('sweetnessPreference', form.sweetnessPreference === opt ? '' : opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rev-pref-category">
                    <span className="pref-category-title">Coffee Intensity</span>
                    <div className="pref-pills-row">
                      {['Mild', 'Balanced', 'Strong'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`pref-pill-btn ${form.coffeePreference === opt ? 'active' : ''}`}
                          onClick={() => updateField('coffeePreference', form.coffeePreference === opt ? '' : opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rev-pref-category">
                    <span className="pref-category-title">Texture Feel</span>
                    <div className="pref-pills-row">
                      {['Extra creamy', 'Soft and fluffy', 'Rich and layered', 'Perfectly balanced'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`pref-pill-btn ${form.texturePreference === opt ? 'active' : ''}`}
                          onClick={() => updateField('texturePreference', form.texturePreference === opt ? '' : opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STEP 6: OPTIONAL RECOMMENDATION */}
          <section className="rev-step-card">
            <div className="rev-step-header">
              <span className="rev-step-number">06</span>
              <div>
                <div className="rev-toggle-title-line">
                  <h3>Would you recommend Dear Misu to friends?</h3>
                  <span className="rev-optional-chip">Optional</span>
                </div>
                <p>Tap an option if you&apos;d like to include your recommendation</p>
              </div>
            </div>

            <div className="rev-rec-buttons-grid">
              {[
                { value: 'Definitely!', label: 'Definitely! ♡', desc: 'A must-try treat' },
                { value: 'Maybe', label: 'Maybe', desc: 'Good, personal taste varies' },
                { value: 'Not this time', label: 'Not this time', desc: 'Not for me' }
              ].map(opt => {
                const isSelected = form.recommendation === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rev-rec-choice-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => updateField('recommendation', isSelected ? '' : opt.value)}
                  >
                    <strong>{opt.label}</strong>
                    <small>{opt.desc}</small>
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 7: DISPLAY NAME & OPTIONAL PURCHASE VERIFICATION */}
          <section className={`rev-step-card ${fieldErrors.customerName || fieldErrors.customerPhone ? 'rev-error-anchor' : ''}`}>
            <div className="rev-step-header">
              <span className="rev-step-number">07</span>
              <div>
                <h3>Your Display Name &amp; Purchase Verification</h3>
                <p>Choose how your name appears publicly; optionally verify your completed order</p>
              </div>
            </div>

            <div className="rev-inputs-stack">
              <div className="rev-input-group">
                <label htmlFor="rev-cust-name">
                  <User size={14} /> <span>Public Display Name *</span>
                </label>
                <input
                  id="rev-cust-name"
                  type="text"
                  required
                  maxLength={80}
                  value={form.customerName}
                  onChange={e => updateField('customerName', e.target.value)}
                  placeholder="e.g. Ananya S. or Rahul"
                  className={fieldErrors.customerName ? 'rev-input-has-error' : ''}
                />
                <small style={{ color: '#8c7362', fontSize: '11px' }}>
                  Displayed publicly on your review card. You may use your first name or initials.
                </small>
                {fieldErrors.customerName && (
                  <span className="rev-field-error-text">{fieldErrors.customerName}</span>
                )}
              </div>

              {!isEditMode && (
                <>
                  <div className="rev-input-group">
                    <label htmlFor="rev-order-ref">
                      <Receipt size={14} /> <span>Order Reference <small>(Optional — for Verified Purchase badge)</small></span>
                    </label>
                    <input
                      id="rev-order-ref"
                      type="text"
                      maxLength={32}
                      value={form.orderRef}
                      onChange={e => updateField('orderRef', e.target.value.toUpperCase())}
                      placeholder="e.g. DEAR-1001"
                    />
                  </div>

                  <div className="rev-input-group">
                    <label htmlFor="rev-cust-phone">
                      <Phone size={14} /> <span>Order Mobile Number <small>(Optional — private, matches completed order)</small></span>
                    </label>
                    <input
                      id="rev-cust-phone"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.customerPhone}
                      onChange={e => updateField('customerPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="10-digit WhatsApp/order number"
                      className={fieldErrors.customerPhone ? 'rev-input-has-error' : ''}
                    />
                    {fieldErrors.customerPhone && (
                      <span className="rev-field-error-text">{fieldErrors.customerPhone}</span>
                    )}
                  </div>

                  <div className="rev-input-group">
                    <label htmlFor="rev-cust-email">
                      <Mail size={14} /> <span>Email Address <small>(Optional — strictly private)</small></span>
                    </label>
                    <input
                      id="rev-cust-email"
                      type="email"
                      value={form.customerEmail}
                      onChange={e => updateField('customerEmail', e.target.value)}
                      placeholder="name@example.com (Never published)"
                    />
                  </div>
                </>
              )}

              <div className="rev-privacy-guarantee">
                <Lock size={12} />
                <span>Your mobile number, order ID, and email are strictly private and never shown on the public website.</span>
              </div>
            </div>
          </section>

          {error && (
            <div className="rev-banner-alert" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="rev-submit-section">
            <button
              type="submit"
              className="button button-dark rev-primary-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="review-spinner" />
                  <span>{isEditMode ? 'Updating review...' : 'Submitting review...'}</span>
                </>
              ) : (
                <>
                  <Heart size={18} fill="currentColor" />
                  <span>{isEditMode ? 'Save Review Update' : 'Submit Honest Review'}</span>
                  <ArrowUpRight size={18} />
                </>
              )}
            </button>
            <p className="rev-submit-disclaimer">
              Submitted reviews undergo moderation for spam &amp; safety before appearing publicly. Read our <a href="/review-policy">Review Policy</a>.
            </p>
          </div>
        </form>

        <footer className="rev-footer-note">
          <p>© {new Date().getFullYear()} Dear Misu Tiramisu · Handcrafted with love ♥</p>
        </footer>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="rev-page-root"><div className="rev-page-wrap"><div className="rev-success-card"><p>Loading review form...</p></div></div></div>}>
      <ReviewFormInner />
    </Suspense>
  );
}
