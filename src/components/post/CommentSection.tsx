import React, { useState } from 'react';

export default function CommentSection() {
    const [likes, setLikes] = useState(1);
    const [hasLiked, setHasLiked] = useState(false);
    const [comment, setComment] = useState("");

    const handleLike = () => {
        if (hasLiked) {
            setLikes(likes - 1);
            setHasLiked(false);
        } else {
            setLikes(likes + 1);
            setHasLiked(true);
        }
    };

    const handleDisplayAlert = () => {
        alert("Comentarios deshabilitados en esta demo.");
        setComment("");
    };

    return (
        <div className="max-w-3xl mx-auto px-4 md:px-6 mb-24">
            <div className="flex items-center justify-center sm:justify-start gap-6 mb-16 border-b border-brand-ink/10 dark:border-white/10 pb-12">
                <button
                    onClick={handleLike}
                    className={`inline-flex items-center gap-3 text-xs font-bold uppercase tracking-widest px-5 py-3 rounded-md border transition-colors group ${
                        hasLiked
                            ? 'bg-brand-orange/10 dark:bg-brand-bg/10 border-brand-orange dark:border-brand-bg text-brand-orange dark:text-brand-bg'
                            : 'bg-brand-card dark:bg-brand-darkCard border-brand-ink/10 dark:border-white/5 text-brand-ink dark:text-white hover:border-brand-orange dark:hover:border-brand-bg hover:text-brand-orange dark:hover:text-brand-bg'
                    }`}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={hasLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:fill-current">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    Me gusta
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-card dark:bg-brand-darkCard border border-brand-ink/10 dark:border-white/5 flex items-center justify-center text-[10px] text-brand-ink dark:text-brand-muted font-bold">
                        {likes}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/60 dark:text-brand-muted">Me gusta(s)</span>
                </div>
            </div>

            <div className="bg-brand-card/50 dark:bg-neutral-900/50 p-6 md:p-8 rounded-xl border border-brand-ink/10 dark:border-white/5">
                <h3 className="font-serif text-2xl font-bold text-brand-ink dark:text-white mb-6">¿Quieres decir algo?</h3>
                <div className="bg-brand-bg/40 dark:bg-black/50 rounded-lg border border-brand-ink/10 dark:border-white/10 p-4 focus-within:border-brand-orange dark:focus-within:border-brand-bg focus-within:ring-1 focus-within:ring-brand-orange dark:focus-within:ring-brand-bg transition-all">
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full bg-transparent text-brand-ink dark:text-white placeholder-brand-muted text-sm resize-none focus:outline-none min-h-[120px]"
                        placeholder="Escribe un comentario..."
                    ></textarea>
                    <div className="flex justify-end mt-4 pt-4 border-t border-brand-ink/10 dark:border-white/10">
                        <button
                            onClick={handleDisplayAlert}
                            className="text-xs font-bold uppercase tracking-widest bg-brand-orange text-white dark:bg-white/10 dark:text-brand-muted dark:hover:text-black dark:hover:bg-white px-6 py-2.5 rounded-sm hover:brightness-105 transition-all duration-300"
                        >
                            Comentar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
