import Link from 'next/link';
import { ArrowLeft, ShieldCheck, CheckCircle2, EyeOff, Edit3, Lock, Heart } from 'lucide-react';

export const metadata = {
  title: 'Review & Authenticity Policy | Dear Misu Tiramisu',
  description: 'How Dear Misu collects, verifies, moderates, and protects customer reviews.',
};

export default function ReviewPolicyPage() {
  return (
    <div className="rev-page-root">
      <nav className="rev-top-nav">
        <Link href="/#reviews" className="rev-nav-back">
          <ArrowLeft size={16} /> <span>Back to Reviews</span>
        </Link>
        <Link href="/" className="rev-nav-brand">
          <img src="/images/dear-misu-badge.webp" alt="Dear Misu" width={34} height={34} />
          <strong>Dear Misu</strong>
        </Link>
        <a href="/review" className="rev-nav-tag" style={{ textDecoration: 'none' }}>Write a Review</a>
      </nav>

      <div className="rev-page-wrap">
        <header className="rev-hero-card">
          <div className="rev-hero-eyebrow">
            <span className="rev-eyebrow-pip" />
            <span>TRANSPARENCY &amp; TRUST</span>
            <span className="rev-eyebrow-pip" />
          </div>
          <h1>Review &amp; Authenticity <em>Policy</em></h1>
          <p className="rev-hero-sub">
            Moderate content. Verify purchases. Never manipulate customer opinions.
          </p>
        </header>

        <div className="rev-policy-stack">
          <section className="rev-step-card">
            <div className="rev-policy-heading">
              <Heart size={18} />
              <h2>1. How Customers Can Submit Reviews</h2>
            </div>
            <p className="rev-policy-copy">
              Anyone who has tried a Dear Misu dessert box can share an honest review on our <a href="/review">review submission page</a>. You select the specific product enjoyed, give an overall rating from 1 to 5 stars, share your experience in writing, and may optionally rate individual tasting notes (taste, coffee flavour, creaminess, sweetness, texture, chocolate, and presentation) or answer whether you would recommend Dear Misu. We never pre-fill star ratings or force positive recommendations.
            </p>
          </section>

          <section className="rev-step-card">
            <div className="rev-policy-heading">
              <ShieldCheck size={18} />
              <h2>2. What &ldquo;Verified Purchase&rdquo; Means</h2>
            </div>
            <p className="rev-policy-copy">
              A review receives the <strong>Verified Purchase</strong> label only when our server automatically matches all of the following conditions against our order database:
            </p>
            <ul className="rev-policy-list">
              <li>A valid order exists linked to the customer&apos;s order reference and matching phone number or email.</li>
              <li>That order includes the exact Dear Misu product being reviewed.</li>
              <li>The order has reached completed / <strong>delivered</strong> status (cancelled or pending orders do not qualify).</li>
              <li>Only one verified review is allowed per product per order to prevent duplicates.</li>
            </ul>
            <p className="rev-policy-copy">
              Reviews submitted without a matched delivered order are clearly labeled <strong>Customer Review</strong> so visitors are never misled about purchase verification. Administrators cannot manually assign a Verified Purchase badge.
            </p>
          </section>

          <section className="rev-step-card">
            <div className="rev-policy-heading">
              <CheckCircle2 size={18} />
              <h2>3. How Moderation Works</h2>
            </div>
            <p className="rev-policy-copy">
              All newly submitted reviews enter moderation before appearing publicly. Our team checks submissions strictly for spam, gibberish, abusive language, or accidental sharing of private details (such as phone numbers or street addresses).
            </p>
            <p className="rev-policy-copy">
              <strong>Strict Integrity Rule:</strong> Dear Misu administrators cannot edit or rewrite a customer&apos;s review text, star ratings, category scores, or submission date. Genuine critical or low-star reviews remain eligible for publication alongside positive feedback.
            </p>
          </section>

          <section className="rev-step-card">
            <div className="rev-policy-heading">
              <EyeOff size={18} />
              <h2>4. Why a Review May Be Rejected or Hidden</h2>
            </div>
            <p className="rev-policy-copy">
              A review may be rejected or temporarily hidden from public view only for clear policy reasons such as spam, automated bot submissions, hate speech, harassment, exposure of private personal information, or duplicate submissions. Every moderation action—approving, rejecting, hiding, restoring, or lawful deletion—requires an internal reason recorded in an append-only administrative audit log.
            </p>
          </section>

          <section className="rev-step-card">
            <div className="rev-policy-heading">
              <Edit3 size={18} />
              <h2>5. How Customers Can Update Their Own Reviews</h2>
            </div>
            <p className="rev-policy-copy">
              After submitting a review, you receive a private edit link secured with a unique token. Using that link, you may update your rating, comments, or tasting breakdown at any time without creating duplicate entries. Previous versions are preserved in our revision history, and updated reviews pass through moderation again before publishing.
            </p>
          </section>

          <section className="rev-step-card">
            <div className="rev-policy-heading">
              <Lock size={18} />
              <h2>6. How Customer Information Is Protected</h2>
            </div>
            <p className="rev-policy-copy">
              Only your chosen display name, product reviewed, ratings, comment, verification status, and submission date are displayed publicly. Email addresses, phone numbers, order references, and delivery details are kept strictly private and are never returned in public review feeds.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
