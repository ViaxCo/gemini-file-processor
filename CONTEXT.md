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
The files and generated results created by one processing action. Selections, display names, upload statuses, and Destination Assignments belong only to that batch.
_Avoid_: Current files, result list

**Display Name**:
The batch-specific name used for a processed download or Document Upload. Changing it does not change the original uploaded file.
_Avoid_: Renamed file, filename

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
The numeric order of tracks inside a Series Group, such as Track 1, Track 2, Track 10. Processing and upload status do not change this order.
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
