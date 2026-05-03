interface Props { color?: string; className?: string }

export function WideTwin({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      {/* Wider, fatter fuselage */}
      <ellipse cx="100" cy="40" rx="87" ry="13" fill={color} />
      <ellipse cx="185" cy="40" rx="7" ry="9" fill={color} />
      <polygon points="13,40 27,29 27,51" fill={color} />
      {/* Vertical tail */}
      <polygon points="18,40 18,12 42,30" fill={color} />
      {/* Horizontal stabilizer */}
      <polygon points="16,37 16,43 46,26 46,54" fill={color} />
      {/* Long swept wings */}
      <polygon points="116,40 113,46 62,62 55,56 110,38" fill={color} />
      <polygon points="116,40 113,34 62,18 55,24 110,42" fill={color} />
      {/* Winglets */}
      <line x1="55" y1="56" x2="50" y2="49" stroke={color} strokeWidth="3" />
      <line x1="55" y1="24" x2="50" y2="31" stroke={color} strokeWidth="3" />
      {/* 2 large underwing engines */}
      <ellipse cx="82" cy="65" rx="16" ry="6" fill={color} opacity="0.85" />
      <ellipse cx="82" cy="15" rx="16" ry="6" fill={color} opacity="0.85" />
      {[140,152,164,174].map(x => (
        <rect key={x} x={x} y="36" width="6" height="7" fill="white" opacity="0.4" />
      ))}
    </svg>
  );
}
