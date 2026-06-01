export default function CatBreak() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left ear */}
      <path d="M18 26 L14 10 L26 20" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Right ear */}
      <path d="M46 26 L50 10 L38 20" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <g className="cat-break-head">
        {/* Head */}
        <ellipse cx="32" cy="32" rx="16" ry="14" stroke="#333" strokeWidth="2.5" fill="none" />
        {/* Big open eyes (alert) */}
        <circle cx="26" cy="30" r="3" fill="#333" />
        <circle cx="38" cy="30" r="3" fill="#333" />
        {/* Eye highlights */}
        <circle cx="27" cy="29" r="1" fill="#fff" />
        <circle cx="39" cy="29" r="1" fill="#fff" />
        {/* Nose */}
        <path d="M31 35 L32 36 L33 35" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Mouth (happy) */}
        <path d="M28 38 Q32 42 36 38" stroke="#333" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Whiskers */}
        <line x1="16" y1="34" x2="24" y2="33" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="16" y1="36" x2="24" y2="36" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="40" y1="33" x2="48" y2="34" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="40" y1="36" x2="48" y2="36" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      {/* Body */}
      <ellipse cx="32" cy="50" rx="12" ry="8" stroke="#333" strokeWidth="2.5" fill="none" />
      {/* Front paws up (stretching) */}
      <path d="M22 48 L16 42" stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M42 48 L48 42" stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Tail up */}
      <path d="M44 50 Q52 46 50 38" stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
