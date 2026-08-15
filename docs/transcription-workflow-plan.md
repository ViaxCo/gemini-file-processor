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
| 1b. Automatic Display Name Cleanup      | Done        | Recognized transcript track names are cleaned when files are added. Other names and original uploaded files remain unchanged. Cleanup can be undone.                                                                                                                |
| 2. Faster Drive assignment              | Done        | Assignment opens in the preferred transcript root. A new folder can be created and assigned in one action. Existing Drive items are not changed during testing.                                                                                                     |
| 3. Series groups                        | Done        | Files are grouped by series, tracks use natural order, uncertain files are separate, and one action selects a series.                                                                                                                                               |
| 4. Viewport workspace                   | Done        | Desktop uses one results scroll area that fits the viewport. Mobile uses one normal page scroll.                                                                                                                                                                    |
| 5. Structured errors and retries        | Done        | Failures show a category, status, provider code, recovery action, retry state, and safe details. Only temporary failures retry automatically.                                                                                                                       |
| 6. Large processing queues              | Done        | The quota-based 20-file cap is removed after queue safeguards exist. Large queues show progress and estimated completion state.                                                                                                                                     |
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

## Milestone 1b checks

- [x] Recognized plus-delimited transcript track names are cleaned when files are added.
- [x] Unrecognized filenames remain unchanged.
- [x] Original uploaded files remain unchanged.
- [x] The cleanup notice states how many Display Names changed and offers Undo.
- [x] Undo restores only the Display Names changed by that file-add action.
- [x] Bulk Rename and individual name editing remain available.
- [x] Automatic cleanup gives the same result when it runs twice.
- [x] Automated tests pass.
- [x] `npm run pretest` passes.
- [x] Desktop browser checks pass with mixed fake filenames.
- [x] User workflow test passes.

## Milestone 2 checks

- [x] Assignment opens in Teaching Transcripts.
- [x] Creating a folder assigns it to the selected files in the same action.
- [x] New series folder names are saved in uppercase.
- [x] A matching series name is prefilled from the selected Display Names; a mixed selection stays empty.
- [x] A successful assignment closes the modal and clears the selection.
- [x] Cancelling does not change Destination Assignments.
- [x] Existing Drive files and folders are not changed during testing.
- [x] Every Drive test item is recorded and moved to trash after testing.
- [x] Automated tests pass.
- [x] `npm run pretest` passes.
- [x] Desktop browser checks pass.
- [x] User workflow test passes.

## Milestone 3 checks

- [x] Current Display Names determine Series Groups.
- [x] Matching ignores capitalization and repeated spaces but preserves punctuation differences.
- [x] Series Groups use alphabetical order.
- [x] Tracks use Natural Track Order within their upload state; uploaded tracks move to the bottom of their Series Group.
- [x] Ungrouped Files appear last.
- [x] Each Series Group shows its title, track count, and Select Series action.
- [x] Select Series replaces the previous selection with every file in that group.
- [x] Successful uploads are deselected; failed uploads remain selected for retry.
- [x] Bulk Rename and manual name edits update the groups.
- [x] Automated tests pass.
- [x] `npm run pretest` passes.
- [x] Desktop browser checks pass with fake files.
- [x] User workflow test passes.

## Milestone 4 checks

- [x] The desktop workspace becomes active when at least one processing result exists.
- [x] The active desktop header is compact without hiding its information or controls.
- [x] The complete AI Responses card is visible within the viewport on page load.
- [x] The AI Responses card stays pinned while the page scrolls through the left column.
- [x] The page keeps its normal scroll for the Upload and Instructions column.
- [x] The AI Responses card has one results scroll area.
- [x] The AI Responses header remains visible while results scroll.
- [x] File result cards use a compact two-row desktop layout.
- [x] Selected-file actions remain visible at the bottom of the card.
- [x] Tablet and phone layouts use normal page flow without a fixed results height.
- [x] Automated tests pass.
- [x] `npm run pretest` passes.
- [x] Desktop browser checks pass with fake files.
- [x] User workflow test passes.

## Milestone 5 checks

- [x] Every provider uses one structured Processing Failure format.
- [x] Gemini quota details distinguish short-term rate limits from an identified daily quota.
- [x] A generic 429 is labelled as a rate limit with an unknown subtype.
- [x] Temporary failures use up to three Automatic Processing Retries with exponential backoff, jitter, and a longer provider delay when supplied.
- [x] Deferred and Permanent Processing Failures do not retry automatically.
- [x] Cancelled Processing is separate from errors and can be retried manually.
- [x] Failed cards show a compact category, status, explanation, retry state or recovery action, and collapsed safe details.
- [x] The response summary shows failure category counts.
- [x] Retry All includes Processing Failures and excludes Cancelled Processing.
- [x] A Manual Processing Retry starts a fresh four-attempt cycle.
- [x] Partial output from a failed attempt is discarded.
- [x] Recovered Processing shows how many retries were needed.
- [x] Test AI covers temporary recovery, 429 types, overload, network, API key, invalid request, blocked content, unknown errors, and mixed failures without external requests.
- [x] Automated tests pass.
- [x] `npm run pretest` passes.
- [x] Desktop browser checks pass with fake failures.
- [x] User workflow test passes.

## Milestone 6 checks

- [x] A Processing Batch runs no more than three active provider requests at one time.
- [x] Provider RPM scheduling remains separate from the Active Request Limit.
- [x] Manual Pause stops waiting files from starting while active requests finish.
- [x] Provider-wide Processing Failures pause the queue automatically.
- [x] Three consecutive files that exhaust retries with the same temporary provider failure pause the queue.
- [x] Resume uses the current provider access and model, retries provider-wide failures first, and then continues untouched waiting files.
- [x] File membership and instructions are locked while the batch is running or paused.
- [x] Provider, model, and API-key controls are locked while running and available while paused.
- [x] Progress shows complete, active, waiting, failed, cancelled, and approximate remaining time.
- [x] Closing or reloading warns while a batch is running or paused.
- [x] Series Groups behave as a single-open accordion and show status counts when collapsed.
- [x] An expanded group renders no more than 50 File Result cards at one time.
- [x] The added-file preview renders no more than 50 filename rows at one time.
- [x] Bulk actions continue to affect hidden selected files.
- [x] Unchanged File Result cards do not rerender for unrelated queue updates.
- [x] Uploaded files continue to move to the bottom of their Series Group and become deselected.
- [x] Fake browser tests progress through 50, 100, 341, and 1,000 realistically sized files without real provider keys.
- [x] The released file-count and total-size safeguards use measured browser results instead of provider quota assumptions.
- [x] Automated tests pass.
- [x] `npm run pretest` passes.
- [x] Desktop browser checks pass with fake files.
- [x] Phone-width responsive sanity check passes.
- [x] User workflow test passes.

Browser measurements used realistic fake text files of approximately 65 KB each. A 1,000-file, 66.5 MB batch completed without blocking normal browser use. The released browser safeguards are 1,000 files, 100 MB total, 2 MB for each `.txt` or `.md` file, and 10 MB for each `.docx` file. These limits protect browser memory and do not represent provider quotas.

## Real Google Drive test rules

1. Use a unique test folder name.
2. Record every created Drive item ID.
3. Do not change or remove any item that is not in that record.
4. Move created test items to Drive trash after the test.
5. Report any item that could not be cleaned up.
