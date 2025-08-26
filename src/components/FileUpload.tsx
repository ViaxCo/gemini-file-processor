import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Upload, X } from "lucide-react"

interface FileUploadProps {
  files: File[]
  onFilesChange: (files: File[]) => void
}

export const FileUpload = ({ files, onFilesChange }: FileUploadProps) => {
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.currentTarget.style.borderColor = 'hsl(var(--primary))'
    e.currentTarget.style.backgroundColor = 'hsl(var(--accent) / 0.5)'
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.currentTarget.style.borderColor = ''
    e.currentTarget.style.backgroundColor = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.currentTarget.style.borderColor = ''
    e.currentTarget.style.backgroundColor = ''

    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }

  const addFiles = (newFiles: File[]): void => {
    const textFiles = newFiles.filter(file => file.type === 'text/plain')

    if (textFiles.length !== newFiles.length) {
      alert('Please upload only text files (.txt)')
      return
    }

    // Check for duplicates (same name and size)
    const duplicates: string[] = []
    const uniqueFiles = textFiles.filter(newFile => {
      const isDuplicate = files.some(existingFile =>
        existingFile.name === newFile.name && existingFile.size === newFile.size
      )
      if (isDuplicate) {
        duplicates.push(newFile.name)
      }
      return !isDuplicate
    })

    if (duplicates.length > 0) {
      alert(`The following files are already uploaded: ${duplicates.join(', ')}`)
    }

    if (uniqueFiles.length === 0) {
      return
    }

    const totalFiles = files.length + uniqueFiles.length
    if (totalFiles > 10) {
      alert('Maximum of 10 files allowed')
      return
    }

    onFilesChange([...files, ...uniqueFiles])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFiles = e.target.files
    if (selectedFiles) {
      addFiles(Array.from(selectedFiles))
    }
  }

  const removeFile = (index: number): void => {
    const newFiles = files.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  return (
    <Card className="w-full max-w-full overflow-hidden">
      <CardHeader>
        <CardTitle>Upload Text Files (Max 10)</CardTitle>
      </CardHeader>
      <CardContent className="w-full max-w-full overflow-hidden">
        <div
          className={`border-2 border-dashed rounded-lg p-4 sm:p-6 lg:p-8 text-center transition-all duration-300 w-full max-w-full overflow-hidden ${files.length > 0
              ? 'border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-600'
              : 'border-border hover:border-primary hover:bg-accent/50'
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              <CheckCircle className="w-8 h-8 sm:w-10 lg:w-12 sm:h-10 lg:h-12 mx-auto mb-2 text-green-600" />
              <p className="font-medium text-foreground text-sm sm:text-base">{files.length} file{files.length > 1 ? 's' : ''} selected</p>

              <div className="max-h-24 sm:max-h-32 overflow-y-auto space-y-2 w-full max-w-full">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-background rounded-md p-2 border min-w-0 w-full">
                    <div className="flex-1 text-left min-w-0 pr-2">
                      <p className="text-xs sm:text-sm font-medium break-words overflow-wrap-anywhere" title={file.name}>{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <Button
                      onClick={() => removeFile(index)}
                      variant="ghost"
                      size="sm"
                      className="ml-1 sm:ml-2 h-6 w-6 p-0 flex-shrink-0"
                    >
                      <X className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 sm:w-10 lg:w-12 sm:h-10 lg:h-12 mx-auto mb-2 sm:mb-4 text-muted-foreground" />
              <p className="text-sm sm:text-base lg:text-lg font-medium text-foreground">
                Drag & drop your text files here
              </p>
              <p className="text-sm text-muted-foreground">or</p>
            </div>
          )}

          <input
            type="file"
            onChange={handleFileSelect}
            accept=".txt"
            multiple
            className="hidden"
            id="file-input"
          />

          <Button
            onClick={() => document.getElementById('file-input')?.click()}
            className="mt-3 sm:mt-4 text-sm sm:text-base"
            variant="default"
            size="sm"
            disabled={files.length >= 10}
          >
            {files.length > 0 ? 'Add More Files' : 'Browse Files'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
