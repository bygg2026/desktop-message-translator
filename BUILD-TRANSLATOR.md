# Desktop Message Translator build notes

This is an unofficial Signal Desktop derivative, based on upstream commit `5dad34ad5ea1a5b6229412e5c8ac0a696ff7532d` (8.36.0-alpha.1). It supports Google Translate and an OpenAI-compatible custom translation endpoint.

## Windows build

Use Node 24.22.0, pnpm 11.24.0, Git and the Visual Studio C++ build tools required by upstream native dependencies. From this repository:

```powershell
pnpm install --frozen-lockfile
node --test --test-isolation=none scripts/translation-service.test.mjs scripts/build-time.test.mjs
pnpm --filter @signalapp/windows-ucv run build
node scripts/build-windows-ucv.mjs
node scripts/check-native-artifacts.mjs
pnpm run generate
pnpm run check:types
pnpm run build:release --win nsis --x64 --publish never
```

The `translator-windows.yml` workflow runs the same checks on standard GitHub Windows runners and uploads the installer as a build artifact. It does not publish a release. Workflow execution has not been verified remotely.

Some constrained Windows environments do not resolve pnpm junctions correctly. A local workaround is `pnpm install --ignore-scripts --config.node-linker=hoisted`, then passing `--config.node-linker=hoisted` on subsequent pnpm commands. `--ignore-scripts` skips native preparation and is not sufficient to produce a working installer by itself.

## Translation use

Open General preferences, then Message translation. Choose Google or enter a custom endpoint, model and optional API key. Verify and save. The key field remains empty after save; empty retains a saved key, and Clear key explicitly removes it. Custom provider activation verifies the connection before changing the active configuration.

Incoming timeline messages are translated below their originals. Sending text first replaces the draft with a translation preview; submit again to send the preview. Editing a draft during translation invalidates that response. Translation failures retain the draft and show retry feedback. Translated drafts lose original formatting/mention ranges because those offsets do not apply to the translated text.

Translation sends message plaintext to the selected provider. Google uses its public translate endpoint and may rate-limit requests. Custom provider credentials are encrypted with Electron safeStorage; plaintext storage fallback is disabled.

## Profile and upgrades

The Windows application identifier is `io.github.bygg2026.desktop-message-translator`. The default user data directory is `%APPDATA%\Desktop Message Translator`, separate from Signal and previous fork installations. Link this installation from the phone. Existing profiles are not imported automatically; retain the old profile and backup before considering any manual migration. Do not copy a database while either application is running.

Official Signal auto-update is disabled to avoid replacing the fork. Install updated fork builds manually. The upstream expiration checks remain enabled, including remote expiry. Local archive builds use their build time; reproducible builds can supply `SOURCE_DATE_EPOCH` as a past Unix timestamp. This does not make an old protocol version compatible with Signal indefinitely. Periodically rebase onto a supported upstream release and rebuild.

## Validation status

Full project typecheck, production JavaScript bundling, Sass/Tailwind generation, native dependency preparation, database schema generation and seven regression/integration tests passed locally. A live Google request translated the fixed phrase `Hello, world!` to Chinese successfully. Windows UCV compiled with VS2022, required native artifact checks passed, and the rebuilt NSIS installer includes the native binding. The candidate installer is 142500132 bytes, SHA256 B3BBFEED9EC1B4F70B57AF246A415C1C4E0B2701AD4EC1F46CCD2DE21B28B78A.

The installer succeeded after copying it from the workspace to a normal user directory and supplying a fresh writable TEMP/TMP. The installed application launched with no command-line flags and remained open; Chromium sandbox was not disabled. The installed app archive hash matches the build. Earlier workspace startup failures are not evidence that the installed app requires sandbox disabling.

Real account linking, sending, receiving and translation preview still need user verification. This candidate is not yet a stable release. Earlier intermediate installer files must not be used as release attachments.
