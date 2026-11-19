'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star, CheckCircle, XCircle, Trash2, Search, Filter, RefreshCw,
  ExternalLink, Key, LogOut, Eye, AlertTriangle, MessageSquare,
  ThumbsUp, ShieldCheck, Heart, Camera, ChevronLeft, ChevronRight,
  TrendingUp, Clock, Check, X
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
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Modals & Drawers
  const [selectedReview, setSelectedReview] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [bannerNotice, setBannerNotice] = useState({ text: '', type: '' });

  const showBanner = (text, type = 'success') => {
    setBannerNotice({ text, type });
    setTimeout(() => setBannerNotice({ text: '', type: '' }), 4000);
  };

  // Helper: get auth headers
  const authHeaders = useCallback((token) => {
    const t = token || adminToken;
    return { 'Authorization': `Bearer ${t}`, 'x-admin-status-secret': t };
  }, [adminToken]);

  // Protect Admin Route: Verify with backend session or redirect to /admin/login
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
        // Network error – don't silently grant access
        sessionStorage.removeItem('dearmisu_admin_token');
        sessionStorage.removeItem('dearmisu_admin_role');
        router.replace('/admin/login');
      });
  }, [router]);

  // Fetch Stats
  const fetchStats = useCallback(async (token) => {
    const t = token || adminToken;
    if (!t) return;
    setStatsLoading(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/stats`, {
        headers: authHeaders(t)
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      showBanner('Failed to load review statistics.', 'error');
    } finally {
      setStatsLoading(false);
    }
  }, [adminToken]);

  // Fetch Reviews
  const fetchReviews = useCallback(async (targetPage = 1, token) => {
    const t = token || adminToken;
    if (!t) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage,
        limit: 15,
        sort: sortBy
      });
      if (activeTab !== 'ALL') params.set('status', activeTab);
      if (productFilter) params.set('product', productFilter);
      if (ratingFilter) params.set('rating', ratingFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`${api}/api/admin/reviews?${params}`, {
        headers: authHeaders(t)
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

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
  }, [adminToken, activeTab, productFilter, ratingFilter, search, sortBy]);

  useEffect(() => {
    if (isAuthenticated && adminToken) {
      fetchStats();
      fetchReviews(1);
    }
  }, [isAuthenticated, adminToken, fetchStats, fetchReviews]);

  const handleLogout = () => {
    sessionStorage.removeItem('dearmisu_admin_token');
    sessionStorage.removeItem('dearmisu_admin_role');
    setAdminToken('');
    setIsAuthenticated(false);
    router.replace('/admin/login');
  };

  // Actions
  const handleApprove = async (id) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/${id}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ moderatedBy: 'Store Admin' })
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        showBanner('Review approved and published to website ♡', 'success');
        if (selectedReview?.id === id) {
          setSelectedReview(prev => ({ ...prev, status: 'APPROVED', moderated_at: new Date().toISOString() }));
        }
        fetchReviews(page);
        fetchStats();
      } else {
        showBanner('Failed to approve review.', 'error');
      }
    } catch {
      showBanner('Network error approving review.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/${id}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders()
        },
        body: JSON.stringify({ moderatedBy: 'Store Admin' })
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        showBanner('Review rejected and removed from public view.', 'info');
        if (selectedReview?.id === id) {
          setSelectedReview(prev => ({ ...prev, status: 'REJECTED', moderated_at: new Date().toISOString() }));
        }
        fetchReviews(page);
        fetchStats();
      } else {
        showBanner('Failed to reject review.', 'error');
      }
    } catch {
      showBanner('Network error rejecting review.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${api}/api/admin/reviews/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.status === 401) { handleLogout(); return; }
      if (res.ok) {
        showBanner('Review deleted permanently.', 'info');
        setDeleteConfirm(null);
        if (selectedReview?.id === id) setSelectedReview(null);
        fetchReviews(page);
        fetchStats();
      } else {
        showBanner('Failed to delete review.', 'error');
      }
    } catch {
      showBanner('Network error deleting review.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Auth gate: If not verified, show loading while router.replace('/admin/login') executes
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
      {/* Top Banner Notice */}
      {bannerNotice.text && (
        <div className={`admin-toast-banner ${bannerNotice.type}`}>
          {bannerNotice.type === 'success' ? <CheckCircle size={16} /> : bannerNotice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          <span>{bannerNotice.text}</span>
        </div>
      )}

      {/* Admin Header */}
      <header className="admin-header">
        <div className="admin-header-brand">
          <img src="/images/dear-misu-badge.webp" alt="" width={38} height={38} />
          <div>
            <h1>Review Management</h1>
            <span>Dear Misu Administration</span>
          </div>
        </div>

        <div className="admin-header-actions">
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
          <small>All-time submissions</small>
        </div>

        <div className="admin-stat-card stat-pending-card">
          <div className="admin-stat-header">
            <span>Pending Moderation</span>
            <Clock size={16} className="stat-icon-warn" />
          </div>
          <strong className="stat-pending-val">{stats?.pending ?? 0}</strong>
          <small>Needs approval to go live</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span>Approved / Live</span>
            <CheckCircle size={16} className="stat-icon-green" />
          </div>
          <strong className="stat-approved-val">{stats?.approved ?? 0}</strong>
          <small>Visible on homepage</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span>Rejected</span>
            <XCircle size={16} className="stat-icon-muted" />
          </div>
          <strong>{stats?.rejected ?? 0}</strong>
          <small>Hidden from public</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span>Average Rating</span>
            <Star size={16} fill="#c6a36a" stroke="#c6a36a" />
          </div>
          <strong>{stats?.averageRating ? Number(stats.averageRating).toFixed(1) : '—'} <span className="stat-max">/ 5</span></strong>
          <small>Across approved reviews</small>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <span>Recommendation</span>
            <Heart size={16} className="stat-icon-rose" />
          </div>
          <strong>{stats?.recommendationPercentage ?? 0}%</strong>
          <small>Would recommend to friends</small>
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
              { id: 'REJECTED', label: 'Rejected', count: stats?.rejected }
            ].map(tab => (
              <button
                key={tab.id}
                className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setPage(1); }}
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
        </div>

        {/* Toolbar & Filters */}
        <div className="admin-filters-bar">
          <div className="admin-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search customer name or comment..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchReviews(1); }}
            />
            {search && <button onClick={() => { setSearch(''); setTimeout(() => fetchReviews(1), 50); }}>✕</button>}
          </div>

          <div className="admin-filter-dropdowns">
            <select value={productFilter} onChange={e => { setProductFilter(e.target.value); setPage(1); }}>
              <option value="">All Products</option>
              <option value="Dear Misu Mini (100g)">Dear Misu Mini (100g)</option>
              <option value="Dear Misu Classic (200g)">Dear Misu Classic (200g)</option>
              <option value="Dear Misu Share Box (300g)">Dear Misu Share Box (300g)</option>
            </select>

            <select value={ratingFilter} onChange={e => { setRatingFilter(e.target.value); setPage(1); }}>
              <option value="">All Star Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>

            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
              <option value="helpful">Most Helpful</option>
            </select>
          </div>
        </div>

        {/* Reviews Table / List */}
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
                  <th>Photo</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(rev => (
                  <tr key={rev.id} className={`status-row-${rev.status?.toLowerCase()}`}>
                    <td>
                      <span className={`status-pill pill-${rev.status?.toLowerCase()}`}>
                        {rev.status}
                      </span>
                    </td>
                    <td>
                      <div className="admin-customer-cell">
                        <strong>{rev.customer_name}</strong>
                        {rev.customer_email && <small>{rev.customer_email}</small>}
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
                    <td className="admin-comment-cell" onClick={() => setSelectedReview(rev)} title="Click to view full review details">
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
                      {rev.customer_image_url ? (
                        <button
                          type="button"
                          className="admin-photo-thumb-btn"
                          onClick={() => setPhotoModal(`${api}${rev.customer_image_url}`)}
                          title="Click to view photograph"
                        >
                          <img src={`${api}${rev.customer_image_url}`} alt="Review photo" />
                          <Camera size={12} className="photo-corner-icon" />
                        </button>
                      ) : (
                        <span className="admin-no-photo">—</span>
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
                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-action-btns">
                        <button
                          className="action-btn action-view"
                          onClick={() => setSelectedReview(rev)}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>

                        {rev.status !== 'APPROVED' && (
                          <button
                            className="action-btn action-approve"
                            onClick={() => handleApprove(rev.id)}
                            disabled={actionLoading}
                            title="Approve Review"
                          >
                            <Check size={14} />
                          </button>
                        )}

                        {rev.status !== 'REJECTED' && (
                          <button
                            className="action-btn action-reject"
                            onClick={() => handleReject(rev.id)}
                            disabled={actionLoading}
                            title="Reject Review"
                          >
                            <X size={14} />
                          </button>
                        )}

                        <button
                          className="action-btn action-delete"
                          onClick={() => setDeleteConfirm(rev)}
                          disabled={actionLoading}
                          title="Delete Review"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
                <span className={`status-pill pill-${selectedReview.status?.toLowerCase()}`}>
                  {selectedReview.status}
                </span>
                <h3>Review Details</h3>
              </div>
              <button className="admin-drawer-close" onClick={() => setSelectedReview(null)}>
                <X size={20} />
              </button>
            </header>

            <div className="admin-drawer-body">
              <div className="drawer-section">
                <h4>Customer Information</h4>
                <div className="drawer-grid">
                  <div>
                    <label>Customer Name</label>
                    <p><strong>{selectedReview.customer_name}</strong></p>
                  </div>
                  <div>
                    <label>Email Address</label>
                    <p>{selectedReview.customer_email || <em>Not provided</em>}</p>
                  </div>
                  <div>
                    <label>Product Purchased</label>
                    <p><strong>{selectedReview.product_name}</strong></p>
                  </div>
                  <div>
                    <label>Submitted On</label>
                    <p>{new Date(selectedReview.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              <div className="drawer-section">
                <h4>Overall Rating & Recommendation</h4>
                <div className="drawer-rating-row">
                  <Stars rating={selectedReview.overall_rating} size={22} />
                  <strong>{selectedReview.overall_rating} out of 5 stars</strong>
                </div>
                {selectedReview.recommendation && (
                  <p className="drawer-rec-line">
                    Would recommend to friends: <strong>{selectedReview.recommendation}</strong>
                  </p>
                )}
              </div>

              <div className="drawer-section">
                <h4>Customer Written Comment</h4>
                <div className="drawer-comment-box">
                  &ldquo;{selectedReview.comment}&rdquo;
                </div>
              </div>

              {/* Detailed Taste Ratings */}
              {(selectedReview.taste_rating || selectedReview.creaminess_rating || selectedReview.coffee_intensity_rating || selectedReview.sweetness_rating || selectedReview.texture_rating || selectedReview.chocolate_rating || selectedReview.presentation_rating) && (
                <div className="drawer-section">
                  <h4>Detailed Taste Scores</h4>
                  <div className="drawer-taste-grid">
                    {[
                      { key: 'taste_rating', label: 'Overall Taste' },
                      { key: 'creaminess_rating', label: 'Creaminess' },
                      { key: 'coffee_intensity_rating', label: 'Coffee Intensity' },
                      { key: 'sweetness_rating', label: 'Sweetness' },
                      { key: 'texture_rating', label: 'Texture & Softness' },
                      { key: 'chocolate_rating', label: 'Chocolate Flavour' },
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

              {/* Preferences */}
              {(selectedReview.sweetness_preference || selectedReview.coffee_preference || selectedReview.texture_preference) && (
                <div className="drawer-section">
                  <h4>Customer Preferences</h4>
                  <div className="drawer-pref-list">
                    {selectedReview.sweetness_preference && <div><span>Sweetness:</span> <b>{selectedReview.sweetness_preference}</b></div>}
                    {selectedReview.coffee_preference && <div><span>Coffee:</span> <b>{selectedReview.coffee_preference}</b></div>}
                    {selectedReview.texture_preference && <div><span>Texture:</span> <b>{selectedReview.texture_preference}</b></div>}
                  </div>
                </div>
              )}

              {/* Tags */}
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

              {/* Uploaded Photograph */}
              {selectedReview.customer_image_url && (
                <div className="drawer-section">
                  <h4>Customer Photograph</h4>
                  <div className="drawer-photo-preview">
                    <img
                      src={`${api}${selectedReview.customer_image_url}`}
                      alt="Customer upload"
                      onClick={() => setPhotoModal(`${api}${selectedReview.customer_image_url}`)}
                    />
                  </div>
                </div>
              )}

              {/* Moderation History */}
              {selectedReview.moderated_at && (
                <div className="drawer-section drawer-mod-history">
                  <h4>Moderation Audit</h4>
                  <p>Moderated on: <b>{new Date(selectedReview.moderated_at).toLocaleString('en-IN')}</b></p>
                  <p>Moderated by: <b>{selectedReview.moderated_by || 'Admin'}</b></p>
                </div>
              )}
            </div>

            <footer className="admin-drawer-footer">
              <div className="drawer-actions">
                {selectedReview.status !== 'APPROVED' && (
                  <button
                    className="button button-dark"
                    onClick={() => handleApprove(selectedReview.id)}
                    disabled={actionLoading}
                  >
                    <CheckCircle size={15} /> Approve & Publish
                  </button>
                )}
                {selectedReview.status !== 'REJECTED' && (
                  <button
                    className="button button-light"
                    onClick={() => handleReject(selectedReview.id)}
                    disabled={actionLoading}
                  >
                    <XCircle size={15} /> Reject Review
                  </button>
                )}
                <button
                  className="button admin-delete-btn"
                  onClick={() => setDeleteConfirm(selectedReview)}
                  disabled={actionLoading}
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Photo Viewer Modal */}
      {photoModal && (
        <div className="admin-photo-viewer-backdrop" onClick={() => setPhotoModal(null)}>
          <div className="admin-photo-viewer-card" onClick={e => e.stopPropagation()}>
            <button className="photo-viewer-close" onClick={() => setPhotoModal(null)}>✕</button>
            <img src={photoModal} alt="Enlarged review photo" />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="admin-confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon-wrap">
              <AlertTriangle size={32} />
            </div>
            <h3>Delete this review?</h3>
            <p>
              Are you sure you want to permanently delete the review from <strong>{deleteConfirm.customer_name}</strong>?
              This action cannot be undone.
            </p>
            <div className="confirm-buttons">
              <button
                className="button button-light"
                onClick={() => setDeleteConfirm(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="button admin-danger-btn"
                onClick={() => handleDelete(deleteConfirm.id)}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Yes, Delete Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
