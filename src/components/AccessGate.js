import React, { useCallback, useEffect, useState } from 'react';
import { fetchAuthSession, login } from '../services/authService';
import './AccessGate.css';

export default function AccessGate({ children }) {
  const [state, setState] = useState({
    loading: true,
    required: false,
    authenticated: false
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      setState({
        loading: false,
        required: !!session.required,
        authenticated: !!session.authenticated
      });
    } catch (e) {
      setState({ loading: false, required: true, authenticated: false });
      setError(e.message || 'Could not reach the server');
    }
  }, []);

  useEffect(() => {
    refreshSession();
    const onUnauthorized = () => {
      setState((prev) => ({ ...prev, authenticated: false }));
      setError('Session expired. Sign in again.');
    };
    window.addEventListener('ytf-unauthorized', onUnauthorized);
    return () => window.removeEventListener('ytf-unauthorized', onUnauthorized);
  }, [refreshSession]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(password);
      setPassword('');
      await refreshSession();
    } catch (e) {
      setError(e.message || 'Wrong password');
    } finally {
      setSubmitting(false);
    }
  };

  if (state.loading) {
    return (
      <div className="access-gate">
        <p className="access-gate-status">Checking access…</p>
      </div>
    );
  }

  if (!state.required || state.authenticated) {
    return children;
  }

  return (
    <div className="access-gate">
      <form className="access-gate-card" onSubmit={handleSubmit}>
        <h1>YouTube Transcript Tool</h1>
        <p className="access-gate-lead">Enter the shared password to continue.</p>
        <label className="access-gate-label" htmlFor="access-password">
          Password
        </label>
        <input
          id="access-password"
          type="password"
          className="access-gate-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          disabled={submitting}
        />
        {error ? <p className="access-gate-error">{error}</p> : null}
        <button type="submit" className="access-gate-button" disabled={submitting || !password}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
