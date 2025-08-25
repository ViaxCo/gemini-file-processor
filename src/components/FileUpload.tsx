import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Upload } from "lucide-react"

interface FileUploadProps {
  file: File | null
  onFileChange: (file: File | null) => void
}

export const FileUpload = ({ file, onFileChange }: FileUploadProps) => {
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
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type === 'text/plain') {
      onFileChange(droppedFile)
    } else {
      alert('Please upload a text file (.txt)')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'text/plain') {
      onFileChange(selectedFile)
    } else {
      alert('Please upload a text file (.txt)')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Text File</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
            file
              ? 'border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-600'
              : 'border-border hover:border-primary hover:bg-accent/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="space-y-2">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-600" />
              <p className="font-medium text-foreground truncate max-w-full px-2">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium text-foreground">
                Drag & drop your text file here
              </p>
              <p className="text-muted-foreground">or</p>
            </div>
          )}
          
          <input
            type="file"
            onChange={handleFileSelect}
            accept=".txt"
            className="hidden"
            id="file-input"
          />
          
          <Button
            onClick={() => document.getElementById('file-input')?.click()}
            className="mt-4"
            variant="default"
          >
            {file ? 'Change File' : 'Browse Files'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}