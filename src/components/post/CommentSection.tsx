import { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CommentRow {
  id: string;
  post_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface Props {
  postId: string;
  postSlug: string;
  initialLikes: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'hace un momento';
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours} h`;
    if (diffDays === 1) return 'ayer';
    if (diffDays < 30) return `hace ${diffDays} días`;
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommentSection({ postId, postSlug, initialLikes }: Props) {
  // ── Likes state ──
  const [likes, setLikes] = useState(initialLikes);
  const [hasLiked, setHasLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  // ── Comments state ──
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);

  // ── Form state ──
  const [authorName, setAuthorName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ── On mount: check localStorage + load comments ──
  useEffect(() => {
    if (!postSlug || !postId) return;

    // Restore like state from localStorage
    try {
      const hasLikedStored = localStorage.getItem(`liked_post_${postSlug}`) === '1';
      setHasLiked(hasLikedStored);
    } catch {
      // localStorage blocked (private mode, etc.)
    }

    // Load existing comments
    setIsLoadingComments(true);
    fetch(`/api/posts/comments?postId=${encodeURIComponent(postId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.comments)) {
          setComments(data.comments);
        }
      })
      .catch(() => {/* silent */})
      .finally(() => setIsLoadingComments(false));
  }, [postId, postSlug]);

  // ── Like toggle ──
  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);

    const action = hasLiked ? 'unlike' : 'like';
    const newHasLiked = !hasLiked;

    // Optimistic update
    setHasLiked(newHasLiked);
    setLikes((prev) => (newHasLiked ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await fetch('/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: postSlug, action }),
      });
      const data = await res.json();

      if (data.success && typeof data.likes === 'number') {
        // Use server value
        setLikes(data.likes);
        try {
          if (newHasLiked) {
            localStorage.setItem(`liked_post_${postSlug}`, '1');
          } else {
            localStorage.removeItem(`liked_post_${postSlug}`);
          }
        } catch {/* silent */}
      } else {
        // Revert optimistic update
        setHasLiked(!newHasLiked);
        setLikes((prev) => (!newHasLiked ? prev + 1 : Math.max(0, prev - 1)));
      }
    } catch {
      // Revert on network error
      setHasLiked(!newHasLiked);
      setLikes((prev) => (!newHasLiked ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setIsLiking(false);
    }
  };

  // ── Comment submit ──
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess(false);

    const cleanName = authorName.trim();
    const cleanContent = commentText.trim();

    if (!cleanName) {
      setSubmitError('Por favor ingresa tu nombre o apodo.');
      return;
    }
    if (cleanName.length > 60) {
      setSubmitError('El nombre no puede superar 60 caracteres.');
      return;
    }
    if (cleanContent.length < 5) {
      setSubmitError('El comentario debe tener al menos 5 caracteres.');
      return;
    }
    if (cleanContent.length > 1000) {
      setSubmitError('El comentario no puede superar 1000 caracteres.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/posts/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, author_name: cleanName, content: cleanContent }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al publicar el comentario.');
      }

      // Prepend the new comment at the top of the list
      if (data.comment) {
        setComments((prev) => [data.comment, ...prev]);
      }

      setCommentText('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (err: any) {
      setSubmitError(err.message || 'No se pudo publicar el comentario. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 mb-24">

      {/* ── Likes Section ── */}
      <div className="flex items-center justify-center sm:justify-start gap-6 mb-16 border-b border-brand-ink/10 dark:border-white/10 pb-12">
        <button
          onClick={handleLike}
          disabled={isLiking}
          aria-label={hasLiked ? 'Quitar me gusta' : 'Dar me gusta'}
          className={`inline-flex items-center gap-3 text-xs font-bold uppercase tracking-widest px-5 py-3 rounded-md border transition-all duration-200 group select-none ${
            hasLiked
              ? 'bg-brand-orange/10 dark:bg-brand-orange/15 border-brand-orange text-brand-orange'
              : 'bg-brand-card dark:bg-brand-darkCard border-brand-ink/10 dark:border-white/5 text-brand-ink dark:text-white hover:border-brand-orange dark:hover:border-brand-orange hover:text-brand-orange'
          } ${isLiking ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={hasLiked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-all duration-200 ${!hasLiked ? 'group-hover:fill-current' : ''}`}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          Me gusta
        </button>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-card dark:bg-brand-darkCard border border-brand-ink/10 dark:border-white/5 flex items-center justify-center text-[10px] text-brand-ink dark:text-brand-muted font-bold tabular-nums transition-all duration-200">
            {likes}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/60 dark:text-brand-muted">
            Me gusta{likes !== 1 ? '(s)' : ''}
          </span>
        </div>
      </div>

      {/* ── Comment Form ── */}
      <div className="bg-brand-card/50 dark:bg-neutral-900/50 p-6 md:p-8 rounded-xl border border-brand-ink/10 dark:border-white/5">
        <h3 className="font-serif text-2xl font-bold text-brand-ink dark:text-white mb-6">
          ¿Quieres decir algo?
        </h3>

        <form onSubmit={handleSubmitComment} noValidate className="space-y-3">
          {/* Author name */}
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Tu nombre o apodo (ej: María G.)"
            maxLength={60}
            disabled={isSubmitting}
            className="w-full bg-brand-bg/40 dark:bg-black/50 text-brand-ink dark:text-white placeholder-brand-muted text-sm rounded-lg border border-brand-ink/10 dark:border-white/10 px-4 py-3 focus:outline-none focus:border-brand-orange dark:focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all disabled:opacity-60"
          />

          {/* Comment textarea */}
          <div className="bg-brand-bg/40 dark:bg-black/50 rounded-lg border border-brand-ink/10 dark:border-white/10 p-4 focus-within:border-brand-orange dark:focus-within:border-brand-orange focus-within:ring-1 focus-within:ring-brand-orange transition-all">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={isSubmitting}
              maxLength={1000}
              className="w-full bg-transparent text-brand-ink dark:text-white placeholder-brand-muted text-sm resize-none focus:outline-none min-h-[120px] disabled:opacity-60"
              placeholder="Escribe un comentario..."
            />
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-ink/10 dark:border-white/10">
              <span className={`text-[10px] tabular-nums transition-colors ${commentText.length > 900 ? 'text-brand-orange font-semibold' : 'text-brand-muted'}`}>
                {commentText.length}/1000
              </span>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`text-xs font-bold uppercase tracking-widest bg-brand-orange text-white px-6 py-2.5 rounded-sm hover:brightness-110 transition-all duration-300 ${isSubmitting ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
              >
                {isSubmitting ? 'Enviando...' : 'Comentar'}
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {submitError && (
            <p className="text-xs text-red-400 font-medium flex items-center gap-1.5">
              <span>✕</span>
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <span>✓</span>
              Comentario publicado exitosamente.
            </p>
          )}
        </form>
      </div>

      {/* ── Comments List ── */}
      {(isLoadingComments || comments.length > 0) && (
        <div className="mt-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5 border-b border-brand-ink/10 dark:border-white/10 pb-4">
            <h4 className="font-serif text-lg font-bold text-brand-ink dark:text-white">
              Comentarios
            </h4>
            {!isLoadingComments && comments.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
                {comments.length}
              </span>
            )}
          </div>

          {/* Loading skeleton */}
          {isLoadingComments ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-brand-card/30 dark:bg-neutral-900/30 border border-brand-ink/5 dark:border-white/5"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-brand-ink/10 dark:bg-white/10" />
                    <div className="h-3 w-28 bg-brand-ink/10 dark:bg-white/10 rounded" />
                    <div className="h-3 w-16 bg-brand-ink/5 dark:bg-white/5 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 bg-brand-ink/5 dark:bg-white/5 rounded w-full" />
                    <div className="h-3 bg-brand-ink/5 dark:bg-white/5 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="p-4 sm:p-5 rounded-xl bg-brand-card/30 dark:bg-neutral-900/40 border border-brand-ink/5 dark:border-white/5 transition-all"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar inicial */}
                    <div className="w-8 h-8 rounded-full bg-brand-darkCard dark:bg-neutral-800 border border-brand-ink/10 dark:border-white/10 flex items-center justify-center text-[11px] font-bold text-brand-muted dark:text-neutral-400 shrink-0 select-none">
                      {getInitials(c.author_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Autor y fecha */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs font-bold text-brand-ink dark:text-white">
                          {c.author_name}
                        </span>
                        <span className="text-[11px] text-brand-muted dark:text-neutral-500 font-medium">
                          {getRelativeTime(c.created_at)}
                        </span>
                      </div>
                      {/* Contenido */}
                      <p className="text-sm text-brand-ink/80 dark:text-brand-muted leading-relaxed whitespace-pre-wrap break-words">
                        {c.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state: no comments yet and not loading */}
      {!isLoadingComments && comments.length === 0 && (
        <p className="mt-8 text-center text-xs text-brand-muted dark:text-neutral-500 font-medium">
          Sé el primero en dejar un comentario en esta publicación.
        </p>
      )}

    </div>
  );
}
