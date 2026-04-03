import type { LiveEvalBucket } from '../types.js';

export function bucketEval(
  evalCp: number,
  previous?: LiveEvalBucket | null,
): LiveEvalBucket {
  if (previous === 'white_winning') {
    if (evalCp >= 80) {
      return 'white_winning';
    }

    if (evalCp >= 30) {
      return 'white_better';
    }

    if (evalCp >= -50) {
      return 'equal';
    }

    if (evalCp > -120) {
      return 'black_better';
    }

    return 'black_winning';
  }

  if (previous === 'white_better') {
    if (evalCp >= 120) {
      return 'white_winning';
    }

    if (evalCp >= 50) {
      return 'white_better';
    }

    if (evalCp >= -50) {
      return 'equal';
    }

    if (evalCp > -120) {
      return 'black_better';
    }

    return 'black_winning';
  }

  if (previous === 'equal') {
    if (evalCp >= 120) {
      return 'white_winning';
    }

    if (evalCp >= 50) {
      return 'white_better';
    }

    if (evalCp <= -120) {
      return 'black_winning';
    }

    if (evalCp <= -50) {
      return 'black_better';
    }

    return 'equal';
  }

  if (previous === 'black_better') {
    if (evalCp <= -120) {
      return 'black_winning';
    }

    if (evalCp <= -50) {
      return 'black_better';
    }

    if (evalCp <= 50) {
      return 'equal';
    }

    if (evalCp < 120) {
      return 'white_better';
    }

    return 'white_winning';
  }

  if (previous === 'black_winning') {
    if (evalCp <= -80) {
      return 'black_winning';
    }

    if (evalCp <= -30) {
      return 'black_better';
    }

    if (evalCp <= 50) {
      return 'equal';
    }

    if (evalCp < 120) {
      return 'white_better';
    }

    return 'white_winning';
  }

  if (evalCp >= 120) {
    return 'white_winning';
  }

  if (evalCp >= 50) {
    return 'white_better';
  }

  if (evalCp <= -120) {
    return 'black_winning';
  }

  if (evalCp <= -50) {
    return 'black_better';
  }

  return 'equal';
}

export function formatEvalBucket(bucket: LiveEvalBucket): string {
  switch (bucket) {
    case 'white_winning':
      return 'White winning';
    case 'white_better':
      return 'White better';
    case 'equal':
      return 'Equal';
    case 'black_better':
      return 'Black better';
    case 'black_winning':
      return 'Black winning';
  }
}
