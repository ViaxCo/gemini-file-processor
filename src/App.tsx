import { useState } from 'react'
import { FileUpload } from './components/FileUpload'
import { InstructionsPanel } from './components/InstructionsPanel'
import { ResponseDisplay } from './components/ResponseDisplay'
import { MultiFileResponseDisplay } from './components/MultiFileResponseDisplay'
import { useAIProcessor } from './hooks/useAIProcessor'

function App(): JSX.Element {
  const [files, setFiles] = useState<File[]>([])
  const { fileResults, isProcessing, processFiles, clearResults } = useAIProcessor()

  const handleProcess = async (instruction: string): Promise<void> => {
    if (files.length === 0) return
    await processFiles(files, instruction)
  }

  const handleClearAll = (): void => {
    setFiles([])
    clearResults()
  }

  const canProcess = files.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-2 sm:p-4 overflow-x-hidden">
      <div className="max-w-4xl mx-auto min-w-0">
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-2">
            Gemini File Processor
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 px-2">
            Upload up to 10 text files and let Gemini AI process them in parallel with your custom instructions
          </p>
        </div>

        {files.length <= 1 ? (
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="space-y-4 sm:space-y-6">
              <FileUpload files={files} onFilesChange={setFiles} />
              <InstructionsPanel
                onProcess={handleProcess}
                onClearAll={handleClearAll}
                isProcessing={isProcessing}
                canProcess={canProcess}
              />
            </div>
            <ResponseDisplay response={fileResults[0]?.response || ''} />
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <FileUpload files={files} onFilesChange={setFiles} />
              <InstructionsPanel
                onProcess={handleProcess}
                onClearAll={handleClearAll}
                isProcessing={isProcessing}
                canProcess={canProcess}
              />
            </div>
            <MultiFileResponseDisplay fileResults={fileResults} />
          </div>
        )}
      </div>
    </div>
  )
}

export default App