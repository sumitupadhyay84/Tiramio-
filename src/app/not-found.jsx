import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#2b160f',
      color: '#f8f0e3',
      fontFamily: 'serif',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '48px', margin: 0, color: '#c6a36a' }}>404</h1>
      <p style={{ fontSize: '18px', margin: '12px 0 24px' }}>This sweet slice could not be found.</p>
      <Link href="/" style={{
        padding: '10px 20px',
        background: '#c6a36a',
        color: '#2b160f',
        borderRadius: '8px',
        textDecoration: 'none',
        fontWeight: 'bold',
        fontSize: '14px'
      }}>
        Return Home
      </Link>
    </div>
  );
}

