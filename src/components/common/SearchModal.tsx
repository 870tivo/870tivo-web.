import { useState } from 'react';

export default function SearchModal() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-brand-ink dark:text-brand-darkInk hover:text-brand-orange dark:hover:text-brand-bg transition-colors flex items-center justify-center w-6 h-6 p-1 rounded"
                aria-label="Buscar"
                title="Buscar"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 bg-brand-ink/80 dark:bg-black/80 backdrop-blur-sm">
                    <div className="bg-brand-card dark:bg-brand-darkCard text-brand-ink dark:text-brand-darkInk w-full max-w-2xl rounded-xl border border-brand-ink/10 dark:border-white/10 p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 text-brand-muted hover:text-brand-ink dark:hover:text-white"
                            aria-label="Cerrar modal"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>

                        <h2 className="font-serif text-2xl font-bold text-brand-ink dark:text-white mb-4">Buscar en 870tivo</h2>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Ej: Pájaro muerto, Ciclo de cine..."
                            className="w-full bg-brand-bg/50 dark:bg-brand-ink border border-brand-ink/20 dark:border-white/10 rounded-lg py-3 px-4 text-brand-ink dark:text-white placeholder-brand-muted focus:outline-none focus:border-brand-turquoise dark:focus:border-brand-bg"
                        />
                        <div className="mt-8 text-center text-brand-muted text-sm pb-2">
                            Ingresa un término para buscar o presiona ESC para salir.
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
