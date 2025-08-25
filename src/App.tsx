import { useState } from 'react'
import { FileUpload } from './components/FileUpload'
import { InstructionsPanel } from './components/InstructionsPanel'
import { ResponseDisplay } from './components/ResponseDisplay'
import { useAIProcessor } from './hooks/useAIProcessor'

function App(): JSX.Element {
  const [file, setFile] = useState<File | null>(null)
  const { response, isProcessing, processFile, clearResponse } = useAIProcessor()

  const handleProcess = async (instruction: string): Promise<void> => {
    if (!file) return
    await processFile(file, instruction)
  }

  const handleClearAll = (): void => {
    setFile(null)
    clearResponse()
  }

  const canProcess = file !== null

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Gemini File Processor
          </h1>
          <p className="text-lg text-gray-600">
            Upload a text file and let Gemini AI process it with your custom instructions
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <FileUpload file={file} onFileChange={setFile} />
            <InstructionsPanel
              onProcess={handleProcess}
              onClearAll={handleClearAll}
              isProcessing={isProcessing}
              canProcess={canProcess}
            />
          </div>
          <ResponseDisplay response={response} />
        </div>
      </div>
    </div>
  )
}

export default App