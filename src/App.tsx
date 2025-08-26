import { useState } from 'react'
import { FileUpload } from './components/FileUpload'
import { InstructionsPanel } from './components/InstructionsPanel'
import { ResponseDisplay } from './components/ResponseDisplay'
import { MultiFileResponseDisplay } from './components/MultiFileResponseDisplay'
import { GoogleDriveAuth } from './components/GoogleDriveAuth'
import { GoogleDriveFolderSelector } from './components/GoogleDriveFolderSelector'
import { GoogleDriveUpload } from './components/GoogleDriveUpload'
import { useAIProcessor } from './hooks/useAIProcessor'
import { useGoogleDrive } from './hooks/useGoogleDrive'
import { Toaster } from './components/ui/sonner'

function App(): JSX.Element {
  const [files, setFiles] = useState<File[]>([])
  const [isGoogleDriveConnected, setIsGoogleDriveConnected] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedFolderName, setSelectedFolderName] = useState<string>('')
  const { fileResults, isProcessing, processFiles, clearResults } = useAIProcessor()
  const { uploadStatuses } = useGoogleDrive()

  const handleProcess = async (instruction: string): Promise<void> => {
    if (files.length === 0) return
    await processFiles(files, instruction)
  }

  const handleClearAll = (): void => {
    setFiles([])
    clearResults()
  }

  const handleClearFiles = (): void => {
    setFiles([])
  }

  const handleFolderSelect = (folderId: string | null, folderName: string) => {
    setSelectedFolderId(folderId)
    setSelectedFolderName(folderName)
  }

  const canProcess = files.length > 0
  const hasResults = fileResults.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto min-w-0">
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Gemini File Processor
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 px-2">
            Upload up to 10 text files and let Gemini AI process them in parallel with your custom instructions
          </p>
        </div>

        {/* Google Drive Integration Section */}
        <div className="mb-6 space-y-4">
          <GoogleDriveAuth onAuthChange={setIsGoogleDriveConnected} />

          {isGoogleDriveConnected && (
            <div className="grid gap-4 lg:grid-cols-2">
              <GoogleDriveFolderSelector
                onFolderSelect={handleFolderSelect}
                isAuthenticated={isGoogleDriveConnected}
              />
              {hasResults && (
                <GoogleDriveUpload
                  fileResults={fileResults}
                  selectedFolderId={selectedFolderId}
                  selectedFolderName={selectedFolderName}
                  isProcessing={isProcessing}
                  uploadStatuses={uploadStatuses}
                />
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <div className="space-y-4 sm:space-y-6">
            <FileUpload files={files} onFilesChange={setFiles} onClearFiles={handleClearFiles} />
            <InstructionsPanel
              onProcess={handleProcess}
              onClearAll={handleClearAll}
              isProcessing={isProcessing}
              canProcess={canProcess}
              fileCount={files.length}
            />
          </div>
          {files.length <= 1 && fileResults.length <= 1 ? (
            <ResponseDisplay 
              response={fileResults[0]?.response || ''} 
              isProcessing={isProcessing && fileResults.length > 0 && !fileResults[0]?.isCompleted}
            />
          ) : (
            <MultiFileResponseDisplay fileResults={fileResults} />
          )}
        </div>
      </div>
      <Toaster />
    </div>
  )
}

export default App
