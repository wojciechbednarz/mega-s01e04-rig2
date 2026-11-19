import type { ReadNight } from './types.js';

// Stub so § 2 can typecheck against the contract; the reader lands in the commit that closes #1.
export const readNight: ReadNight = () => {
  throw new Error('not implemented: #1');
};
