import React from 'react';

interface Props {
  logo: string | null | undefined;
  className?: string;
  imageClassName?: string;
}

export function isUploadedLogo(logo: string | null | undefined): boolean {
  return typeof logo === 'string' && logo.startsWith('data:image/');
}

export const AirlineLogo: React.FC<Props> = ({ logo, className = 'text-lg', imageClassName }) => {
  const value = logo || '✈';

  if (isUploadedLogo(value)) {
    return (
      <img
        src={value}
        alt=""
        className={imageClassName ?? 'h-7 w-7 rounded-full object-cover border border-white/10 bg-white/10'}
      />
    );
  }

  return <span className={className}>{value}</span>;
};
