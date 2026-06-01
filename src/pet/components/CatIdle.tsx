export default function CatIdle() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left ear */}
      <path d="M18 28 L14 12 L26 22" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Right ear */}
      <path d="M46 28 L50 12 L38 22" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Head */}
      <ellipse cx="32" cy="34" rx="16" ry="14" stroke="#333" strokeWidth="2.5" fill="none" />
      {/* Eyes */}
      <circle cx="26" cy="32" r="2" fill="#333" />
      <circle cx="38" cy="32" r="2" fill="#333" />
      {/* Nose */}
      <path d="M31 37 L32 38 L33 37" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Whiskers */}
      <line x1="16" y1="36" x2="24" y2="35" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="16" y1="38" x2="24" y2="38" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="40" y1="35" x2="48" y2="36" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="40" y1="38" x2="48" y2="38" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
      {/* Body */}
      <ellipse cx="32" cy="52" rx="12" ry="8" stroke="#333" strokeWidth="2.5" fill="none" />
      {/* Tail (animated) */}
      <g className="cat-idle-tail">
        <path d="M44 52 Q54 48 52 40" stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
