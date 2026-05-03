import React, { useMemo } from 'react';
import type { Airport } from '@/types';
import { airportIcao, findAirportByQuery, searchAirports } from '@/utils/airportSearch';

interface AirportSearchInputProps {
  label: string;
  value: string;
  airports: Record<string, Airport>;
  placeholder?: string;
  onChange: (value: string) => void;
  onSelect: (airport: Airport) => void;
}

export const AirportSearchInput: React.FC<AirportSearchInputProps> = ({
  label,
  value,
  airports,
  placeholder = 'Search name, IATA, or ICAO',
  onChange,
  onSelect,
}) => {
  const selectedAirport = useMemo(() => findAirportByQuery(value, airports), [value, airports]);
  const suggestions = useMemo(() => {
    if (selectedAirport?.iata === value.toUpperCase()) return [];
    return searchAirports(value, airports);
  }, [airports, selectedAirport, value]);

  return (
    <div>
      <label className="text-gray-300 text-sm block mb-1">{label}</label>
      <input
        className={`w-full bg-gray-800 border rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 ${
          value.trim().length > 0 && !selectedAirport ? 'border-red-600' : 'border-gray-600'
        }`}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={() => {
          const airport = findAirportByQuery(value, airports);
          if (airport) onSelect(airport);
        }}
        placeholder={placeholder}
      />
      {selectedAirport ? (
        <p className="text-xs text-gray-400 mt-1">
          {selectedAirport.iata} / {airportIcao(selectedAirport) ?? 'ICAO n/a'} - {selectedAirport.name}, {selectedAirport.city}
        </p>
      ) : value.trim().length > 0 ? (
        <p className="text-xs text-red-400 mt-1">Airport not found</p>
      ) : null}
      {suggestions.length > 0 && (
        <div className="mt-1 max-h-32 overflow-y-auto rounded border border-gray-700 bg-gray-900">
          {suggestions.map(airport => (
            <button
              key={airport.iata}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(airport);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
            >
              <span className="font-mono text-blue-300">{airport.iata}</span>
              <span className="font-mono text-gray-500 ml-2">{airportIcao(airport) ?? '----'}</span>
              <span className="ml-2">{airport.name}, {airport.city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
