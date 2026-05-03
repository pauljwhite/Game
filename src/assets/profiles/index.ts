import type { ProfileId } from '@/types/aircraft';
import type { ComponentType } from 'react';
import { NarrowClassic } from './NarrowClassic';
import { NarrowTrijet } from './NarrowTrijet';
import { NarrowModern } from './NarrowModern';
import { NarrowRearTwin } from './NarrowRearTwin';
import { NarrowRearTri } from './NarrowRearTri';
import { RegionalTurboprop } from './RegionalTurboprop';
import { RegionalJet } from './RegionalJet';
import { WideTwin } from './WideTwin';
import { WideQuad } from './WideQuad';
import { WideA380 } from './WideA380';

interface ProfileProps { color?: string; className?: string }

export const PROFILE_MAP: Record<ProfileId, ComponentType<ProfileProps>> = {
  'narrow-classic': NarrowClassic,
  'narrow-trijet': NarrowTrijet,
  'narrow-modern': NarrowModern,
  'narrow-rear-twin': NarrowRearTwin,
  'narrow-rear-tri': NarrowRearTri,
  'regional-turboprop': RegionalTurboprop,
  'regional-jet': RegionalJet,
  'wide-twin': WideTwin,
  'wide-quad': WideQuad,
  'wide-a380': WideA380,
};

export {
  NarrowClassic, NarrowTrijet, NarrowModern, NarrowRearTwin, NarrowRearTri,
  RegionalTurboprop, RegionalJet, WideTwin, WideQuad, WideA380,
};
