'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Star, Camera, X, Heart, ArrowUpRight, CheckCircle2, Sparkles,
  AlertCircle, ArrowLeft, Check, Coffee, Package, Lock,
  CakeSlice, ChevronDown, ChevronUp, User, Mail
} from 'lucide-react';

const api = process.env.NEXT_PUBLIC_API_URL || '';

const productOptions = [
  {
    id: 'Dear Misu Mini (100g)',
    name: 'Dear Misu Mini',
    weight: '100g',
    price: '₹69',
    tag: 'Personal Treat',
    image: '/images/dearmisu-mini-card.webp'
  },
  {
    id: 'Dear Misu Classic (200g)',
    name: 'Dear Misu Classic',
    weight: '200g',
    price: '₹129',
    tag: 'Most Loved',
    image: '/images/dearmisu-classic-card.webp',
    featured: true
  },
  {
    id: 'Dear Misu Share Box (300g)',
    name: 'Dear Misu Share Box',
    weight: '300g',
    price: '₹189',
    tag: 'Best Value',
    image: '/images/dearmisu-share-card.webp'
  }
];

const tasteCategories = [
  { key: 'tasteRating', label: 'Overall Taste', hint: 'Harmony of ingredients' },
  { key: 'creaminessRating', label: 'Creaminess', hint: 'Silky mascarpone blend' },
  { key: 'coffeeIntensityRating', label: 'Coffee Intensity', hint: 'Espresso soak balance' },
  { key: 'sweetnessRating', label: 'Sweetness', hint: 'Sugar level balance' },
  { key: 'textureRating', label: 'Texture & Softness', hint: 'Cloud-soft sponge layers' },
  { key: 'chocolateRating', label: 'Cocoa Flavour', hint: 'Dusted chocolate finish' },
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
          onClick={() => onChange(s)}
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

export default function ReviewPage() {
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
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
    recommendation: 'Definitely!',
  });

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showTasteDetail, setShowTasteDetail] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const fileRef = useRef(null);

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

  const handleImage = useCallback(e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB in size.');
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
  }, []);

  const removeImage = useCallback(() => {
    setImage(null);
    setImagePreview('');
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const validate = () => {
    const errs = {};
    if (!form.customerName.trim() || form.customerName.trim().length < 2) {
      errs.customerName = 'Please enter your name (at least 2 characters).';
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
      const formData = new FormData();
      formData.append('customerName', form.customerName.trim());
      if (form.customerEmail) formData.append('customerEmail', form.customerEmail.trim());
      formData.append('productName', form.productName);
      formData.append('overallRating', String(form.overallRating));
      tasteCategories.forEach(({ key }) => {
        if (form[key]) formData.append(key, String(form[key]));
      });
      if (form.sweetnessPreference) formData.append('sweetnessPreference', form.sweetnessPreference);
      if (form.coffeePreference) formData.append('coffeePreference', form.coffeePreference);
      if (form.texturePreference) formData.append('texturePreference', form.texturePreference);
      if (form.feedbackTags.length) formData.append('feedbackTags', JSON.stringify(form.feedbackTags));
      formData.append('comment', form.comment.trim());
      if (form.recommendation) formData.append('recommendation', form.recommendation);
      formData.append('honeypot', '');
      if (image) formData.append('image', image);

      const res = await fetch(`${api}/api/reviews`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Could not connect to the review server. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rev-page-root">
        <div className="rev-page-wrap">
          <div className="rev-success-card">
            <div className="rev-success-glow" aria-hidden="true" />
            <div className="rev-success-badge">
              <CheckCircle2 size={46} strokeWidth={2} />
            </div>
            <span className="rev-success-eyebrow">♡ WITH ALL OUR LOVE</span>
            <h2>Thank you for sharing your Dear Misu moment!</h2>
            <p className="rev-success-message">
              Your feedback has reached our pastry kitchen. Every note you shared helps us make each batch even more delicate and dreamy.
            </p>
            <div className="rev-success-status-pill">
              <span>Status:</span> <b>Under Review & Publishing Shortly</b>
            </div>
            <div className="rev-success-actions">
              <a href="/" className="button button-dark rev-action-btn">
                Back to Dear Misu <ArrowUpRight size={16} />
              </a>
              <a href="/#menu" className="button button-light rev-action-btn">
                Order Another Box <CakeSlice size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rev-page-root">
      {/* Top Floating Brand Navigation */}
      <nav className="rev-top-nav">
        <a href="/" className="rev-nav-back">
          <ArrowLeft size={16} /> <span>Storefront</span>
        </a>
        <a href="/" className="rev-nav-brand">
          <img src="/images/dear-misu-badge.webp" alt="Dear Misu" width={34} height={34} />
          <strong>Dear Misu</strong>
        </a>
        <span className="rev-nav-tag">Tasting Feedback</span>
      </nav>

      <div className="rev-page-wrap">
        {/* Luxury Hero Banner */}
        <header className="rev-hero-card">
          <div className="rev-hero-corner-sparkle">✦</div>
          <div className="rev-hero-eyebrow">
            <span className="rev-eyebrow-pip" />
            <span>AUTHENTIC TASTE FEEDBACK</span>
            <span className="rev-eyebrow-pip" />
          </div>
          <h1>
            Enjoyed every <em>spoonful?</em>
          </h1>
          <p className="rev-hero-sub">
            Layers of Love, in Every Bite. Tell us what made your Dear Misu dessert moment special.
          </p>

          <div className="rev-hero-badges-row">
            <div className="rev-mini-badge">
              <Sparkles size={12} />
              <span>Takes 60 seconds</span>
            </div>
            <div className="rev-mini-badge">
              <Heart size={12} />
              <span>100% Genuine Reviews</span>
            </div>
            <div className="rev-mini-badge">
              <Lock size={12} />
              <span>No Account Needed</span>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="rev-form-container" noValidate>
          {/* Honeypot Spam Trap */}
          <div style={{ position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true">
            <input name="honeypot" tabIndex={-1} autoComplete="off" />
          </div>

          {/* STEP 1: VISUAL PRODUCT SELECTION */}
          <section className={`rev-step-card ${fieldErrors.productName ? 'rev-error-anchor' : ''}`}>
            <div className="rev-step-header">
              <span className="rev-step-number">01</span>
              <div>
                <h3>Which Dear Misu did you have? *</h3>
                <p>Tap your box to select</p>
              </div>
            </div>

            <div className="rev-products-grid">
              {productOptions.map(prod => {
                const isSelected = form.productName === prod.id;
                return (
                  <button
                    key={prod.id}
                    type="button"
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
                      <span className="rev-card-weight">{prod.weight} · {prod.price}</span>
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
                <h3>How much did you love your Dear Misu? *</h3>
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
                <p>Tap all that match your spoonful (optional)</p>
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
                <p>Every little detail matters to us</p>
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
                placeholder="What did you love most about your Dear Misu? The soft coffee-soaked sponge, cloud-soft cream, cocoa snowfall... tell us everything!"
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

          {/* STEP 5: OPTIONAL DEEP SENSORY TASTE BREAKDOWN */}
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
                    <h3>Taste & Texture Breakdown</h3>
                    <span className="rev-optional-chip">Optional</span>
                  </div>
                  <p>Rate creaminess, sweetness, coffee intensity & more</p>
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

                {/* Preference Choices */}
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
                      {['Extra creamy', 'Soft and fluffy', 'Rich and layered', 'Perfect balance'].map(opt => (
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

          {/* STEP 6: PHOTO UPLOAD */}
          <section className="rev-step-card">
            <div className="rev-step-header">
              <span className="rev-step-number">06</span>
              <div>
                <div className="rev-toggle-title-line">
                  <h3>Share a photo</h3>
                  <span className="rev-optional-chip">Optional</span>
                </div>
                <p>Show us your tiramisu moment or open box</p>
              </div>
            </div>

            {imagePreview ? (
              <div className="rev-uploaded-preview-card">
                <img src={imagePreview} alt="Customer upload preview" />
                <button
                  type="button"
                  className="rev-remove-photo-btn"
                  onClick={removeImage}
                  title="Remove photograph"
                >
                  <X size={16} /> Remove Photo
                </button>
              </div>
            ) : (
              <label className="rev-dropzone-uploader" htmlFor="rev-photo-input">
                <div className="rev-dropzone-icon">
                  <Camera size={26} />
                </div>
                <strong>Tap to upload a photo</strong>
                <small>JPG, PNG, or WebP up to 5 MB</small>
                <input
                  ref={fileRef}
                  id="rev-photo-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImage}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </section>

          {/* STEP 7: RECOMMENDATION */}
          <section className="rev-step-card">
            <div className="rev-step-header">
              <span className="rev-step-number">07</span>
              <div>
                <h3>Would you recommend Dear Misu to friends?</h3>
                <p>Spread the sweet word</p>
              </div>
            </div>

            <div className="rev-rec-buttons-grid">
              {[
                { value: 'Definitely!', label: 'Definitely! ♡', desc: 'A must-try treat' },
                { value: 'Maybe', label: 'Maybe', desc: 'Good, but personal choice' },
                { value: 'Not this time', label: 'Not this time', desc: 'Needs tweaking' }
              ].map(opt => {
                const isSelected = form.recommendation === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`rev-rec-choice-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => updateField('recommendation', opt.value)}
                  >
                    <strong>{opt.label}</strong>
                    <small>{opt.desc}</small>
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 8: CUSTOMER INFORMATION */}
          <section className={`rev-step-card ${fieldErrors.customerName ? 'rev-error-anchor' : ''}`}>
            <div className="rev-step-header">
              <span className="rev-step-number">08</span>
              <div>
                <h3>Your Details</h3>
                <p>So we know who to thank</p>
              </div>
            </div>

            <div className="rev-inputs-stack">
              <div className="rev-input-group">
                <label htmlFor="rev-cust-name">
                  <User size={14} /> <span>Your Name *</span>
                </label>
                <input
                  id="rev-cust-name"
                  type="text"
                  required
                  maxLength={80}
                  value={form.customerName}
                  onChange={e => updateField('customerName', e.target.value)}
                  placeholder="e.g. Ananya or Rahul"
                  className={fieldErrors.customerName ? 'rev-input-has-error' : ''}
                />
                {fieldErrors.customerName && (
                  <span className="rev-field-error-text">{fieldErrors.customerName}</span>
                )}
              </div>

              <div className="rev-input-group">
                <label htmlFor="rev-cust-email">
                  <Mail size={14} /> <span>Email Address <small>(Optional)</small></span>
                </label>
                <input
                  id="rev-cust-email"
                  type="email"
                  value={form.customerEmail}
                  onChange={e => updateField('customerEmail', e.target.value)}
                  placeholder="name@example.com (Never published)"
                />
                <div className="rev-privacy-guarantee">
                  <Lock size={12} />
                  <span>Your email is strictly private and never shared publicly.</span>
                </div>
              </div>
            </div>
          </section>

          {/* Global Error Banner */}
          {error && (
            <div className="rev-banner-alert" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <div className="rev-submit-section">
            <button
              type="submit"
              className="button button-dark rev-primary-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="review-spinner" />
                  <span>Submitting your review...</span>
                </>
              ) : (
                <>
                  <Heart size={18} fill="currentColor" />
                  <span>Share My Sweet Experience ♡</span>
                  <ArrowUpRight size={18} />
                </>
              )}
            </button>
            <p className="rev-submit-disclaimer">
              Reviews are personally reviewed by our team to maintain an authentic community.
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
