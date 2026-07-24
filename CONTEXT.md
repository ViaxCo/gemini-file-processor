# File Processing

This context covers processing uploaded files and choosing where generated documents are saved.

## Language

**Destination Assignment**:
The Google Drive destination committed to one or more selected files. It affects only those files and changes only when the user confirms the assignment.
_Avoid_: Global selection, current folder

**Default Destination**:
My Drive Root, used when a file has no Destination Assignment. Browsing or cancelling an assignment does not change it.
_Avoid_: Last selected folder

**Draft Destination**:
The temporary Google Drive destination being considered in an open assignment dialog. It is discarded when the dialog is cancelled or closed.
_Avoid_: Selected folder

**My Drive Root**:
An explicit Google Drive destination representing the top level of My Drive. It is distinct from having no Destination Assignment.
_Avoid_: No folder, empty selection

**Processing Batch**:
The files and generated results created by one processing action. Selections, display names, upload statuses, and Destination Assignments belong only to that batch.
_Avoid_: Current files, result list
