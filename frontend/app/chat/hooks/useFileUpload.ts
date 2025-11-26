import { useState, useCallback, useRef } from 'react';
import { 
  parseFile, 
  ParsedFile, 
  getFileType, 
  MAX_FILE_SIZE,
  generateFileId 
} from '../utils/fileParser';

export interface FileUploadState {
  id: string;
  file: File;
  status: 'pending' | 'parsing' | 'success' | 'error';
  progress: number;
  parsedFile?: ParsedFile;
  error?: string;
}

export interface UseFileUploadReturn {
  files: FileUploadState[];
  parsedFiles: ParsedFile[];
  isProcessing: boolean;
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  isDragOver: boolean;
  dragHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

export function useFileUpload(): UseFileUploadReturn {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Get successfully parsed files
  const parsedFiles = files
    .filter(f => f.status === 'success' && f.parsedFile)
    .map(f => f.parsedFile!);

  // Check if any file is still processing
  const isProcessing = files.some(f => f.status === 'pending' || f.status === 'parsing');

  // Process a single file
  const processFile = useCallback(async (file: File, id: string) => {
    console.log('[FileUpload] Processing file:', {
      id,
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const errorMsg = `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
      console.error('[FileUpload] File size validation failed:', errorMsg);
      setFiles(prev => prev.map(f => 
        f.id === id 
          ? { 
              ...f, 
              status: 'error' as const, 
              error: errorMsg
            }
          : f
      ));
      return;
    }

    // Validate file type
    const fileType = getFileType(file);
    console.log('[FileUpload] Detected file type:', fileType);
    
    if (fileType === 'unsupported') {
      const errorMsg = `Unsupported file type: ${file.type || 'unknown'}`;
      console.error('[FileUpload] Unsupported file type:', {
        name: file.name,
        type: file.type,
        extension: file.name.split('.').pop(),
      });
      setFiles(prev => prev.map(f => 
        f.id === id 
          ? { ...f, status: 'error' as const, error: errorMsg }
          : f
      ));
      return;
    }

    // Update status to parsing
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, status: 'parsing' as const } : f
    ));

    try {
      console.log('[FileUpload] Starting file parse...');
      
      // Parse file with progress callback
      const parsedFile = await parseFile(file, (progress) => {
        console.log('[FileUpload] Parse progress:', { id, name: file.name, progress });
        setFiles(prev => prev.map(f => 
          f.id === id ? { ...f, progress } : f
        ));
      });

      console.log('[FileUpload] Parse completed:', {
        id,
        name: file.name,
        hasError: !!parsedFile.error,
        contentLength: parsedFile.content?.length || 0,
        pageCount: parsedFile.pageCount,
      });

      if (parsedFile.error) {
        console.error('[FileUpload] Parse error:', {
          id,
          name: file.name,
          error: parsedFile.error,
        });
        setFiles(prev => prev.map(f => 
          f.id === id 
            ? { ...f, status: 'error' as const, error: parsedFile.error }
            : f
        ));
      } else {
        console.log('[FileUpload] Parse success:', {
          id,
          name: file.name,
          type: parsedFile.type,
          contentLength: parsedFile.content.length,
        });
        setFiles(prev => prev.map(f => 
          f.id === id 
            ? { ...f, status: 'success' as const, progress: 100, parsedFile }
            : f
        ));
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? `${error.message}${error.stack ? `\n${error.stack}` : ''}`
        : String(error);
      
      console.error('[FileUpload] Unexpected error during file processing:', {
        id,
        name: file.name,
        error,
        errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      setFiles(prev => prev.map(f => 
        f.id === id 
          ? { 
              ...f, 
              status: 'error' as const, 
              error: error instanceof Error 
                ? `${error.name}: ${error.message}` 
                : `Failed to parse file: ${String(error)}`
            }
          : f
      ));
    }
  }, []);

  // Add files to the upload queue
  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList);
    console.log('[FileUpload] Adding files:', {
      count: newFiles.length,
      files: newFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
    });
    
    // Filter out duplicate files (same name and size)
    const filteredFiles = newFiles.filter(newFile => {
      const isDuplicate = files.some(
        existingFile => 
          existingFile.file.name === newFile.name && 
          existingFile.file.size === newFile.size
      );
      if (isDuplicate) {
        console.log('[FileUpload] Skipping duplicate file:', newFile.name);
      }
      return !isDuplicate;
    });

    if (filteredFiles.length === 0) {
      console.log('[FileUpload] All files are duplicates, skipping');
      return;
    }

    console.log('[FileUpload] Files after duplicate check:', {
      original: newFiles.length,
      filtered: filteredFiles.length,
    });
    
    // Create initial state for each file
    const fileStates: FileUploadState[] = filteredFiles.map(file => ({
      id: generateFileId(),
      file,
      status: 'pending' as const,
      progress: 0,
    }));

    // Add to state
    setFiles(prev => [...prev, ...fileStates]);

    // Process files in parallel
    try {
      await Promise.all(
        fileStates.map(fs => processFile(fs.file, fs.id))
      );
      console.log('[FileUpload] All files processed');
    } catch (error) {
      console.error('[FileUpload] Error processing files:', error);
    }
  }, [processFile]);

  // Remove a file by ID
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  return {
    files,
    parsedFiles,
    isProcessing,
    addFiles,
    removeFile,
    clearFiles,
    isDragOver,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}

