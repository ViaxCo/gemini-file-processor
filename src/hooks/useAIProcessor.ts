import { useState } from 'react'
import { processFileWithAI } from '../services/aiService'

export const useAIProcessor = () => {
  const [response, setResponse] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  const processFile = async (file: File, instruction: string): Promise<void> => {
    if (!file || !instruction.trim()) {
      alert('Please select a file and provide instructions')
      return
    }

    setIsProcessing(true)
    setResponse('')

    try {
      await processFileWithAI(file, instruction, (chunk: string) => {
        setResponse(prev => prev + chunk)
      })
    } catch (error) {
      console.error('Error processing file:', error)
      setResponse('Error processing file: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setIsProcessing(false)
    }
  }

  const clearResponse = (): void => {
    setResponse('')
  }

  return {
    response,
    isProcessing,
    processFile,
    clearResponse
  }
}