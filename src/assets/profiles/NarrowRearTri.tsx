interface Props { color?: string; className?: string }

export function NarrowRearTri({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      <ellipse cx="100" cy="40" rx="86" ry="10" fill={color} />
      <ellipse cx="184" cy="40" rx="6" ry="7" fill={color} />
      {/* S-duct center engine in tail */}
      <ellipse cx="22" cy="27" rx="9" ry="4" fill={color} opacity="0.85" />
      <rect x="22" y="27" width="4" height="12" fill={color} opacity="0.85" />
      {/* Vertical tail */}
      <polygon points="18,40 18,15 40,30" fill={color} />
      {/* Horizontal stabilizer */}
      <polygon points="18,37 18,43 46,28 46,52" fill={color} />
      {/* Wings */}
      <polygon points="120,40 116,45 74,55 70,50 115,38" fill={color} />
      <polygon points="120,40 116,35 74,25 70,30 115,42" fill={color} />
      {/* 2 flanking rear engines */}
      <ellipse cx="38" cy="30" rx="11" ry="4.5" fill={color} opacity="0.85" />
      <ellipse cx="38" cy="50" rx="11" ry="4.5" fill={color} opacity="0.85" />
      {[145,155,165,175].map(x => (
        <rect key={x} x={x} y="37" width="5" height="5" fill="white" opacity="0.4" />
      ))}
    </svg>
  );
}
