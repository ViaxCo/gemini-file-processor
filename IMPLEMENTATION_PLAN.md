# Gemini File Processor v2 Implementation Plan

## Overview

Transform the current application from a 10-file parallel processor into a scalable, queue-based system that can handle 100+ files with automated verification and a unified UI workflow.

## Phase 1: Core Architecture & Processing Engine (Priority 1)

### 1.1 Create Non-Reactive Response Store

- **New file**: `src/services/responseStore.ts`
- Implement singleton class to store AI responses outside React state
- Methods: `addResponse()`, `getResponse()`, `updateResponse()`, `clearResponse()`
- Prevent memory leaks with explicit cleanup methods

### 1.2 Enhanced Queue System in useAIProcessor

- **Modify**: `src/hooks/useAIProcessor.ts`
- Replace parallel processing with queue-based system
- Add queue states: `pending`, `processing`, `completed`, `failed`
- Implement batch throttling: 10 files every 90 seconds
- Add queue management methods: `addToQueue()`, `processQueue()`, `pauseQueue()`

### 1.3 Remove File Upload Limits

- **Modify**: `src/components/FileUpload.tsx`
- Remove 10-file limit validation (line 70)
- Update UI messaging from "10 files max" to support large batches
- Add batch upload progress indicator

### 1.4 Selective Streaming Implementation

- **Modify**: `src/hooks/useAIProcessor.ts`
- Single file: Stream to UI in real-time (current behavior)
- Batch processing: Stream directly to responseStore (background)
- Add processing mode detection logic

## Phase 2: Unified File Card & Results UI (Priority 2)

### 2.1 Create Unified File Card Component

- **New file**: `src/components/UnifiedFileCard.tsx`
- Replace current FileItem in MultiFileResponseDisplay
- Features:
  - Editable filename with inline editing
  - Confidence score display with color coding
  - Integrated action buttons (Copy, Download, Retry, Upload, View Response)
  - Destination folder display
  - File selection checkbox for bulk operations

### 2.2 Confidence Score System

- **New file**: `src/utils/confidenceScore.ts`
- Implement "smart" similarity comparison
- Compare last ~250 characters of original vs processed text
- Return color-coded confidence level (High/Medium/Low)

### 2.3 Enhanced MultiFileResponseDisplay

- **Modify**: `src/components/MultiFileResponseDisplay.tsx`
- Replace current FileItem with UnifiedFileCard
- Add bulk selection capabilities
- Add contextual action bar for selected files
- Support for 100+ files with virtualization if needed

## Phase 3: Modal-Based Workflows (Priority 3)

### 3.1 View Response Modal

- **New file**: `src/components/ViewResponseModal.tsx`
- Load response on-demand from responseStore
- Auto-scroll to bottom on open
- Display verification snippet at top (side-by-side comparison)
- Include markdown/raw toggle and copy/download actions

### 3.2 Assign Folder Modal

- **New file**: `src/components/AssignFolderModal.tsx`
- Replace current GoogleDriveFolderSelector integration
- Support bulk folder assignment for selected files
- Show folder selection tree with create folder option

### 3.3 Verification Snippet Logic

- **New file**: `src/utils/verificationSnippet.ts`
- Extract and compare ending snippets from original and processed text
- Generate side-by-side comparison markup for modal display

## Phase 4: UI Layout Overhaul (Priority 4)

### 4.1 Asymmetrical Dashboard Layout

- **Modify**: `src/components/GeminiFileProcessor.tsx`
- Change from 2-column grid to asymmetrical: 40% left, 60% right
- Left column: FileUpload + InstructionsPanel (stacked vertically)
- Right column: Enhanced MultiFileResponseDisplay (full height)

### 4.2 Header Reorganization

- **Modify**: `src/components/GeminiFileProcessor.tsx`
- Main header: Title and description
- Sub-header/control bar: ModelSelector + GoogleAuth + QuotaMonitor
- Move GoogleDrive components to modal-only (remove from main layout)

### 4.3 Contextual Action Bar

- **New file**: `src/components/ContextualActionBar.tsx`
- Appears when files are selected
- Actions: Assign Folder, Retry Selected, Upload Selected, Download Selected
- Sticky positioning at bottom of results panel

## Phase 5: Integration & Polish

### 5.1 Default Instructions Integration

- **Modify**: `src/hooks/useInstructions.ts`
- Set custom transcript processing prompt as default
- Auto-populate instructions panel on app load

### 5.2 Enhanced Google Drive Integration

- **Modify**: `src/hooks/useGoogleDrive.ts`
- Support bulk upload operations
- Add progress tracking for multiple file uploads
- Integrate with new modal-based folder selection

### 5.3 Error Handling & Resilience

- **Modify**: Various components
- Add comprehensive error boundaries
- Implement graceful degradation for large batches
- Add user feedback for queue status and processing errors

## Implementation Timeline

### Week 1: Foundation (Phase 1)

- ✅ Create responseStore service
- ✅ Implement queue-based processing in useAIProcessor
- ✅ Remove file upload limits
- ✅ Add selective streaming logic

### Week 2: New Components (Phase 2)

- ✅ Build confidence score system
- ✅ Create UnifiedFileCard component
- ✅ Update MultiFileResponseDisplay

### Week 3: Modal Workflows (Phase 3)

- ✅ Implement ViewResponseModal
- ✅ Build AssignFolderModal
- ✅ Add verification snippet logic

### Week 4: Layout & Integration (Phase 4-5)

- ✅ Refactor main layout to asymmetrical design
- ✅ Create contextual action bar
- ✅ Integrate all components and test workflow

## Technical Specifications

### Architecture Decisions

- **State Management**: Non-reactive responseStore for large data, React state for UI
- **Processing Strategy**: Queue-based with 90-second throttling between batches
- **Memory Management**: Explicit cleanup methods and garbage collection
- **UI Strategy**: Modal-driven workflows, on-demand loading, bulk operations

### Performance Targets

- **File Capacity**: 100+ files without browser crashes
- **Memory Usage**: Stable memory profile regardless of batch size
- **Processing Speed**: 10 files per 90-second batch (API rate limit compliance)
- **UI Responsiveness**: Smooth interactions during background processing

### Browser Compatibility

- **Target Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Support**: Responsive design for tablet and mobile devices
- **Memory Constraints**: Optimized for 8GB RAM systems with multiple browser tabs

## MVP Success Criteria

### Core Functionality

- ✅ Upload 50+ files without browser crashes
- ✅ Queue-based processing with 90-second throttling
- ✅ At-a-glance confidence scores on all completed files
- ✅ Bulk folder assignment and upload functionality
- ✅ On-demand response viewing via modal
- ✅ Unified file management in new card-based UI

### User Experience

- ✅ Single workflow for file processing, verification, and upload
- ✅ Reduced clicks for common operations (rename, assign folder, upload)
- ✅ Automated verification with manual override capability
- ✅ Clear progress indicators and error handling

## Out of Scope for MVP

### Deferred Features (Phase 2 Development)

- **Automatic Retry System**: Manual retry buttons only for MVP
- **User-Configurable Settings**: Hard-coded batch size and delays
- **Persistent Queue Recovery**: Queue lost on browser refresh
- **Advanced Batch Renaming**: Individual file renaming only
- **Real-time Collaboration**: Single-user sessions only
- **Cloud Storage Integration**: Google Drive only, no Dropbox/OneDrive

### Future Enhancements (1-2 Year Horizon)

- **Backend Processing Service**: Serverless queue management
- **Multi-AI Model Support**: Claude, OpenAI integration
- **Project-Based Workflows**: Saved templates and batch configurations
- **Advanced Analytics**: Processing statistics and performance metrics

## Risk Mitigation

### Technical Risks

- **Memory Leaks**: Implemented explicit cleanup in responseStore
- **Rate Limiting**: Conservative 90-second batching with buffer
- **Browser Crashes**: Non-reactive storage and chunked processing
- **API Failures**: Comprehensive error handling and retry mechanisms

### User Experience Risks

- **Complexity**: Progressive disclosure and contextual help
- **Performance**: Background processing with UI feedback
- **Data Loss**: Local storage backup and recovery options
- **Learning Curve**: Maintain familiar patterns where possible

## Testing Strategy

### Unit Testing

- Core utilities (confidence score, verification snippets)
- Service classes (responseStore, queue management)
- Pure functions and data transformations

### Integration Testing

- Complete file processing workflow
- Google Drive upload and folder assignment
- Modal interactions and state management

### Performance Testing

- Large batch processing (50-100 files)
- Memory usage monitoring
- UI responsiveness under load
- Rate limiting compliance

### User Acceptance Testing

- End-to-end workflow validation
- Error handling scenarios
- Cross-browser compatibility
- Mobile responsiveness

## Deployment Strategy

### Development Environment

- Local development with hot reload
- TypeScript strict mode validation
- ESLint and Prettier formatting
- Component story documentation

### Staging Environment

- Production build testing
- Google API integration validation
- Cross-browser testing
- Performance benchmarking

### Production Deployment

- Gradual feature rollout
- User feedback collection
- Performance monitoring
- Error tracking and alerting

## Success Metrics

### Technical Metrics

- **Processing Capacity**: 100+ files per session
- **Error Rate**: <5% processing failures
- **Performance**: <2 second UI response times
- **Stability**: Zero browser crashes during testing

### User Metrics

- **Task Completion**: End-to-end workflow success rate >95%
- **Time Savings**: 90%+ reduction in verification time
- **User Satisfaction**: Positive feedback on workflow efficiency
- **Adoption**: Successful processing of real user batches

## Maintenance & Support

### Documentation

- Updated README with new features
- Component documentation and examples
- API integration guides
- Troubleshooting and FAQ

### Monitoring

- Error tracking and alerting
- Performance monitoring
- User analytics and feedback
- API quota usage tracking

### Future Development

- Feature request prioritization
- Technical debt management
- Security updates and patches
- Third-party dependency maintenance
