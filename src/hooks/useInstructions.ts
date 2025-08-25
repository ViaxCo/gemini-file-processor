import { useState, useEffect } from 'react'

export const useInstructions = () => {
  const [instruction, setInstruction] = useState<string>('')
  const [savedInstructions, setSavedInstructions] = useState<string[]>([])
  const [isSaved, setIsSaved] = useState<boolean>(false)

  useEffect(() => {
    const saved = localStorage.getItem('customInstructions')
    if (saved) {
      try {
        const parsedInstructions = JSON.parse(saved)
        setSavedInstructions(parsedInstructions)
      } catch (error) {
        console.error('Error loading saved instructions:', error)
      }
    }
  }, [])

  useEffect(() => {
    const lastInstruction = localStorage.getItem('lastInstruction')
    if (lastInstruction) {
      setInstruction(lastInstruction)
    }
  }, [])

  const saveInstruction = (): void => {
    if (!instruction.trim()) return
    
    const updated = [...savedInstructions]
    if (!updated.includes(instruction)) {
      updated.push(instruction)
      setSavedInstructions(updated)
      localStorage.setItem('customInstructions', JSON.stringify(updated))
    }
    localStorage.setItem('lastInstruction', instruction)
    
    // Show feedback
    setIsSaved(true)
    setTimeout(() => {
      setIsSaved(false)
    }, 2000)
  }

  const loadInstruction = (instructionText: string): void => {
    setInstruction(instructionText)
  }

  const deleteInstruction = (index: number): void => {
    const updated = savedInstructions.filter((_, i) => i !== index)
    setSavedInstructions(updated)
    localStorage.setItem('customInstructions', JSON.stringify(updated))
  }

  const clearInstruction = (): void => {
    setInstruction('')
  }

  return {
    instruction,
    setInstruction,
    savedInstructions,
    saveInstruction,
    loadInstruction,
    deleteInstruction,
    clearInstruction,
    isSaved
  }
}