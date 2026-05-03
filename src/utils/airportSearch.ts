import type { Airport } from '@/types';

const ICAO_BY_IATA: Record<string, string> = {
  JFK: 'KJFK', LAX: 'KLAX', ORD: 'KORD', ATL: 'KATL', DFW: 'KDFW', DEN: 'KDEN',
  SFO: 'KSFO', SEA: 'KSEA', MIA: 'KMIA', BOS: 'KBOS', EWR: 'KEWR', IAD: 'KIAD',
  LAS: 'KLAS', PHX: 'KPHX', IAH: 'KIAH', MSP: 'KMSP', DTW: 'KDTW', PHL: 'KPHL',
  CLT: 'KCLT', SLC: 'KSLC', MCO: 'KMCO', PDX: 'KPDX', BNA: 'KBNA', AUS: 'KAUS',
  MCI: 'KMCI', RDU: 'KRDU', STL: 'KSTL', MEM: 'KMEM', MSY: 'KMSY', SMF: 'KSMF',
  SAN: 'KSAN', TPA: 'KTPA', HNL: 'PHNL', GUM: 'PGUM', SJU: 'TJSJ',
  YYZ: 'CYYZ', YVR: 'CYVR', YUL: 'CYUL', YYC: 'CYYC', YEG: 'CYEG',
  MEX: 'MMMX', CUN: 'MMUN', GDL: 'MMGL', MTY: 'MMMY',
  LHR: 'EGLL', CDG: 'LFPG', FRA: 'EDDF', AMS: 'EHAM', MAD: 'LEMD', BCN: 'LEBL',
  FCO: 'LIRF', MUC: 'EDDM', IST: 'LTFM', VIE: 'LOWW', ZRH: 'LSZH', BRU: 'EBBR',
  CPH: 'EKCH', OSL: 'ENGM', ARN: 'ESSA', HEL: 'EFHK', LIS: 'LPPT', ATH: 'LGAV',
  WAW: 'EPWA', PRG: 'LKPR', BUD: 'LHBP', GVA: 'LSGG', DUB: 'EIDW', MAN: 'EGCC',
  LGW: 'EGKK', EDI: 'EGPH', HAM: 'EDDH', DUS: 'EDDL', BER: 'EDDB', MXP: 'LIMC',
  NCE: 'LFMN', LYS: 'LFLL', OPO: 'LPPR', SVQ: 'LEZL', KBP: 'UKBB', OTP: 'LROP',
  SOF: 'LBSF', TBS: 'UGTB', RIX: 'EVRA', TLL: 'EETN', VNO: 'EYVI', SVO: 'UUEE',
  LED: 'ULLI',
  HND: 'RJTT', NRT: 'RJAA', KIX: 'RJBB', CTS: 'RJCC', FUK: 'RJFF', NGO: 'RJGG',
  PEK: 'ZBAA', PKX: 'ZBAD', PVG: 'ZSPD', SHA: 'ZSSS', CAN: 'ZGGG', SZX: 'ZGSZ',
  CTU: 'ZUTF', XIY: 'ZLXY', KMG: 'ZPPP', WUH: 'ZHHH', CKG: 'ZUCK', NKG: 'ZSNJ',
  XMN: 'ZSAM', HGH: 'ZSHC', URC: 'ZWWW',
  ICN: 'RKSI', GMP: 'RKSS', PUS: 'RKPK', TPE: 'RCTP', HKG: 'VHHH',
  SIN: 'WSSS', BKK: 'VTBS', KUL: 'WMKK', CGK: 'WIII', MNL: 'RPLL', SGN: 'VVTS',
  HAN: 'VVNB', RGN: 'VYYY',
  DEL: 'VIDP', BOM: 'VABB', MAA: 'VOMM', BLR: 'VOBL', HYD: 'VOHS', CCU: 'VECC',
  CMB: 'VCBI', DAC: 'VGHS', KHI: 'OPKC',
  SYD: 'YSSY', MEL: 'YMML', BNE: 'YBBN', PER: 'YPPH', ADL: 'YPAD', AKL: 'NZAA',
  CHC: 'NZCH',
  DXB: 'OMDB', AUH: 'OMAA', DOH: 'OTHH', RUH: 'OERK', JED: 'OEJN', KWI: 'OKKK',
  MCT: 'OOMS', AMM: 'OJAI', TLV: 'LLBG', CAI: 'HECA', THR: 'OIIE', GYD: 'UBBB',
  TAS: 'UTTT', ALA: 'UAAA', NQZ: 'UACC',
  JNB: 'FAOR', CPT: 'FACT', NBO: 'HKJK', ADD: 'HAAB', LOS: 'DNMM', ABV: 'DNAA',
  ACC: 'DGAA', CMN: 'GMMN', ALG: 'DAAG', TUN: 'DTTA', DAR: 'HTDA', DKR: 'GOOY',
  EBB: 'HUEN',
  GRU: 'SBGR', GIG: 'SBGL', BSB: 'SBBR', SSA: 'SBSV', FOR: 'SBFZ', REC: 'SBRF',
  EZE: 'SAEZ', SCL: 'SCEL', MVD: 'SUMU', ASU: 'SGAS', LPB: 'SLLP', LIM: 'SPJC',
  BOG: 'SKBO', UIO: 'SEQM', CCS: 'SVMI', PTY: 'MPTO', SJO: 'MROC', GUA: 'MGGT',
  HAV: 'MUHA', SDQ: 'MDSD',
  NAN: 'NFFN', PPT: 'NTAA', POM: 'AYPY', NOU: 'NWWW', APW: 'NSFA',
};

export function airportIcao(airport: Airport): string | undefined {
  return airport.icao ?? ICAO_BY_IATA[airport.iata];
}

function normalizeQuery(value: string): string {
  return value.trim().toUpperCase();
}

export function findAirportByQuery(query: string, airports: Record<string, Airport>): Airport | null {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  const directIata = airports[normalized];
  if (directIata) return directIata;

  return Object.values(airports).find((airport) => {
    const icao = airportIcao(airport);
    const fields = [
      airport.iata,
      icao,
      airport.name,
      airport.city,
      airport.country,
      `${airport.city} ${airport.name}`,
    ].filter(Boolean).map(value => value!.toUpperCase());

    return fields.some(value => value === normalized || value.includes(normalized));
  }) ?? null;
}

export function searchAirports(query: string, airports: Record<string, Airport>, limit = 8): Airport[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  return Object.values(airports)
    .filter((airport) => {
      const icao = airportIcao(airport);
      return [airport.iata, icao, airport.name, airport.city, airport.country]
        .filter(Boolean)
        .some(value => value!.toUpperCase().includes(normalized));
    })
    .sort((a, b) => {
      const aIcao = airportIcao(a);
      const bIcao = airportIcao(b);
      const score = (airport: Airport, icao?: string) => {
        if (airport.iata === normalized || icao === normalized) return 0;
        if (airport.iata.startsWith(normalized) || icao?.startsWith(normalized)) return 1;
        if (airport.city.toUpperCase().startsWith(normalized)) return 2;
        if (airport.name.toUpperCase().startsWith(normalized)) return 3;
        return 4;
      };
      return score(a, aIcao) - score(b, bIcao) || a.iata.localeCompare(b.iata);
    })
    .slice(0, limit);
}
