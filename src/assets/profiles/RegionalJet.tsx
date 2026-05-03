interface Props { color?: string; className?: string }

export function RegionalJet({ color = 'currentColor', className }: Props) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ color }}>
      {/* Shorter fuselage */}
      <ellipse cx="102" cy="40" rx="78" ry="9" fill={color} />
      <ellipse cx="178" cy="40" rx="6" ry="7" fill={color} />
      <polygon points="24,40 36,33 36,47" fill={color} />
      {/* Vertical tail */}
      <polygon points="28,40 28,18 48,32" fill={color} />
      {/* Horizontal stabilizer */}
      <polygon points="26,38 26,42 52,28 52,52" fill={color} />
      {/* Wings with noticeable winglets */}
      <polygon points="114,40 111,45 70,56 65,51 109,38" fill={color} />
      <polygon points="114,40 111,35 70,24 65,29 109,42" fill={color} />
      {/* Winglets */}
      <line x1="65" y1="51" x2="60" y2="44" stroke={color} strokeWidth="3" />
      <line x1="65" y1="29" x2="60" y2="36" stroke={color} strokeWidth="3" />
      {/* Under-wing CFM/PW engines - slightly larger diameter ratio */}
      <ellipse cx="86" cy="58" rx="12" ry="5" fill={color} opacity="0.85" />
      <ellipse cx="86" cy="22" rx="12" ry="5" fill={color} opacity="0.85" />
      {[145,155,165].map(x => (
        <rect key={x} x={x} y="37" width="5" height="5" fill="white" opacity="0.4" />
      ))}
    </svg>
  );
}
