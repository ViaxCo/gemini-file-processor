import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  FileText,
  Loader2,
  Upload
} from 'lucide-react'
import React, { useState } from 'react'
import { useGoogleDrive } from '../hooks/useGoogleDrive'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Input } from './ui/input'

interface GoogleDriveUploadProps {
  fileResults: Array<{ file: File; response: string; isProcessing: boolean; isCompleted: boolean }>
  selectedFolderId?: string | null
  selectedFolderName?: string
  onUploadComplete?: (uploadedFiles: Array<{ name: string; url: string }>) => void
  isProcessing?: boolean
}

export function GoogleDriveUpload({
  fileResults,
  selectedFolderId,
  selectedFolderName,
  onUploadComplete,
  isProcessing = false
}: GoogleDriveUploadProps): JSX.Element {
  const { isAuthenticated, uploadToGoogleDocs, isUploading, error } = useGoogleDrive()

  const [fileNames, setFileNames] = useState<Record<string, string>>({})
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; originalFileName: string }>>([])

  // Initialize file names with default values
  React.useEffect(() => {
    const defaultNames: Record<string, string> = {}
    fileResults.forEach((result) => {
      if (!fileNames[result.file.name]) {
        // Generate default name from original filename
        const baseName = result.file.name?.replace(/\.[^/.]+$/, '') // Remove extension
        defaultNames[result.file.name] = baseName
      }
    })
    if (Object.keys(defaultNames).length > 0) {
      setFileNames(prev => ({ ...defaultNames, ...prev }))
    }
  }, [fileResults])

  const handleFileNameChange = (originalFileName: string, newName: string) => {
    setFileNames(prev => ({
      ...prev,
      [originalFileName]: newName
    }))
  }

  const handleSingleUpload = async (result: { file: File; response: string }) => {
    if (!isAuthenticated) return

    const fileName = fileNames[result.file.name] || result.file.name

    try {
      const uploadedFile = await uploadToGoogleDocs(
        fileName,
        result.response,
        selectedFolderId
      )

      const newUploadedFile = {
        name: fileName,
        url: uploadedFile.webViewLink || '#',
        originalFileName: result.file.name
      }

      setUploadedFiles(prev => [...prev, newUploadedFile])
      onUploadComplete?.([newUploadedFile])
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  const handleBatchUpload = async () => {
    if (!isAuthenticated || fileResults.length === 0) return

    try {
      const uploadPromises = fileResults.map(async (result) => {
        const fileName = fileNames[result.file.name] || result.file.name
        const uploadedFile = await uploadToGoogleDocs(
          fileName,
          result.response,
          selectedFolderId
        )

        return {
          name: fileName,
          url: uploadedFile.webViewLink || '#',
          originalFileName: result.file.name
        }
      })

      const results = await Promise.all(uploadPromises)
      setUploadedFiles(prev => [...prev, ...results])
      onUploadComplete?.(results)
    } catch (error) {
      console.error('Batch upload failed:', error)
    }
  }

  if (!isAuthenticated) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">
          <Upload className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Connect to Google Drive to upload files</p>
        </div>
      </Card>
    )
  }

  if (fileResults.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-gray-500">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Process files to enable Google Drive upload</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 space-y-4 max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Upload to Google Drive</h3>
        {fileResults.length > 1 && (
          <Button
            onClick={handleBatchUpload}
            disabled={isUploading || isProcessing}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isUploading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Upload All
          </Button>
        )}
      </div>

      {selectedFolderName && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Destination: <span className="font-medium">{selectedFolderName}</span>
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-3 max-h-[500px] lg:max-h-[400px] xl:max-h-[500px] overflow-y-auto lg:overflow-y-auto">
        {fileResults.map((result) => {
          const isUploaded = uploadedFiles.some(f => f.originalFileName === result.file.name)
          const uploadedFile = uploadedFiles.find(f => f.originalFileName === result.file.name)

          return (
            <div key={result.file.name} className="border rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="text-sm font-medium truncate" title={result.file.name}>
                    {result.file.name}
                  </span>
                  {isUploaded && (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                  )}
                </div>
              </div>

              {!isUploaded && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">
                      Document name in Google Drive:
                    </label>
                    <Input
                      value={fileNames[result.file.name] || ''}
                      onChange={(e) => handleFileNameChange(result.file.name, e.target.value)}
                      placeholder="Enter document name"
                      className="text-sm"
                    />
                  </div>
                  <Button
                    onClick={() => handleSingleUpload(result)}
                    disabled={isUploading || result.isProcessing || !result.isCompleted || !fileNames[result.file.name]?.trim()}
                    size="sm"
                    className="w-full"
                  >
                    {isUploading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    <Upload className="w-4 h-4 mr-1" />
                    Upload to Google Docs
                  </Button>
                </div>
              )}

              {isUploaded && uploadedFile && (
                <div className="bg-green-50 border border-green-200 rounded-md p-2">
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-sm text-green-800 min-w-0 flex-1">
                      Uploaded as: <span className="font-medium truncate inline-block max-w-[200px]" title={uploadedFile.name}>{uploadedFile.name}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(uploadedFile.url, '_blank')}
                      className="text-green-600 hover:text-green-700 hover:bg-green-100"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-sm text-green-600">
            ✓ {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} uploaded successfully
          </p>
        </div>
      )}
    </Card>
  )
}
