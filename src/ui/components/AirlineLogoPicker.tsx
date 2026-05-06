import React, { useRef, useState } from 'react';
import { AirlineLogo, isUploadedLogo } from './AirlineLogo';

export const AIRLINE_LOGO_OPTIONS = [
  '✈️', '🛫', '🛬', '🌍', '🌎', '🌏', '🌐', '⭐', '🌟', '🌙',
  '☀️', '⚡', '🔥', '💎', '🛡️', '🏔️', '🌊', '❄️', '🍁', '🪷',
  '🦅', '🦁', '🐉', '🪽', '🚀',
];

interface Props {
  value: string;
  onChange: (logo: string) => void;
  showLabel?: boolean;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function shrinkImage(file: File): Promise<string> {
  const original = await readFileAsDataUrl(file);
  if (file.type === 'image/svg+xml') return original;

  const image = new Image();
  image.src = original;
  await image.decode();

  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;

  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL('image/png');
}

export const AirlineLogoPicker: React.FC<Props> = ({ value, onChange, showLabel = true }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    try {
      onChange(await shrinkImage(file));
    } catch {
      setError('Could not read that image.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      {showLabel && <label className="text-gray-300 text-sm block mb-2">Logo</label>}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-12 w-12 rounded-xl border border-white/10 bg-white/[0.07] flex items-center justify-center overflow-hidden">
          <AirlineLogo
            logo={value}
            className="text-3xl leading-none"
            imageClassName="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="apple-button py-2 text-xs"
          >
            Upload logo
          </button>
          {isUploadedLogo(value) && (
            <button
              type="button"
              onClick={() => onChange(AIRLINE_LOGO_OPTIONS[0])}
              className="apple-button py-2 text-xs"
            >
              Use emoji
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => void handleFile(e.target.files?.[0])}
        />
      </div>

      <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
        {AIRLINE_LOGO_OPTIONS.map(option => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`h-9 rounded border text-xl leading-none transition-colors ${
              value === option
                ? 'border-blue-400 bg-blue-500/20'
                : 'border-white/10 bg-white/[0.055] hover:border-white/20'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
};
