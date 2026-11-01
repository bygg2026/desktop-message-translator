// Copyright 2026 Desktop Message Translator contributors
// SPDX-License-Identifier: AGPL-3.0-only
// fs-xattr is an optional macOS dependency and is absent in Windows installs.
declare module 'fs-xattr' {
  export function setAttribute(
    path: string,
    name: string,
    value: string | Buffer
  ): Promise<void>;
}
