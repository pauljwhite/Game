interface Props { color?: string; className?: string }

export function RegionalTurboprop({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      {/* Shorter, rounder fuselage - high wing aircraft */}
      <ellipse cx="105" cy="48" rx="75" ry="9" fill={color} />
      <ellipse cx="178" cy="48" rx="6" ry="6" fill={color} />
      <polygon points="30,48 42,42 42,54" fill={color} />
      {/* Vertical tail */}
      <polygon points="34,48 34,22 52,38" fill={color} />
      {/* Horizontal stabilizer */}
      <polygon points="32,46 32,50 56,38 56,58" fill={color} />
      {/* HIGH WING - mounted on top of fuselage */}
      <polygon points="108,40 105,43 68,36 64,32 105,38" fill={color} />
      <polygon points="108,40 105,37 68,30 64,34 105,42" fill={color} />
      {/* Turboprop engines with prop discs */}
      {/* Left engine */}
      <ellipse cx="78" cy="33" rx="6" ry="3" fill={color} opacity="0.85" />
      <circle cx="74" cy="33" r="7" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
      <line x1="74" y1="26" x2="74" y2="40" stroke={color} strokeWidth="1.5" opacity="0.7" />
      <line x1="67" y1="33" x2="81" y2="33" stroke={color} strokeWidth="1.5" opacity="0.7" />
      {/* Right engine */}
      <ellipse cx="78" cy="47" rx="6" ry="3" fill={color} opacity="0.85" />
      <circle cx="74" cy="47" r="7" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7" />
      <line x1="74" y1="40" x2="74" y2="54" stroke={color} strokeWidth="1.5" opacity="0.7" />
      <line x1="67" y1="47" x2="81" y2="47" stroke={color} strokeWidth="1.5" opacity="0.7" />
      {[148,158,168].map(x => (
        <rect key={x} x={x} y="45" width="5" height="5" fill="white" opacity="0.4" />
      ))}
    </svg>
  );
}
