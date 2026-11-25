'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Key, ShieldCheck, AlertCircle, ArrowRight, ArrowLeft, Eye, EyeOff, Loader } from 'lucide-react';

const api = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingExisting, setCheckingExisting] = useState(true);
  const submitBtnRef = useRef(null);

  // Check if already authenticated
  useEffect(() => {
    const existingToken = sessionStorage.getItem('dearmisu_admin_token');
    if (!existingToken) {
      setCheckingExisting(false);
      return;
    }

    // Verify token with backend
    fetch(`${api}/api/admin/verify`, {
      headers: { 'Authorization': `Bearer ${existingToken}` }
    })
      .then(res => {
        if (res.ok) {
          router.replace('/admin/reviews');
        } else {
          sessionStorage.removeItem('dearmisu_admin_token');
          sessionStorage.removeItem('dearmisu_admin_role');
          setCheckingExisting(false);
        }
      })
      .catch(() => {
        // Network error — clear possibly stale token and show login
        sessionStorage.removeItem('dearmisu_admin_token');
        sessionStorage.removeItem('dearmisu_admin_role');
        setCheckingExisting(false);
      });
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    // Frontend validation
    if (!cleanUsername) {
      setError('Please enter your administrator username.');
      return;
    }
    if (!cleanPassword) {
      setError('Please enter your password.');
      return;
    }
    if (cleanPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${api}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          secretKey: cleanPassword
        })
      });

      let data;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        // Got HTML back (e.g. Next.js page instead of API) — API proxy misconfigured
        throw new Error(
          'Unable to reach the authentication server. Please ensure the backend API is running.'
        );
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Access denied. Invalid administrator credentials.');
      }

      // Store session token securely (sessionStorage — cleared when browser/tab closes)
      sessionStorage.setItem('dearmisu_admin_token', data.token);
      sessionStorage.setItem('dearmisu_admin_role', data.admin?.role || 'administrator');

      // Navigate to Review Management
      router.push('/admin/reviews');
    } catch (err) {
      if (err.message.includes('fetch') || err.message.includes('NetworkError') || err.message.includes('Failed')) {
        setError('Unable to connect to the authentication server. Please check that the backend is running on ' + (api || 'the configured URL') + '.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="admin-auth-screen">
        <div className="admin-auth-loading">
          <div className="review-spinner" style={{ width: 28, height: 28, borderColor: 'rgba(214, 173, 112, 0.3)', borderTopColor: '#c6a36a' }} />
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 12 }}>Verifying session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-auth-screen">
      <div className="admin-auth-card">
        <div className="admin-auth-badge">
          <img src="/images/dear-misu-badge.webp" alt="Dear Misu" width={52} height={52} />
        </div>

        <div className="admin-auth-header-copy">
          <span className="admin-auth-portal-tag">
            <ShieldCheck size={13} /> PRIVATE ADMINISTRATOR PORTAL
          </span>
          <h2>Dear Misu Management</h2>
          <p className="admin-auth-desc">
            Please authenticate to access customer reviews, ratings & moderation controls.
          </p>
        </div>

        <form onSubmit={handleLogin} className="admin-auth-form" noValidate>
          <div className="admin-form-field">
            <label htmlFor="admin-user-input">Administrator Username</label>
            <div className="admin-auth-input-wrap">
              <Lock size={15} className="admin-key-icon" />
              <input
                id="admin-user-input"
                type="text"
                required
                value={username}
                onChange={e => { setUsername(e.target.value); if (error) setError(''); }}
                placeholder="admin"
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          <div className="admin-form-field">
            <label htmlFor="admin-key-input">Password</label>
            <div className="admin-auth-input-wrap">
              <Key size={15} className="admin-key-icon" />
              <input
                id="admin-key-input"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter your admin password"
                autoFocus
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="admin-pw-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="admin-auth-error-banner" role="alert">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <button
            ref={submitBtnRef}
            type="submit"
            className="button button-dark button-full admin-auth-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={16} className="spinning" /> Authenticating...
              </>
            ) : (
              <>
                Sign In <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="admin-auth-footer">
          <Link href="/" className="admin-back-link">
            <ArrowLeft size={13} /> Return to Dear Misu
          </Link>
        </div>
      </div>
    </div>
  );
}
