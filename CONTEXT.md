# File Processing

This context covers processing uploaded files and choosing where generated documents are saved.

## Language

**Destination Assignment**:
The Google Drive destination committed to one or more selected files. It affects only those files and changes only when the user confirms the assignment.
_Avoid_: Global selection, current folder

**Default Destination**:
My Drive Root, used when a file has no Destination Assignment. Browsing or cancelling an assignment does not change it.
_Avoid_: Last selected folder

**Preferred Assignment Root**:
The Google Drive folder shown when a new assignment dialog opens. It is a navigation starting point and does not assign files by itself.
_Avoid_: Default Destination, last selected folder

**Draft Destination**:
The temporary Google Drive destination being considered in an open assignment dialog. It is discarded when the dialog is cancelled or closed.
_Avoid_: Selected folder

**My Drive Root**:
An explicit Google Drive destination representing the top level of My Drive. It is distinct from having no Destination Assignment.
_Avoid_: No folder, empty selection

**Processing Batch**:
The fixed set of source files and generated results created by one processing action. File membership is locked when processing starts; selections, display names, upload statuses, and Destination Assignments belong only to that batch.
_Avoid_: Current files, result list

**Processing Failure**:
An unsuccessful file-processing outcome with a category, safe provider facts, recovery guidance, and retry state. It does not include Cancelled Processing.
_Avoid_: Error string, failed response

**Temporary Processing Failure**:
A Processing Failure caused by a short-lived provider or network condition that is safe to retry automatically.
_Avoid_: Any error, retryable message

**Deferred Processing Failure**:
A Processing Failure, such as an identified daily quota limit, that can end later but should not be retried automatically now.
_Avoid_: Permanent failure, retryable failure

**Permanent Processing Failure**:
A Processing Failure that needs user correction or a manual decision before another attempt.
_Avoid_: Fatal error, unrecoverable failure

**Provider-wide Processing Failure**:
A Processing Failure likely to affect all remaining files using the current provider access, model, or quota. It pauses new requests in the Processing Batch while active requests can finish.
_Avoid_: File error, queue error

**Active Request Limit**:
The maximum number of provider requests from one Processing Batch that can be in progress at the same time. It protects browser responsiveness and is separate from a provider rate limit.
_Avoid_: RPM, batch size

**Provider Rate Limit**:
The maximum number of provider requests that can start during a provider time window. It does not state how many requests can be active at the same time.
_Avoid_: Active Request Limit, queue size

**Gemini Project**:
One saved Gemini API key that represents one separate Google project for request routing. Gemini applies RPM, TPM, and RPD limits to the Google project, not to the API key. Multiple keys from the same Google project must not be entered as separate Gemini Projects because they share one quota.
_Avoid_: Gemini key, account, provider

**Gemini Quota Pool**:
The RPM, TPM, and RPD availability of one Gemini Project for one model. The scheduler sends a waiting request to the Gemini Project that can accept it soonest and uses round-robin order when projects are equally available.
_Avoid_: API key limit, global rate limit

**Gemini Project Cooldown**:
A temporary period when the scheduler does not send a specific model to one Gemini Project after an RPM or TPM limit. Other available Gemini Projects can continue processing.
_Avoid_: Queue Pause, daily quota

**Gemini Daily Exhaustion**:
The state of one Gemini Quota Pool after its RPD limit is reached. That project and model remain unavailable until the next Gemini daily reset at midnight Pacific Time.
_Avoid_: Gemini Project Cooldown, provider failure

**Queue Pause**:
A Processing Batch state that prevents waiting files from starting. Active requests can finish. A manual pause starts from a user action; an automatic pause starts after a Provider-wide Processing Failure.
_Avoid_: Cancel, stop, abort

**Estimated Completion Time**:
An approximate duration calculated from the waiting and active files, provider scheduling limits, and recent request duration. It is recalculated as the Processing Batch changes and is not a guaranteed finish time.
_Avoid_: Deadline, exact completion time

**Automatic Processing Retry**:
A bounded new attempt started without user action after a Temporary Processing Failure. It waits according to the provider response or the app's backoff policy.
_Avoid_: Queue delay, manual retry

**Manual Processing Retry**:
A new attempt started by the user after reviewing a Processing Failure or correcting its cause.
_Avoid_: Automatic retry, resume

**Recovered Processing**:
A completed file-processing outcome that succeeded after one or more Automatic Processing Retries. It retains the number of retries that were needed.
_Avoid_: Retried failure, eventual success

**Cancelled Processing**:
A file-processing outcome that the user stopped. It is separate from a Processing Failure and does not increase the error count.
_Avoid_: Processing Failure, aborted error

**Display Name**:
The temporary name used in the workspace for a selected file, processed download, or Document Upload. Changing it does not change the original uploaded file.
_Avoid_: Renamed file, filename

**Automatic Display Name Cleanup**:
The pattern-gated conversion of a recognized plus-delimited transcript track filename into its default Display Name when the file is added. Unrecognized names and original uploaded files stay unchanged.
_Avoid_: Automatic file rename, bulk rename

**Series Folder Name Suggestion**:
The uppercase series title derived from the selected Display Names. It is blank when the selected titles do not agree. For one file without a track number, it uses the complete Display Name.
_Avoid_: Folder placeholder, detected folder

**Series Group**:
Files whose Display Names contain the same series title followed by a track number. Matching ignores capitalization and repeated spaces but preserves punctuation differences. A Series Group uses the series title as its label.
_Avoid_: Folder group, filename group

**Ungrouped Files**:
Files whose Display Names do not contain a clear series title and track number. They stay together without an inferred series title.
_Avoid_: Unknown series, miscellaneous series

**Series Selection**:
The files selected by the Select Series action. It replaces the previous selection with every file in one Series Group, regardless of processing or upload status.
_Avoid_: Add series, folder selection

**Natural Track Order**:
The numeric order of tracks with the same upload state inside a Series Group, such as Track 1, Track 2, Track 10. Uploaded tracks appear after tracks that are not uploaded.
_Avoid_: Filename order, upload order

**Test Batch**:
A deterministic set of synthetic files used to test the processing workflow without private source material.
_Avoid_: Sample upload, fake upload

**Test AI**:
A development-only provider that simulates processing and provider failures without an API key or an external request.
_Avoid_: Mock Gemini, test key

**Upload Session**:
One user-initiated individual, selected, or all-files upload action. Upload controls do not start another Upload Session until the active one finishes.
_Avoid_: Upload queue, upload batch

**Document Upload**:
The creation of one Google Doc from one processed file in a Processing Batch. A successful Document Upload is terminal for that file unless the user explicitly requests another copy.
_Avoid_: Upload attempt, request

**Upload Reconciliation**:
Verification of a Document Upload using its private Google Drive operation marker after the create request does not return a definitive result. It happens automatically before the user is asked to intervene.
_Avoid_: Automatic retry, status refresh

**Unknown Upload Outcome**:
A Document Upload whose final Google Drive result cannot be confirmed through Upload Reconciliation. It must not be treated as failed or retried as a new Document Upload unless the user explicitly discards the unresolved outcome and accepts the duplicate risk.
_Avoid_: Failed upload, timed-out upload
