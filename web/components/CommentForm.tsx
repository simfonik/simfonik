'use client';

import { useState, FormEvent } from 'react';

type CommentFormProps = {
  tapeId: string;
};

export function CommentForm({ tapeId }: CommentFormProps) {
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [content, setContent] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const charCount = content.length;
  const maxChars = 5000;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/comments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tapeId,
          authorName,
          authorEmail,
          content,
          website
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        // Clear form
        setAuthorName('');
        setAuthorEmail('');
        setContent('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit comment' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to submit comment' });
    } finally {
      setSubmitting(false);
    }
  };

  const labelClasses =
    'block font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-2';
  const inputClasses =
    'font-mono w-full border-[1.5px] border-[var(--text)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:bg-[var(--surface)]';

  return (
    <form onSubmit={handleSubmit} className="space-y-5 mb-10">
      {/* Honeypot field - hidden from users */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        style={{ display: 'none' }}
        tabIndex={-1}
        autoComplete="off"
      />

      <div>
        <label htmlFor="authorName" className={labelClasses}>
          Name <span className="text-[var(--accent-text)]">*</span>
        </label>
        <input
          type="text"
          id="authorName"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          required
          maxLength={100}
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="authorEmail" className={labelClasses}>
          Email <span className="lowercase tracking-normal text-[var(--muted)]">(optional)</span>
        </label>
        <input
          type="email"
          id="authorEmail"
          value={authorEmail}
          onChange={(e) => setAuthorEmail(e.target.value)}
          maxLength={255}
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="content" className={labelClasses}>
          Comment <span className="text-[var(--accent-text)]">*</span>
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          minLength={10}
          maxLength={maxChars}
          rows={6}
          className={`${inputClasses} resize-y`}
        />
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)] mt-2">
          {charCount} / {maxChars} characters
        </div>
      </div>

      {message && (
        <div
          className={`font-mono text-[11px] uppercase tracking-[0.18em] px-3 py-2 border-[1.5px] ${
            message.type === 'success'
              ? 'border-[var(--text)] text-[var(--text)]'
              : 'border-red-500 text-red-500'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || charCount < 10}
        className="poster-btn"
      >
        {submitting ? 'Submitting…' : 'Post Comment'}
      </button>
    </form>
  );
}
