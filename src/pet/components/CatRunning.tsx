export default function CatRunning() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g className="cat-running-body">
        {/* Left ear */}
        <path d="M18 28 L14 12 L26 22" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Right ear */}
        <path d="M46 28 L50 12 L38 22" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Head */}
        <ellipse cx="32" cy="34" rx="16" ry="14" stroke="#333" strokeWidth="2.5" fill="none" />
        {/* Closed eyes (meditating) */}
        <path d="M23 32 Q26 29 29 32" stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M35 32 Q38 29 41 32" stroke="#333" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Nose */}
        <path d="M31 37 L32 38 L33 37" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Body */}
        <ellipse cx="32" cy="52" rx="12" ry="8" stroke="#333" strokeWidth="2.5" fill="none" />
        {/* Tail wrapped around */}
        <path d="M44 52 Q48 56 44 58" stroke="#333" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
