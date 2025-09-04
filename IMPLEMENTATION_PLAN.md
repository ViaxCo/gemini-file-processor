# Gemini File Processor Implementation Plan

## Overview of Changes

- I want to convert the monitoring of the requests to be tracked within the application instead of using the cloud monitoring api.

- I want to change the way the rate limiting works currently. It appears that it only processes 10 requests concurrently at any given time (according to 2.5 flash limits), but I want it to actually be that it rate limits requests to 10 per minute (for 2.5 flash) and 15 per minute (for 2.5 flash lite). That way, if I upload 50 files, within 5 minutes (for 2.5 flash) all, the requests should have been sent.

- I want a feature that automatically retries failed requests (requests that show error on the card and show up in the alert that has the retry all button). They should retry at least 3 times if they failed repeatedly. Afterwards, they don't automatically retry but allow the user to manually retry or resolve it some other way. (This should still respect the rate limits for either 2.5 flash or 2.5 flash lite, depending on which is selected). I want this feature for automatic retries also for the ones that have low confidence (the alert also shows to retry low confidence files). They should automatically retry and also respect rate limits.

- I have this issue where when I make 10 requests to api/gemini, the browser only makes 6 requests and has 4 as pending. Probably some http 1.1 limitation or something. Change this to allow all 10 or more (since we can have more than 10 requests if a minute has passed between batch requests). I don't know if you need to use sse or whatever, but fix it.

- For single file responses, responses should stream in. But I think for multiple file responses, we probably don't need streaming? Since we don't show the user the results as they stream in. Maybe we should just use generatetext for that one. But if streamtext doesn't affect performance for large number of files (since it's not streaming into the UI), then I guess we can leave it? You decide which you think is better.

- I want a feature that allows me to do bulk rename. The file names are typically in this format:
  `In+the+Spirit+By+the+Spirit+Series+7a+-+The+Power+of+the+Holy+Spirit+Track+6+6th+Jan+2021.txt`
  I usually rename them to something like:
  `In the Spirit By the Spirit - Series 7a - The Power of the Holy Spirit - Track 6`
  So, I should be able to select multiple files and have a bulk rename button (probably where the upload selected, download selected etc buttons are) and have a way to rename them all together

## Implementation Details

### Executive Summary

The plan is broken down into four phases, starting with the most critical architectural changes and progressing to new features.

1. **Phase 1: Core Processing Engine Overhaul:** We will replace the current concurrency-based processing with a true rate-limiter (token bucket approach). This new engine will be the foundation for implementing intelligent, automatic retries for both failed and low-confidence requests.
2. **Phase 2: In-Application Usage Monitoring:** We will shift from the Google Cloud Monitoring API to a self-contained, client-side usage tracker. This will remove the need for billing-enabled projects for this feature and provide instantaneous feedback, though it will require us to manage rate limit values within the app.
3. **Phase 3: API and Streaming Strategy:** This phase involves a critical analysis of the current API communication. I will explain how the changes in Phase 1 inherently solve the browser's concurrent connection limit. I'll also provide a recommendation on whether to keep `streamText` for batch processing (short answer: yes, for server-side stability).
4. **Phase 4: Bulk Rename Feature:** Finally, we will build the requested bulk renaming functionality. This will involve a new modal for defining renaming rules and a preview of the changes before applying them to the selected files.

---

### Phase 1: Core Processing Engine Overhaul (Rate Limiting & Retries)

This is the foundational phase that addresses the rate limiting and automatic retry requirements. We will modify `src/hooks/useAIProcessor.ts` significantly.

#### 1.1. Implement a True Rate Limiter

The current system uses a sliding window that primarily limits concurrency. We will replace this with a more flexible token bucket algorithm that respects requests-per-minute (RPM) and allows for bursts.

- **File to Modify:** `src/hooks/useAIProcessor.ts`
- **Plan:**
  1. Define model-specific rate limits within the hook:

     ```typescript
     const RATE_LIMITS = {
       'gemini-2.5-flash': { limit: 10, interval: 60000 }, // 10 RPM
       'gemini-2.5-flash-lite': { limit: 15, interval: 60000 }, // 15 RPM
     };
     ```

  2. Refactor the `processQueue` function to use a token bucket approach. This involves:
     - Maintaining a timestamp queue for recent requests.
     - Before processing an item, check if a request can be made based on the timestamps of past requests within the `interval`.
     - If the limit is reached, calculate the precise wait time until the next request can be sent.
     - This allows an initial burst of requests up to the limit, then spaces out subsequent requests, perfectly matching your requirement for processing 50 files in 5 minutes (at 10 RPM).

#### 1.2. Implement Automatic Retries for Failed Requests

- **File to Modify:** `src/hooks/useAIProcessor.ts`
- **Plan:**
  1. Extend the `FileResult` interface to include `retryCount: number`.
  2. In the `catch` block where a processing error is handled, check `retryCount`.
  3. If `retryCount < 3`, increment the count and add the failed file back to the _front_ of the processing queue. An exponential backoff delay (e.g., `(2^retryCount) * 1000ms`) will be added before it's re-queued to avoid overwhelming a temporarily failing API.
  4. If `retryCount >= 3`, mark the file as permanently failed as it does now.
  5. The re-queued item will be picked up by the rate limiter automatically.

#### 1.3. Implement Automatic Retries for Low-Confidence Results

- **File to Modify:** `src/hooks/useAIProcessor.ts`
- **Plan:**
  1. Extend the `FileResult` interface with `lowConfidenceRetryCount: number`.
  2. After a file is processed successfully, calculate its confidence score using the existing `getConfidenceScore` utility.
  3. If `level` is `'low'` and `lowConfidenceRetryCount < 3`, increment the count, and add the file back to the queue for reprocessing, just like a failed request.
  4. The UI will be updated to reflect that a file is being retried due to low confidence, providing better user feedback.

### Phase 2: In-Application Usage Monitoring

This phase removes the dependency on the Google Cloud Monitoring API for usage tracking.

#### 2.1. Create a Client-Side Usage Tracking Service

- **New File:** `src/services/usageTracker.ts`
- **Plan:**
  1. Create a singleton class `UsageTracker` that persists its state to `localStorage`.
  2. It will track requests per minute and per day for each model.
  3. Methods will include `recordRequest(model)`, `getUsage(model)`, and `canMakeRequest(model)`.
  4. The daily limits (e.g., 1000 requests/day) will be hardcoded here, as we are no longer fetching them from Google's API.

#### 2.2. Refactor the Quota UI

- **Files to Modify:** `src/components/QuotaMonitor.tsx` and `src/hooks/useQuotaMonitoring.ts`
- **Plan:**
  1. Delete the API route `src/app/api/quota/route.ts`.
  2. Remove `@google-cloud/monitoring` and `@google-cloud/service-usage` from `package.json`.
  3. Rewrite the `useQuotaMonitoring` hook to get its data from our new `usageTracker.ts` service instead of fetching from an API.
  4. The `QuotaMonitor` component will now display data from the local tracker, making it faster and removing the external dependency. The `useAIProcessor` hook will call `usageTracker.recordRequest()` after each successful API call.

### Phase 3: API and Streaming Strategy

This phase addresses the browser request limit and the batch processing strategy.

#### 3.1. Solving the Browser Concurrent Request Limit

- **Analysis:** Your diagnosis is correct; browsers limit concurrent connections to a single domain (usually around 6 for HTTP/1.1).
- **Solution:** The new rate-limiting engine from **Phase 1** inherently solves this problem.
  - Instead of attempting to fire 10+ requests simultaneously, our new `processQueue` function will dispatch them one by one, respecting the token bucket algorithm.
  - For a 10 RPM limit, after an initial burst, requests will be naturally spaced out by about 6 seconds. This is well below the browser's concurrency limit threshold.
  - **Conclusion:** No extra work (like implementing SSE) is needed. The architectural change in Phase 1 is the correct and most robust solution.

#### 3.2. Batch Processing: `streamText` vs. `generateText`

- **Analysis:** You are correct that for batch processing, the UI does not display the response as it streams in. The question is whether switching to `generateText` (a non-streaming equivalent) offers benefits.
- **Recommendation:** **Keep `streamText` for all API calls.**
  - **Server-Side Stability:** `streamText` is significantly more memory-efficient and resilient on the server (especially in serverless environments). `generateText` must buffer the entire response in memory, which can lead to timeouts or memory allocation errors for large files.
  - **Unified Code Path:** Using `streamText` for both single and batch files simplifies the backend logic in `src/app/api/gemini/route.ts`.
  - **Performance:** The performance difference on the client-side for this background-processing use case is negligible. The stability gained on the server side far outweighs any minor client-side simplification.

### Phase 4: Bulk Rename Feature

This phase implements the requested user-facing feature for renaming files in bulk.

#### 4.1. Create a Bulk Rename Modal

- **New File:** `src/components/BulkRenameModal.tsx`
- **Plan:**
  1. This modal will be triggered by a new "Bulk Rename" button in `ContextualActionBar.tsx`.
  2. The modal will feature a simple UI for defining renaming rules:
     - A text input to find a string or regex pattern.
     - A text input for the replacement string.
     - Checkboxes for common tasks: "Replace all `+` with spaces", and "Remove `.txt` extension".
  3. A preview area will show a list of selected files with their original and new names based on the current rules, updating in real-time.

#### 4.2. Implement Renaming Logic

- **File to Modify:** `src/components/MultiFileResponseDisplay.tsx`
- **Plan:**
  1. The modal will be controlled from `MultiFileResponseDisplay`.
  2. When the user clicks "Apply" in the modal, a handler function will iterate through the selected file indices.
  3. For each selected file, it will apply the transformation rules to its current `displayName` and update the component's `displayNames` state.
  4. This approach reuses the existing `displayNames` state, making the integration clean and efficient.
