/**
 * File Parser Utility
 * Handles parsing of various file types in the browser
 */

// Supported file types configuration
export const SUPPORTED_FILE_TYPES = {
  // Text-based files (Tier 1 - Native browser support)
  text: {
    extensions: [
      '.txt', '.log', '.md', '.mdx',
      '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
      '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp',
      '.css', '.scss', '.sass', '.less',
      '.html', '.htm', '.xml', '.svg',
      '.json', '.yaml', '.yml', '.toml', '.ini', '.env',
      '.sql', '.graphql', '.gql',
      '.sh', '.bash', '.zsh', '.fish', '.ps1',
      '.csv', '.tsv',
    ],
    mimeTypes: [
      'text/plain',
      'text/markdown',
      'text/html',
      'text/css',
      'text/xml',
      'text/csv',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/typescript',
      'application/x-yaml',
    ],
  },
  // PDF files (Tier 2 - Requires pdfjs-dist)
  pdf: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
  },
  // Image files (Tier 3 - Future Vision API support)
  image: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
  },
} as const;

// Parsed file result type
export interface ParsedFile {
  id: string;
  name: string;
  size: number;
  type: 'text' | 'pdf' | 'image' | 'unsupported';
  mimeType: string;
  content: string; // Text content or base64 for images
  error?: string;
  pageCount?: number; // For PDFs
}

// File parsing status
export interface FileParsingStatus {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'parsing' | 'success' | 'error';
  progress?: number; // 0-100 for PDFs
  error?: string;
}

// Maximum file size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Generate unique file ID
 */
export function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Determine file type from extension and MIME type
 */
export function getFileType(file: File): 'text' | 'pdf' | 'image' | 'unsupported' {
  const extension = getFileExtension(file.name);
  const mimeType = file.type.toLowerCase();

  // Check PDF first (most specific)
  if (
    SUPPORTED_FILE_TYPES.pdf.extensions.includes(extension as any) ||
    SUPPORTED_FILE_TYPES.pdf.mimeTypes.includes(mimeType as any)
  ) {
    return 'pdf';
  }

  // Check image
  if (
    SUPPORTED_FILE_TYPES.image.extensions.includes(extension as any) ||
    SUPPORTED_FILE_TYPES.image.mimeTypes.some(m => mimeType.startsWith(m.split('/')[0]))
  ) {
    return 'image';
  }

  // Check text-based files
  if (
    SUPPORTED_FILE_TYPES.text.extensions.includes(extension as any) ||
    SUPPORTED_FILE_TYPES.text.mimeTypes.some(m => mimeType === m) ||
    mimeType.startsWith('text/')
  ) {
    return 'text';
  }

  return 'unsupported';
}

/**
 * Parse text file using FileReader
 */
async function parseTextFile(file: File): Promise<string> {
  console.log('[FileParser] Parsing text file:', file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      console.log('[FileParser] Text file parsed successfully:', {
        name: file.name,
        contentLength: result.length,
      });
      resolve(result);
    };
    reader.onerror = (error) => {
      console.error('[FileParser] Error reading text file:', {
        name: file.name,
        error,
        errorCode: reader.error?.code,
        errorMessage: reader.error?.message,
      });
      reject(new Error(`Failed to read text file: ${reader.error?.message || 'Unknown error'}`));
    };
    reader.readAsText(file);
  });
}

/**
 * Parse PDF file using pdfjs-dist (lazy loaded)
 */
async function parsePdfFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ content: string; pageCount: number }> {
  console.log('[FileParser] Parsing PDF file:', file.name);
  
  let pdfjsLib: any;
  
  try {
    // Lazy load pdfjs-dist
    console.log('[FileParser] Loading pdfjs-dist...');
    pdfjsLib = await import('pdfjs-dist');
    console.log('[FileParser] pdfjs-dist loaded, version:', pdfjsLib.version);
    
    // Set worker source - use local worker from public folder
    // PDF.js requires a worker to parse PDFs
    // Use local worker file instead of CDN for better reliability
    const workerSrc = '/pdf.worker.min.js';
    console.log('[FileParser] Setting PDF.js worker source to local file:', workerSrc);
    
    // Set worker source only if not already set
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    } else {
      console.log('[FileParser] Worker source already set:', pdfjsLib.GlobalWorkerOptions.workerSrc);
    }

    // Read file as ArrayBuffer
    console.log('[FileParser] Reading file as ArrayBuffer...');
    const arrayBuffer = await file.arrayBuffer();
    console.log('[FileParser] ArrayBuffer size:', arrayBuffer.byteLength);

    // Load PDF document with error handling
    console.log('[FileParser] Loading PDF document...');
    let pdf: any;
    
    try {
      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        verbosity: 0, // Suppress warnings
      });
      pdf = await loadingTask.promise;
    } catch (loadError: any) {
      const errorDetails = {
        name: loadError?.name,
        message: loadError?.message,
        stack: loadError?.stack,
        toString: loadError?.toString(),
      };
      console.error('[FileParser] Error loading PDF document:', errorDetails);
      throw new Error(`Failed to load PDF: ${loadError?.message || 'Unknown error'}`);
    }
    
    const pageCount = pdf.numPages;
    console.log('[FileParser] PDF loaded, page count:', pageCount);
    
    const textParts: string[] = [];

    // Extract text from each page
    let hasAnyText = false;
    for (let i = 1; i <= pageCount; i++) {
      try {
        console.log(`[FileParser] Extracting text from page ${i}/${pageCount}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract text items more carefully
        const pageText = textContent.items
          .map((item: any) => {
            // Handle different text item formats
            if (typeof item === 'string') {
              return item;
            }
            if (item.str) {
              return item.str;
            }
            if (item.text) {
              return item.text;
            }
            return '';
          })
          .filter((text: string) => text && text.trim().length > 0)
          .join(' ');
        
        console.log(`[FileParser] Page ${i} text extracted:`, {
          itemCount: textContent.items.length,
          textLength: pageText.length,
          preview: pageText.substring(0, 100),
        });
        
        if (pageText.trim().length > 0) {
          hasAnyText = true;
          textParts.push(`[Page ${i}]\n${pageText}`);
        } else {
          // For image-based PDFs, render page as image and convert to base64
          console.log(`[FileParser] No text found on page ${i}, attempting to render as image...`);
          try {
            const viewport = page.getViewport({ scale: 1.5 }); // Lower scale to reduce size
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            if (context) {
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              const renderContext = {
                canvasContext: context,
                viewport: viewport,
              };
              
              await page.render(renderContext).promise;
              
              // Convert canvas to base64 image (JPEG for smaller size)
              const imageData = canvas.toDataURL('image/jpeg', 0.8);
              console.log(`[FileParser] Page ${i} rendered as image, size: ${(imageData.length / 1024).toFixed(2)} KB`);
              
              // Include full image data for Vision API processing
              textParts.push(`[Page ${i} - Image-based PDF]\n[IMAGE_DATA:${imageData}]`);
            }
          } catch (renderError: any) {
            console.warn(`[FileParser] Failed to render page ${i} as image:`, renderError);
            textParts.push(`[Page ${i}]\n[Note: This page appears to be image-based or contains no extractable text. OCR may be required to extract content.]`);
          }
        }
        
        // Report progress
        if (onProgress) {
          onProgress(Math.round((i / pageCount) * 100));
        }
      } catch (pageError: any) {
        const errorDetails = {
          page: i,
          name: pageError?.name,
          message: pageError?.message,
          stack: pageError?.stack,
        };
        console.error(`[FileParser] Error extracting page ${i}:`, errorDetails);
        textParts.push(`[Page ${i}]\n[Error: Failed to extract text from this page - ${pageError?.message || 'Unknown error'}]`);
      }
    }
    
    // Log summary
    if (!hasAnyText) {
      console.warn('[FileParser] No text extracted from PDF. This appears to be an image-based or scanned PDF.');
    }

    const content = textParts.join('\n\n');
    console.log('[FileParser] PDF parsing completed:', {
      name: file.name,
      pageCount,
      contentLength: content.length,
    });

    return {
      content,
      pageCount,
    };
  } catch (error: any) {
    // Enhanced error logging
    const errorInfo: any = {
      name: file.name,
      errorType: error?.constructor?.name || typeof error,
      errorMessage: error?.message || String(error),
      errorName: error?.name,
      errorStack: error?.stack,
    };
    
    // Try to extract more details from the error
    if (error?.toString) {
      errorInfo.errorString = error.toString();
    }
    
    // Check for specific PDF.js errors
    if (error?.name === 'InvalidPDFException') {
      errorInfo.details = 'The file may not be a valid PDF or may be corrupted';
    } else if (error?.name === 'MissingPDFException') {
      errorInfo.details = 'PDF file is missing or could not be loaded';
    } else if (error?.message?.includes('worker')) {
      errorInfo.details = 'PDF.js worker failed to load. This may be a network or CORS issue.';
    }
    
    console.error('[FileParser] Error parsing PDF:', errorInfo);
    
    // Create a more user-friendly error message
    const userMessage = error?.message 
      ? `PDF parsing failed: ${error.message}`
      : 'Failed to parse PDF file. Please ensure the file is a valid PDF.';
    
    throw new Error(userMessage);
  }
}

/**
 * Parse image file to base64
 */
async function parseImageFile(file: File): Promise<string> {
  console.log('[FileParser] Parsing image file:', file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      console.log('[FileParser] Image file parsed successfully:', {
        name: file.name,
        dataUrlLength: result.length,
      });
      resolve(result);
    };
    reader.onerror = (error) => {
      console.error('[FileParser] Error reading image file:', {
        name: file.name,
        error,
        errorCode: reader.error?.code,
        errorMessage: reader.error?.message,
      });
      reject(new Error(`Failed to read image file: ${reader.error?.message || 'Unknown error'}`));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Main file parsing function
 */
export async function parseFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ParsedFile> {
  const id = generateFileId();
  const fileType = getFileType(file);

  console.log('[FileParser] Starting file parse:', {
    id,
    name: file.name,
    size: file.size,
    type: file.type,
    detectedType: fileType,
  });

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const errorMsg = `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    console.error('[FileParser] File size check failed:', {
      name: file.name,
      size: file.size,
      maxSize: MAX_FILE_SIZE,
    });
    return {
      id,
      name: file.name,
      size: file.size,
      type: fileType,
      mimeType: file.type,
      content: '',
      error: errorMsg,
    };
  }

  try {
    switch (fileType) {
      case 'text': {
        console.log('[FileParser] Processing as text file');
        const content = await parseTextFile(file);
        return {
          id,
          name: file.name,
          size: file.size,
          type: 'text',
          mimeType: file.type || 'text/plain',
          content,
        };
      }

      case 'pdf': {
        console.log('[FileParser] Processing as PDF file');
        const { content, pageCount } = await parsePdfFile(file, onProgress);
        return {
          id,
          name: file.name,
          size: file.size,
          type: 'pdf',
          mimeType: 'application/pdf',
          content,
          pageCount,
        };
      }

      case 'image': {
        console.log('[FileParser] Processing as image file');
        const content = await parseImageFile(file);
        return {
          id,
          name: file.name,
          size: file.size,
          type: 'image',
          mimeType: file.type,
          content,
        };
      }

      default:
        console.warn('[FileParser] Unsupported file type:', {
          name: file.name,
          type: file.type,
          detectedType: fileType,
        });
        return {
          id,
          name: file.name,
          size: file.size,
          type: 'unsupported',
          mimeType: file.type,
          content: '',
          error: `Unsupported file type: ${file.type || 'unknown'}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[FileParser] Error during file parsing:', {
      id,
      name: file.name,
      type: fileType,
      error,
      errorMessage,
      stack: errorStack,
    });
    
    return {
      id,
      name: file.name,
      size: file.size,
      type: fileType,
      mimeType: file.type,
      content: '',
      error: errorMessage,
    };
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get accepted file extensions string for input element
 */
export function getAcceptedFileTypes(): string {
  const allExtensions = [
    ...SUPPORTED_FILE_TYPES.text.extensions,
    ...SUPPORTED_FILE_TYPES.pdf.extensions,
    ...SUPPORTED_FILE_TYPES.image.extensions,
  ];
  return allExtensions.join(',');
}

/**
 * Format parsed files for prompt augmentation
 */
export function formatFilesForPrompt(files: ParsedFile[]): string {
  if (files.length === 0) return '';

  console.log('[FileParser] Formatting files for prompt:', {
    fileCount: files.length,
    files: files.map(f => ({
      name: f.name,
      type: f.type,
      hasError: !!f.error,
      contentLength: f.content?.length || 0,
      hasContent: !!f.content && f.content.length > 0,
    })),
  });

  const formattedFiles = files
    .filter(f => {
      // Include files even if content is short (might be scanned PDF or image-based PDF)
      // Only exclude files with actual errors
      if (f.error) {
        console.warn('[FileParser] Excluding file with error:', f.name, f.error);
        return false;
      }
      // Include files even if content is empty or very short
      // The LLM should know about the file even if we couldn't extract text
      return true;
    })
    .map(file => {
      if (file.type === 'image') {
        // For images, just note that an image is attached (Vision API will handle it differently)
        return `[Attached Image: ${file.name}]\n(Image content will be processed by Vision API)`;
      }

      const extension = getFileExtension(file.name).replace('.', '');
      const header = file.type === 'pdf' 
        ? `[Attached PDF: ${file.name} (${file.pageCount || 0} pages)]`
        : `[Attached File: ${file.name}]`;

      // Check if content contains image data markers
      const hasImageData = file.content && file.content.includes('[IMAGE_DATA:');
      
      // If content is empty or very short, add a note
      let content = file.content && file.content.trim().length > 0
        ? file.content
        : file.type === 'pdf'
          ? '[Note: This PDF appears to be image-based or scanned. Text extraction was limited. The file contains visual content that may require image analysis.]'
          : '[Note: File content could not be extracted or is empty.]';

      // For image-based PDFs with image data, format it properly
      if (hasImageData) {
        // Extract image data from markers
        const imageMatches = content.match(/\[IMAGE_DATA:(data:image\/[^)]+)\]/g);
        if (imageMatches && imageMatches.length > 0) {
          // Replace markers with actual image data for Vision API
          // Note: This will make the prompt very long, but necessary for image analysis
          imageMatches.forEach((match, index) => {
            const imageData = match.replace('[IMAGE_DATA:', '').replace(']', '');
            content = content.replace(match, `\n[Page ${index + 1} Image - Base64 encoded for Vision API analysis]\n${imageData.substring(0, 200)}... (full image data included in prompt)\n`);
          });
        }
      }

      return `${header}\n\`\`\`${extension || 'text'}\n${content}\n\`\`\``;
    })
    .join('\n\n');

  const result = formattedFiles ? `${formattedFiles}\n\n---\n\n` : '';
  console.log('[FileParser] Formatted prompt:', {
    resultLength: result.length,
    preview: result.substring(0, 500),
  });

  return result;
}

