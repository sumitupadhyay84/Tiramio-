'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star, CheckCircle, XCircle, Trash2, Search, RefreshCw,
  ExternalLink, LogOut, Eye, EyeOff, AlertTriangle, MessageSquare,
  ShieldCheck, ShieldAlert, Heart, ChevronLeft, ChevronRight,
  Clock, Check, X, RotateCcw, History, Flag, Lock
} from 'lucide-react';

const api = process.env.NEXT_PUBLIC_API_URL || '';

function Stars({ rating, size = 14 }) {
  return (
    <span className="admin-stars" style={{ display: 'inline-flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={size}
          fill={s <= rating ? '#c6a36a' : 'none'}
          stroke={s <= rating ? '#c6a36a' : '#d1c0a8'}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

const MOD_STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Published',
  REJECTED: 'Rejected',
  HIDDEN: 'Hidden'
};

const DELETE_REASONS = [
  { value: 'duplicate', label: 'Duplicate submission' },
  { value: 'privacy_erasure', label: 'Personal data / privacy deletion request' },
  { value: 'legal_compliance', label: 'Legal / regulatory compliance requirement' },
  { value: 'spam_fraud', label: 'Confirmed automated spam or test record' }
];

export default function AdminReviews() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [adminToken, setAdminToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Dashboard Stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Reviews List
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED_OR_HIDDEN
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  // Modals & Drawers
  const [selectedReview, setSelectedReview] = useState(null);
  const [detailAuditLogs, setDetailAuditLogs] = useState([]);
  const [detailVersions, setDetailVersions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [moderationPrompt, setModerationPrompt] = useState(null); // { review, action: 'REJECT' | 'HIDE' | 'RESTORE' }
  const [moderationReason, setModerationReason] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteCategory, setDeleteCategory] = useState('duplicate');
  const [deleteReason, setDeleteReason] = useState('');

  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [globalAuditLogs, setGlobalAuditLogs] = useState([]);

  const [actionLoading, setActionLoading] = useState(false);
  const [bannerNotice, setBannerNotice] = useState({ text: '', type: '' });

  const showBanner = (text, type = 'success') => {
    setBannerNotice({ text, type });
    setTimeout(() => setBannerNotice({ text: '', type: '' }), 4500);
  };

  const authHeaders = useCallback((token) => {
    const t = token || adminToken;
    return { 'Authorization': `Bearer ${t}`, 'x-admin-status-secret': t };
  }, [adminToken]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('dearmisu_admin_token');
    sessionStorage.removeItem('dearmisu_admin_role');
    setAdminToken('');
    setIsAuthenticated(false);
    router.replace('/admin/login');
  }, [router]);

  // Verify admin session
  useEffect(() => {
    const stored = sessionStorage.getItem('dearmisu_admin_token');
    if (!stored) {
      router.replace('/admin/login');
      return;
    }

    fetch(`${api}/api/admin/verify`, {
      headers: { 'Authorization': `Bearer ${stored}` }
    })
      .then(res => {
        if (res.ok) {
          setAdminToken(stored);
          setIsAuthenticated(true);
          setCheckingAuth(false);
        } else {
          sessionStorage.removeItem('dearmisu_admin_token');
          sessionStorage.removeItem('dearmisu_admin_role');
          router.replace('/admin/login');
        }
      })
      .catch(() => {
        sessionStorage.removeItem('dearmisu_admin_token');
        sessionStorage.removeItem('dearmisu_admin_role');
        router.replace('/admin/login');
      });
  }, [router]);

  const fetchStats = useCallback(async (token) => {
    const t = token || adminToken;
    if (!t) return;
    setStatsLoading(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/stats`, {
        headers: authHeaders(t)
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      showBanner('Failed to load review statistics.', 'error');
    } finally {
      setStatsLoading(false);
    }
  }, [adminToken, authHeaders, handleLogout]);

  const fetchReviews = useCallback(async (targetPage = 1, token) => {
    const t = token || adminToken;
    if (!t) return;
    setLoading(true);
    try {
      const effectiveStatus = statusFilter || (activeTab !== 'ALL' ? activeTab : '');
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: '15',
        sort: sortBy
      });
      if (effectiveStatus) params.set('status', effectiveStatus);
      if (productFilter) params.set('product', productFilter);
      if (ratingFilter) params.set('rating', ratingFilter);
      if (verificationFilter) params.set('verification', verificationFilter);
      if (flaggedOnly) params.set('flagged', 'true');
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`${api}/api/admin/reviews?${params}`, {
        headers: authHeaders(t)
      });

      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
      } else {
        showBanner('Error loading reviews.', 'error');
      }
    } catch {
      showBanner('Unable to connect to the backend server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [adminToken, activeTab, statusFilter, productFilter, ratingFilter, verificationFilter, flaggedOnly, search, sortBy, authHeaders, handleLogout]);

  useEffect(() => {
    if (isAuthenticated && adminToken) {
      fetchStats();
      fetchReviews(1);
    }
  }, [isAuthenticated, adminToken, fetchStats, fetchReviews]);

  const openReviewDetails = async (rev) => {
    setSelectedReview(rev);
    setDetailAuditLogs([]);
    setDetailVersions([]);
    setDetailLoading(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/${rev.id}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.review) setSelectedReview(data.review);
        setDetailAuditLogs(data.auditLogs || []);
        setDetailVersions(data.versions || []);
      }
    } catch { /* fallback to row summary */ }
    finally {
      setDetailLoading(false);
    }
  };

  const openGlobalAuditLog = async () => {
    setAuditModalOpen(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/audit?limit=100`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalAuditLogs(data.auditLogs || []);
      }
    } catch {
      showBanner('Failed to load audit log.', 'error');
    }
  };

  // Actions
  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reason: 'Approved after moderation check' })
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showBanner('Review published (purchase verification remains independent).', 'success');
        if (selectedReview?.id === id) openReviewDetails(data.review || selectedReview);
        fetchReviews(page);
        fetchStats();
      } else {
        showBanner(data.message || 'Failed to approve review.', 'error');
      }
    } catch {
      showBanner('Network error approving review.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleModerationSubmit = async (e) => {
    e.preventDefault();
    if (!moderationPrompt) return;
    const { review, action } = moderationPrompt;
    const endpoint = action === 'REJECT' ? 'reject' : action === 'HIDE' ? 'hide' : 'restore';
    const requiresReason = action === 'REJECT' || action === 'HIDE';

    if (requiresReason && moderationReason.trim().length < 3) {
      showBanner('Please enter an internal reason (minimum 3 characters).', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/${review.id}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reason: moderationReason.trim() })
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const msg = action === 'REJECT'
          ? 'Review rejected and logged in audit history.'
          : action === 'HIDE'
            ? 'Review temporarily hidden from public display.'
            : 'Review restored and published publicly.';
        showBanner(msg, 'info');
        setModerationPrompt(null);
        setModerationReason('');
        if (selectedReview?.id === review.id) openReviewDetails(data.review || review);
        fetchReviews(page);
        fetchStats();
      } else {
        showBanner(data.message || 'Moderation action failed.', 'error');
      }
    } catch {
      showBanner('Network error performing moderation action.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!deleteConfirm) return;
    if (deleteReason.trim().length < 5) {
      showBanner('Please enter a specific deletion justification (at least 5 characters).', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          reasonCategory: deleteCategory,
          reason: deleteReason.trim()
        })
      });
      if (res.status === 401) { handleLogout(); return; }
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showBanner('Review removed and deletion logged in audit trail.', 'info');
        if (selectedReview?.id === deleteConfirm.id) setSelectedReview(null);
        setDeleteConfirm(null);
        setDeleteReason('');
        fetchReviews(page);
        fetchStats();
      } else {
        showBanner(data.message || 'Failed to delete review.', 'error');
      }
    } catch {
      showBanner('Network error deleting review.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (checkingAuth || !isAuthenticated) {
    return (
      <div className="admin-auth-screen">
        <div className="admin-auth-loading">
          <div className="review-spinner" style={{ width: 28, height: 28, borderColor: 'rgba(214, 173, 112, 0.3)', borderTopColor: '#c6a36a' }} />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 12 }}>Verifying administrator session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {bannerNotice.text && (
        <div className={`admin-toast-banner ${bannerNotice.type}`} role="status">
          {bannerNotice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          <span>{bannerNotice.text}</span>
        </div>
      )}

      {/* Admin Header */}
      <header className="admin-header">
        <div className="admin-header-brand">
          <img src="/images/dear-misu-badge.webp" alt="Dear Misu" width={38} height={38} />
          <div>
            <h1>Review Management &amp; Authenticity</h1>
            <span>Independent Moderation · Read-Only Customer Opinions</span>
          </div>
        </div>

        <div className="admin-header-actions">
          <button onClick={openGlobalAuditLog} className="admin-btn admin-btn-ghost" title="View Append-Only Audit Log">
            <History size={14} /> Audit Log
          </button>
          <a href="/" target="_blank" rel="noreferrer" className="admin-btn admin-btn-ghost">
            View Live Site <ExternalLink size={14} />
          </a>
          <button onClick={() => { fetchStats(); fetchReviews(page); }} className="admin-btn admin-btn-ghost" title="Refresh">
            <RefreshCw size={14} className={loading || statsLoading ? 'spinning' : ''} />
          </button>
          <button onClick={handleLogout} className="admin-btn admin-btn-logout" title="Log out">
            <LogOut size={14} /> Exit
          </button>
        </div>
      </header>

      {/* Dynamic Statistics Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span>Total Reviews</span>
            <MessageSquare size={16} className="stat-icon-gold" />
          </div>
          <strong>{stats?.total ?? 0}</strong>
          <small>{stats?.verifiedCount ?? 0} verified purchase{(stats?.verifiedCount ?? 0) === 1 ? '' : 's'}</small>
        </div>

        <div className="admin-stat-card stat-pending-card">
          <div className="admin-stat-header">
            <span>Pending Moderation</span>
            <Clock size={16} className="stat-icon-warn" />
          </div>
          <strong className="stat-pending-val">{stats?.pending ?? 0}</strong>
          <small>Awaiting moderation decision</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span>Approved / Published</span>
            <CheckCircle size={16} className="stat-icon-green" />
          </div>
          <strong className="stat-approved-val">{stats?.approved ?? 0}</strong>
          <small>Visible on public website</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span>Rejected / Hidden</span>
            <XCircle size={16} className="stat-icon-muted" />
          </div>
          <strong>{stats?.rejectedOrHidden ?? 0}</strong>
          <small>{stats?.rejected ?? 0} rejected · {stats?.hidden ?? 0} hidden</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span>Average Rating</span>
            <Star size={16} fill="#c6a36a" stroke="#c6a36a" />
          </div>
          <strong>{stats?.approved > 0 ? Number(stats.averageRating).toFixed(1) : '—'} <span className="stat-max">/ 5</span></strong>
          <small>Published reviews only</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span>Recommendation</span>
            <Heart size={16} className="stat-icon-rose" />
          </div>
          <strong>{stats?.recommendationPercentage !== null && stats?.recommendationPercentage !== undefined ? `${stats.recommendationPercentage}%` : '—'}</strong>
          <small>
            {stats?.recommendationResponseCount > 0
              ? `From ${stats.recommendationResponseCount} explicit responses`
              : 'No explicit responses yet'}
          </small>
        </div>
      </div>

      {/* Main Review Management Workspace */}
      <div className="admin-workspace">
        {/* Navigation Tabs */}
        <div className="admin-tabs-row">
          <div className="admin-tabs">
            {[
              { id: 'ALL', label: 'All Reviews', count: stats?.total },
              { id: 'PENDING', label: 'Pending Moderation', count: stats?.pending },
              { id: 'APPROVED', label: 'Published', count: stats?.approved },
              { id: 'REJECTED_OR_HIDDEN', label: 'Rejected / Hidden', count: stats?.rejectedOrHidden }
            ].map(tab => (
              <button
                key={tab.id}
                className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setStatusFilter(''); setPage(1); }}
              >
                {tab.label}
                {typeof tab.count === 'number' && (
                  <span className={`admin-tab-badge ${tab.id === 'PENDING' && tab.count > 0 ? 'badge-alert' : ''}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`admin-flag-filter-btn ${flaggedOnly ? 'active' : ''}`}
            onClick={() => { setFlaggedOnly(!flaggedOnly); setPage(1); }}
            title="Show records flagged for administrator integrity check"
          >
            <Flag size={13} /> Flagged ({stats?.flaggedCount ?? 0})
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="admin-filters-bar">
          <div className="admin-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search name, email, comment, product, or order ref..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && <button onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search">✕</button>}
          </div>

          <div className="admin-filter-dropdowns">
            <select value={productFilter} onChange={e => { setProductFilter(e.target.value); setPage(1); }} aria-label="Filter by product">
              <option value="">All Products</option>
              <option value="Dear Misu Mini">Dear Misu Mini</option>
              <option value="Dear Misu Classic">Dear Misu Classic</option>
              <option value="Dear Misu Share Box">Dear Misu Share Box</option>
            </select>

            <select value={ratingFilter} onChange={e => { setRatingFilter(e.target.value); setPage(1); }} aria-label="Filter by rating">
              <option value="">All Star Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>

            <select value={verificationFilter} onChange={e => { setVerificationFilter(e.target.value); setPage(1); }} aria-label="Filter by purchase verification">
              <option value="">All Purchase Status</option>
              <option value="VERIFIED_PURCHASE">Verified Purchase</option>
              <option value="UNVERIFIED">Unverified Purchase</option>
            </select>

            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} aria-label="Filter by moderation status">
              <option value="">Tab Moderation Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Published</option>
              <option value="REJECTED">Rejected</option>
              <option value="HIDDEN">Hidden</option>
            </select>

            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} aria-label="Sort reviews">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
              <option value="helpful">Most Helpful</option>
            </select>
          </div>
        </div>

        {/* Reviews Table */}
        <div className="admin-table-wrap">
          {loading ? (
            <div className="admin-table-loading">
              <RefreshCw size={24} className="spinning" />
              <span>Loading reviews...</span>
            </div>
          ) : reviews.length === 0 ? (
            <div className="admin-table-empty">
              <MessageSquare size={32} />
              <p>No reviews found matching the current filters.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Rating</th>
                  <th>Comment</th>
                  <th>Date</th>
                  <th>Purchase Verification</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(rev => {
                  const isVerifiedPurchase = rev.purchase_verification_status === 'VERIFIED_PURCHASE';
                  return (
                    <tr key={rev.id} className={`status-row-${rev.status?.toLowerCase()}`}>
                      <td>
                        <div className="admin-status-stack">
                          <span className={`status-pill pill-${rev.status?.toLowerCase()}`}>
                            {MOD_STATUS_LABELS[rev.status] || rev.status}
                          </span>
                          {rev.flagged_for_review && (
                            <span className="admin-flag-chip" title={rev.flag_reason || 'Flagged for integrity review'}>
                              <Flag size={10} /> Flagged
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="admin-customer-cell">
                          <strong>{rev.customer_name}</strong>
                          {rev.customer_email && <small>{rev.customer_email}</small>}
                          {rev.customer_phone && <small>{rev.customer_phone}</small>}
                        </div>
                      </td>
                      <td>
                        <span className="admin-product-cell">{rev.product_name}</span>
                      </td>
                      <td>
                        <div className="admin-rating-cell">
                          <Stars rating={rev.overall_rating} size={13} />
                          <span>{rev.overall_rating}/5</span>
                        </div>
                      </td>
                      <td className="admin-comment-cell" onClick={() => openReviewDetails(rev)} title="Click to inspect full review & audit history">
                        <p className="admin-comment-snippet">{rev.comment}</p>
                        {rev.feedback_tags?.length > 0 && (
                          <div className="admin-tags-row">
                            {rev.feedback_tags.slice(0, 2).map(tag => (
                              <span key={tag} className="admin-tag-mini">{tag}</span>
                            ))}
                            {rev.feedback_tags.length > 2 && <small>+{rev.feedback_tags.length - 2}</small>}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="admin-date-cell">
                          {new Date(rev.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`purchase-pill ${isVerifiedPurchase ? 'purchase-verified' : 'purchase-unverified'}`}
                          title={isVerifiedPurchase ? `Verified via ${rev.verification_evidence?.matchedBy || 'order match'}` : 'No matching delivered order found'}
                        >
                          {isVerifiedPurchase ? (
                            <><ShieldCheck size={12} /> Verified Purchase</>
                          ) : (
                            <><ShieldAlert size={12} /> Unverified Purchase</>
                          )}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="admin-action-btns">
                          <button
                            className="action-btn action-view"
                            onClick={() => openReviewDetails(rev)}
                            title="View Complete Details & Audit History"
                            aria-label="View review details"
                          >
                            <Eye size={14} />
                          </button>

                          {rev.status === 'PENDING' && (
                            <button
                              className="action-btn action-approve"
                              onClick={() => handleApprove(rev.id)}
                              disabled={actionLoading}
                              title="Approve & Publish Review"
                              aria-label="Approve review"
                            >
                              <Check size={14} />
                            </button>
                          )}

                          {(rev.status === 'PENDING' || rev.status === 'APPROVED') && (
                            <button
                              className="action-btn action-reject"
                              onClick={() => { setModerationPrompt({ review: rev, action: 'REJECT' }); setModerationReason(''); }}
                              disabled={actionLoading}
                              title="Reject Review (Requires Reason)"
                              aria-label="Reject review"
                            >
                              <X size={14} />
                            </button>
                          )}

                          {rev.status === 'APPROVED' && (
                            <button
                              className="action-btn action-hide"
                              onClick={() => { setModerationPrompt({ review: rev, action: 'HIDE' }); setModerationReason(''); }}
                              disabled={actionLoading}
                              title="Temporarily Hide from Public Website"
                              aria-label="Hide review"
                            >
                              <EyeOff size={14} />
                            </button>
                          )}

                          {(rev.status === 'HIDDEN' || rev.status === 'REJECTED') && (
                            <button
                              className="action-btn action-restore"
                              onClick={() => { setModerationPrompt({ review: rev, action: 'RESTORE' }); setModerationReason('Restored by administrator'); }}
                              disabled={actionLoading}
                              title="Restore & Republish Review"
                              aria-label="Restore review"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}

                          <button
                            className="action-btn action-delete"
                            onClick={() => { setDeleteConfirm(rev); setDeleteCategory('duplicate'); setDeleteReason(''); }}
                            disabled={actionLoading}
                            title="Delete (Legal, Privacy, Duplicate, or Confirmed Spam Only)"
                            aria-label="Delete review"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="admin-pagination-bar">
            <span>Showing page <b>{page}</b> of <b>{totalPages}</b> ({total} reviews total)</span>
            <div className="admin-pagination-controls">
              <button
                disabled={page <= 1 || loading}
                onClick={() => fetchReviews(page - 1)}
                className="admin-btn admin-btn-ghost"
              >
                <ChevronLeft size={15} /> Previous
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => fetchReviews(page + 1)}
                className="admin-btn admin-btn-ghost"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Detail Modal / Drawer */}
      {selectedReview && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedReview(null)}>
          <div className="admin-drawer" onClick={e => e.stopPropagation()}>
            <header className="admin-drawer-header">
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`status-pill pill-${selectedReview.status?.toLowerCase()}`}>
                    {MOD_STATUS_LABELS[selectedReview.status] || selectedReview.status}
                  </span>
                  <span className={`purchase-pill ${selectedReview.purchase_verification_status === 'VERIFIED_PURCHASE' ? 'purchase-verified' : 'purchase-unverified'}`}>
                    {selectedReview.purchase_verification_status === 'VERIFIED_PURCHASE' ? 'Verified Purchase' : 'Unverified Purchase'}
                  </span>
                </div>
                <h3>Review Details</h3>
              </div>
              <button className="admin-drawer-close" onClick={() => setSelectedReview(null)} aria-label="Close drawer">
                <X size={20} />
              </button>
            </header>

            <div className="admin-drawer-body">
              <div className="admin-integrity-notice">
                <Lock size={13} />
                <span>Customer opinion integrity enforced: original review text, ratings, and timestamps are read-only.</span>
              </div>

              {selectedReview.flagged_for_review && (
                <div className="admin-flag-alert">
                  <Flag size={14} />
                  <div>
                    <strong>Flagged for Administrator Review</strong>
                    <p>{selectedReview.flag_reason || 'Requires authenticity check before publishing.'}</p>
                  </div>
                </div>
              )}

              <div className="drawer-section">
                <h4>Customer Information (Private)</h4>
                <div className="drawer-grid">
                  <div>
                    <label>Display Name</label>
                    <p><strong>{selectedReview.customer_name}</strong></p>
                  </div>
                  <div>
                    <label>Email Address</label>
                    <p>{selectedReview.customer_email || <em>Not provided</em>}</p>
                  </div>
                  <div>
                    <label>Mobile Phone</label>
                    <p>{selectedReview.customer_phone || <em>Not provided</em>}</p>
                  </div>
                  <div>
                    <label>Product Reviewed</label>
                    <p><strong>{selectedReview.product_name}</strong></p>
                  </div>
                  <div>
                    <label>Submitted On</label>
                    <p>{new Date(selectedReview.created_at).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <label>Last Edited On</label>
                    <p>{selectedReview.updated_at ? new Date(selectedReview.updated_at).toLocaleString('en-IN') : '—'}</p>
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <h4>Purchase Verification Evidence (Private)</h4>
                {selectedReview.purchase_verification_status === 'VERIFIED_PURCHASE' && selectedReview.verification_evidence ? (
                  <div className="drawer-evidence-box">
                    <div><span>Order Ref:</span> <b>{selectedReview.verification_evidence.orderRef}</b></div>
                    <div><span>Matched By:</span> <b>{selectedReview.verification_evidence.matchedBy}</b></div>
                    <div><span>Delivered On:</span> <b>{new Date(selectedReview.verification_evidence.deliveredAt).toLocaleString('en-IN')}</b></div>
                    <div><span>Verified At:</span> <b>{new Date(selectedReview.verification_evidence.verifiedAt).toLocaleString('en-IN')}</b></div>
                  </div>
                ) : (
                  <p className="drawer-muted-note">
                    No matching completed/delivered order was verified server-side.
                    {selectedReview.order_ref ? ` (Customer entered ref: ${selectedReview.order_ref})` : ''}
                  </p>
                )}
              </div>

              <div className="drawer-section">
                <h4>Overall Rating &amp; Recommendation</h4>
                <div className="drawer-rating-row">
                  <Stars rating={selectedReview.overall_rating} size={22} />
                  <strong>{selectedReview.overall_rating} out of 5 stars</strong>
                </div>
                <p className="drawer-rec-line">
                  Recommendation response: <strong>{selectedReview.recommendation || <em>Not answered</em>}</strong>
                </p>
              </div>

              <div className="drawer-section">
                <h4>Customer Written Comment (Immutable)</h4>
                <div className="drawer-comment-box">
                  &ldquo;{selectedReview.comment}&rdquo;
                </div>
              </div>

              {(selectedReview.taste_rating || selectedReview.creaminess_rating || selectedReview.coffee_intensity_rating || selectedReview.sweetness_rating || selectedReview.texture_rating || selectedReview.chocolate_rating || selectedReview.presentation_rating) && (
                <div className="drawer-section">
                  <h4>Category Ratings</h4>
                  <div className="drawer-taste-grid">
                    {[
                      { key: 'taste_rating', label: 'Taste' },
                      { key: 'creaminess_rating', label: 'Creaminess' },
                      { key: 'coffee_intensity_rating', label: 'Coffee Flavour' },
                      { key: 'sweetness_rating', label: 'Sweetness' },
                      { key: 'texture_rating', label: 'Texture' },
                      { key: 'chocolate_rating', label: 'Chocolate' },
                      { key: 'presentation_rating', label: 'Presentation' }
                    ].map(({ key, label }) => selectedReview[key] ? (
                      <div key={key} className="drawer-taste-item">
                        <span>{label}</span>
                        <Stars rating={selectedReview[key]} size={12} />
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {selectedReview.feedback_tags?.length > 0 && (
                <div className="drawer-section">
                  <h4>Feedback Tags</h4>
                  <div className="drawer-tags">
                    {selectedReview.feedback_tags.map(tag => (
                      <span key={tag} className="drawer-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedReview.moderation_reason && (
                <div className="drawer-section">
                  <h4>Latest Moderation Reason</h4>
                  <p className="drawer-reason-box">{selectedReview.moderation_reason}</p>
                </div>
              )}

              {/* Version History */}
              {detailVersions.length > 0 && (
                <div className="drawer-section">
                  <h4>Customer Revision History ({detailVersions.length})</h4>
                  <div className="drawer-history-list">
                    {detailVersions.map(v => (
                      <div key={v.id} className="drawer-history-item">
                        <div className="history-meta">
                          <b>Version {v.version_number}</b>
                          <span>{v.overall_rating}★ · {new Date(v.created_at).toLocaleString('en-IN')}</span>
                        </div>
                        <p>&ldquo;{v.comment}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit History */}
              <div className="drawer-section">
                <h4>Moderation Audit Trail</h4>
                {detailLoading ? (
                  <p className="drawer-muted-note">Loading audit history...</p>
                ) : detailAuditLogs.length === 0 ? (
                  <p className="drawer-muted-note">No audit events recorded for this review yet.</p>
                ) : (
                  <div className="drawer-history-list">
                    {detailAuditLogs.map(log => (
                      <div key={log.id} className="drawer-history-item">
                        <div className="history-meta">
                          <b>{log.action}</b>
                          <span>{new Date(log.created_at).toLocaleString('en-IN')}</span>
                        </div>
                        <small>
                          Actor: <b>{log.actor_id}</b> ({log.actor_type})
                          {log.previous_status || log.new_status ? ` · ${log.previous_status || 'NEW'} → ${log.new_status}` : ''}
                        </small>
                        {log.reason && <p>Reason: {log.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <footer className="admin-drawer-footer">
              <div className="drawer-actions">
                {selectedReview.status === 'PENDING' && (
                  <button className="button button-dark" onClick={() => handleApprove(selectedReview.id)} disabled={actionLoading}>
                    <CheckCircle size={15} /> Approve &amp; Publish
                  </button>
                )}
                {(selectedReview.status === 'PENDING' || selectedReview.status === 'APPROVED') && (
                  <button
                    className="button button-light"
                    onClick={() => { setModerationPrompt({ review: selectedReview, action: 'REJECT' }); setModerationReason(''); }}
                    disabled={actionLoading}
                  >
                    <XCircle size={15} /> Reject
                  </button>
                )}
                {selectedReview.status === 'APPROVED' && (
                  <button
                    className="button button-light"
                    onClick={() => { setModerationPrompt({ review: selectedReview, action: 'HIDE' }); setModerationReason(''); }}
                    disabled={actionLoading}
                  >
                    <EyeOff size={15} /> Hide
                  </button>
                )}
                {(selectedReview.status === 'HIDDEN' || selectedReview.status === 'REJECTED') && (
                  <button
                    className="button button-dark"
                    onClick={() => { setModerationPrompt({ review: selectedReview, action: 'RESTORE' }); setModerationReason('Restored by administrator'); }}
                    disabled={actionLoading}
                  >
                    <RotateCcw size={15} /> Restore
                  </button>
                )}
                <button
                  className="button admin-delete-btn"
                  onClick={() => { setDeleteConfirm(selectedReview); setDeleteCategory('duplicate'); setDeleteReason(''); }}
                  disabled={actionLoading}
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Reject / Hide / Restore Reason Dialog */}
      {moderationPrompt && (
        <div className="admin-modal-backdrop" onClick={() => setModerationPrompt(null)}>
          <form className="admin-confirm-dialog" onSubmit={handleModerationSubmit} onClick={e => e.stopPropagation()}>
            <h3>
              {moderationPrompt.action === 'REJECT'
                ? 'Reject Review'
                : moderationPrompt.action === 'HIDE'
                  ? 'Temporarily Hide Review'
                  : 'Restore Review'}
            </h3>
            <p>
              {moderationPrompt.action === 'REJECT'
                ? 'This review will remain in database records for auditability but will not appear publicly. An internal reason is required.'
                : moderationPrompt.action === 'HIDE'
                  ? 'Hiding removes this review from the public site while preserving original content and audit history. Please enter an internal reason.'
                  : 'This will restore the review back to Published status on the storefront.'}
            </p>
            <textarea
              rows={3}
              required={moderationPrompt.action !== 'RESTORE'}
              value={moderationReason}
              onChange={e => setModerationReason(e.target.value)}
              placeholder="Enter internal moderation reason..."
              className="admin-dialog-textarea"
            />
            <div className="confirm-buttons">
              <button type="button" className="button button-light" onClick={() => setModerationPrompt(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button type="submit" className="button button-dark" disabled={actionLoading}>
                {actionLoading ? 'Saving...' : `Confirm ${moderationPrompt.action}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <form className="admin-confirm-dialog" onSubmit={handleDelete} onClick={e => e.stopPropagation()}>
            <div className="confirm-icon-wrap">
              <AlertTriangle size={28} />
            </div>
            <h3>Permitted Record Deletion</h3>
            <p>
              Reviews may only be permanently deleted for retention, privacy, legal, or duplicate reasons — never simply because feedback is negative.
            </p>
            <select
              value={deleteCategory}
              onChange={e => setDeleteCategory(e.target.value)}
              className="admin-dialog-select"
              aria-label="Deletion reason category"
            >
              {DELETE_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <textarea
              rows={3}
              required
              minLength={5}
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
              placeholder="Specific audit justification (min 5 characters)..."
              className="admin-dialog-textarea"
            />
            <div className="confirm-buttons">
              <button type="button" className="button button-light" onClick={() => setDeleteConfirm(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button type="submit" className="button admin-danger-btn" disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : 'Confirm Permanent Delete'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global Audit Log Modal */}
      {auditModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setAuditModalOpen(false)}>
          <div className="admin-drawer" onClick={e => e.stopPropagation()}>
            <header className="admin-drawer-header">
              <div>
                <span className="status-pill pill-approved">APPEND-ONLY AUDIT TRAIL</span>
                <h3>Administrative &amp; Integrity Log</h3>
              </div>
              <button className="admin-drawer-close" onClick={() => setAuditModalOpen(false)} aria-label="Close audit log">
                <X size={20} />
              </button>
            </header>
            <div className="admin-drawer-body">
              {globalAuditLogs.length === 0 ? (
                <p className="drawer-muted-note">No audit events logged yet.</p>
              ) : (
                <div className="drawer-history-list">
                  {globalAuditLogs.map(log => (
                    <div key={log.id} className="drawer-history-item">
                      <div className="history-meta">
                        <b>{log.action}</b>
                        <span>{new Date(log.created_at).toLocaleString('en-IN')}</span>
                      </div>
                      <small>
                        Review: <code>{log.review_id.slice(0, 8)}…</code> · Actor: <b>{log.actor_id}</b> ({log.actor_type})
                        {log.previous_status || log.new_status ? ` · ${log.previous_status || 'NEW'} → ${log.new_status}` : ''}
                      </small>
                      {log.reason && <p>Reason: {log.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
