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
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to submit comment' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-10">
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
        <label htmlFor="authorName" className="block text-sm font-medium text-[var(--text)] mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="authorName"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          required
          maxLength={100}
          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      <div>
        <label htmlFor="authorEmail" className="block text-sm font-medium text-[var(--text)] mb-1">
          Email <span className="text-sm text-[var(--muted)]">(optional)</span>
        </label>
        <input
          type="email"
          id="authorEmail"
          value={authorEmail}
          onChange={(e) => setAuthorEmail(e.target.value)}
          maxLength={255}
          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-[var(--text)] mb-1">
          Comment <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          minLength={10}
          maxLength={maxChars}
          rows={6}
          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
        />
        <div className="text-sm text-[var(--muted)] mt-1">
          {charCount} / {maxChars} characters
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-md ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
            : 'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || charCount < 10}
        className="px-6 py-2 bg-[#5e6ad2] hover:bg-[#4a56b8] disabled:bg-[var(--muted)] disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
      >
        {submitting ? 'Submitting...' : 'Post Comment'}
      </button>
    </form>
  );
}
