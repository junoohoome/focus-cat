export default function CatPaused() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head (tilted) */}
      <ellipse cx="32" cy="26" rx="14" ry="12" stroke="#333" strokeWidth="2.5" fill="none" />
      {/* Left ear */}
      <path d="M20 20 L16 6 L28 16" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Right ear */}
      <path d="M44 20 L48 6 L36 16" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Half-closed eyes */}
      <path d="M23 24 Q26 22 29 24" stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M35 24 Q38 22 41 24" stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Nose */}
      <path d="M31 28 L32 29 L33 28" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Body lying down */}
      <ellipse cx="32" cy="42" rx="18" ry="8" stroke="#333" strokeWidth="2.5" fill="none" />
      {/* Tail */}
      <path d="M50 42 Q56 38 52 32" stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Zzz floating text */}
      <text className="cat-paused-zzz" x="44" y="14" fill="#999" fontSize="10" fontFamily="sans-serif">z</text>
      <text className="cat-paused-zzz-delay" x="50" y="8" fill="#999" fontSize="8" fontFamily="sans-serif">z</text>
    </svg>
  );
}
