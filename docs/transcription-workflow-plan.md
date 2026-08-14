# Transcription Workflow Improvements

This file is the source of truth for the workflow improvements. A user-visible item is only `Done` after the user tests it.

## Statuses

- `Not started`
- `In progress`
- `Ready for your test`
- `Done`

## Milestones

| Milestone                               | Status      | Acceptance checks                                                                                                                                                                                                                                                   |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Safe test foundation and Bulk Rename | Done        | Development can generate 10, 50, or 100 repeatable fake files. Test AI makes no external request and can simulate success, mixed results, 429, 503, and network failure. Bulk Rename is repeatable, wraps long names, closes after Apply, and clears the selection. |
| 2. Faster Drive assignment              | Not started | Assignment opens in the preferred transcript root. A new folder can be created and assigned in one action. Existing Drive items are not changed during testing.                                                                                                     |
| 3. Series groups                        | Not started | Files are grouped by series, tracks use natural order, uncertain files are separate, and one action selects a series.                                                                                                                                               |
| 4. Viewport workspace                   | Not started | Desktop uses one results scroll area that fits the viewport. Mobile uses one normal page scroll.                                                                                                                                                                    |
| 5. Structured errors and retries        | Not started | Failures show a category, status, provider code, recovery action, retry state, and safe details. Only temporary failures retry automatically.                                                                                                                       |
| 6. Large processing queues              | Not started | The quota-based 20-file cap is removed after queue safeguards exist. Large queues show progress and estimated completion state.                                                                                                                                     |
| 7. Gemini quota pools                   | Not started | The scheduler tracks RPM, TPM, and RPD per project and model. Keys from one Google project share one pool.                                                                                                                                                          |

## Milestone 1 checks

- [x] Test-file controls do not appear in production.
- [x] Test AI does not require an API key or make a network request.
- [x] Fake batches are deterministic and replace existing files only after confirmation.
- [x] The default filename cleanup gives the same result when it runs twice.
- [x] Apply closes Bulk Rename and clears the current selection.
- [x] Long names wrap without horizontal scrolling.
- [x] The Bulk Rename action footer stays visible for long batches.
- [x] The original filename can still be restored from its file card.
- [x] Automated tests pass.
- [x] `npm run pretest` passes.
- [x] Desktop browser checks pass.
- [x] User workflow test passes.

## Non-blocking follow-up checks

- [ ] Run a phone-width responsive sanity check. Mobile usability is useful but is not a milestone blocker because the app is primarily used on desktop.

## Real Google Drive test rules

1. Use a unique test folder name.
2. Record every created Drive item ID.
3. Do not change or remove any item that is not in that record.
4. Move created test items to Drive trash after the test.
5. Report any item that could not be cleaned up.
