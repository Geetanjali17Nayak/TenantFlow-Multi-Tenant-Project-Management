import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <ShieldAlert size={64} color="var(--accent-primary)" style={{ marginBottom: '16px' }} />
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff' }}>404 - Page Not Found</h1>
      <p style={{ color: 'var(--text-muted)', marginTop: '8px', marginBottom: '24px' }}>
        The page or resource you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
};
