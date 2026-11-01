// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { SECOND } from './durations.mjs';

/**
 * @returns {number}
 */
export function getBuildCreationTimestamp() {
  // Archive builds have no .git directory. CI supplies SOURCE_DATE_EPOCH;
  // local builds use their creation time so an old archive does not expire immediately.
  const source = process.env.SOURCE_DATE_EPOCH;
  const unixTimestamp = source === undefined ? Math.floor(Date.now() / SECOND) : Number(source);
  if (!Number.isSafeInteger(unixTimestamp) || unixTimestamp <= 0 || unixTimestamp * SECOND > Date.now()) {
    throw new Error('SOURCE_DATE_EPOCH must be a valid past Unix timestamp');
  }
  return unixTimestamp * SECOND;
}
