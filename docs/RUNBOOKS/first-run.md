# First Run Runbook

## Verify Scaffold

```powershell
npm test
npm run check
npm run privacy
```

## Expected Result

- Tests pass.
- JavaScript syntax checks pass.
- Privacy scan reports no obvious prohibited tokens.

## If Verification Fails

- Fix the failing service, test, or script.
- Re-run the focused command.
- Update `.agent-context/HANDOFF.md` with the final command and result.

