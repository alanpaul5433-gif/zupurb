## Summary

<!-- What does this PR do? Why? Link the issue/ticket if applicable. -->

## Checklist

- [ ] `flutter analyze` passes with zero issues (CI enforce this — do not merge red)
- [ ] `flutter test` passes locally
- [ ] `npm run lint` passes (if `functions/` was changed)
- [ ] `npm run build` compiles cleanly (if `functions/` was changed)
- [ ] `npm test` passes (if `functions/` was changed)
- [ ] No hardcoded secrets, API keys, or credentials in any file
- [ ] No `.env` files or keystore files committed
- [ ] No `print` / `debugPrint` / `console.log` statements left in production paths
- [ ] New third-party SDKs documented in `docs/DEVELOPMENT_PLAN.md` §4 and signed off
- [ ] Out-of-scope issues logged in `docs/FIX_LIST.md` (not fixed in this PR)

## Testing notes

<!-- Describe what you tested manually, what device/emulator, and any edge cases checked. -->
