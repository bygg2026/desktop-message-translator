// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBuildCreationTimestamp } from './utils/getBuildCreationTimestamp.mjs';
test('archive builds use current time and reproducible builds use explicit epoch', () => {
  const previous = process.env.SOURCE_DATE_EPOCH;
  try {
    delete process.env.SOURCE_DATE_EPOCH;
    assert.ok(Math.abs(Date.now() - getBuildCreationTimestamp()) < 2000);
    process.env.SOURCE_DATE_EPOCH = '1700000000';
    assert.equal(getBuildCreationTimestamp(), 1700000000000);
    process.env.SOURCE_DATE_EPOCH = 'invalid';
    assert.throws(getBuildCreationTimestamp);
    process.env.SOURCE_DATE_EPOCH = '99999999999';
    assert.throws(getBuildCreationTimestamp);
  } finally {
    if (previous === undefined) delete process.env.SOURCE_DATE_EPOCH;
    else process.env.SOURCE_DATE_EPOCH = previous;
  }
});
