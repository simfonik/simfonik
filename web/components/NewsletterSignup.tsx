'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

function useNewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Something went wrong.');
        return;
      }

      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  }

  return { email, setEmail, status, errorMessage, handleSubmit };
}

export function NewsletterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { email, setEmail, status, errorMessage, handleSubmit } = useNewsletterForm();

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-md p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {status === 'success' ? (
          <div className="text-center py-4">
            <p className="text-xl font-semibold text-[var(--text)] mb-2">You&apos;re now subscribed!</p>
            <p className="text-sm text-[var(--muted)]">We&apos;ll let you know when new tapes are added.</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-[var(--text)] mb-1">
              Get notified when new tapes drop.
            </h2>
            <p className="text-sm text-[var(--muted)] mb-6">
              No spam. Just new recordings added to the archive.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/40 focus:outline-none transition-all"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full rounded-md bg-[var(--accent)] py-2.5 text-sm text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {status === 'loading' ? 'Joining...' : 'Join'}
              </button>
            </form>
            <p className={`mt-3 text-xs text-center h-4 transition-opacity ${status === 'error' ? 'text-red-500 opacity-100' : 'opacity-0'}`}>
              {errorMessage || '\u00A0'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function NewsletterFooter() {
  const { email, setEmail, status, errorMessage, handleSubmit } = useNewsletterForm();

  if (status === 'success') {
    return (
      <div className="text-center">
        <p className="text-xl font-semibold text-[var(--text)] mb-1">You&apos;re now subscribed!</p>
        <p className="text-sm text-[var(--muted)]">We&apos;ll let you know when new tapes are added.</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h3 className="text-lg font-semibold text-[var(--text)] mb-1">
        Get notified when new tapes drop.
      </h3>
      <p className="text-sm text-[var(--muted)] mb-5">
        No spam. Just new recordings added to the archive.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto">
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full sm:flex-1 rounded-md border border-[var(--accent)]/30 bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/40 focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full sm:w-auto rounded-md bg-[var(--accent)] px-8 py-2.5 text-sm text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          {status === 'loading' ? 'Joining...' : 'Join'}
        </button>
      </form>
      <p className={`mt-3 text-xs text-center h-4 transition-opacity ${status === 'error' ? 'text-red-500 opacity-100' : 'opacity-0'}`}>
        {errorMessage || '\u00A0'}
      </p>
    </div>
  );
}

export function useNewsletterModal() {
  const [open, setOpen] = useState(false);
  const onClose = useCallback(() => setOpen(false), []);
  const onOpen = useCallback(() => setOpen(true), []);
  return { open, onOpen, onClose };
}
