# Agent Guidelines

## Project Structure

This is a monorepo with separate frontend and backend applications:

```
ai-studio-2/
├── frontend/          # Next.js frontend application
│   ├── app/          # Next.js app directory
│   ├── package.json  # Frontend dependencies
│   ├── Dockerfile    # Production Dockerfile (multi-stage)
│   ├── Dockerfile.dev # Development Dockerfile (with debugging)
│   └── .gitignore    # Frontend-specific ignore rules
├── backend/          # FastAPI backend application
│   ├── app/          # Backend application code
│   ├── pyproject.toml # Backend dependencies (uv)
│   ├── Dockerfile    # Production Dockerfile (multi-stage)
│   ├── Dockerfile.dev # Development Dockerfile (with debugging)
│   └── .gitignore    # Backend-specific ignore rules
├── docker/           # Docker configuration
│   ├── docker-compose.yaml      # Production compose
│   └── docker-compose.dev.yaml  # Development compose
└── .gitignore        # Root-level ignore rules
```

## Package Management

### Frontend (Next.js)
- **Package Manager**: npm
- **Dependency File**: `frontend/package.json`
- **Installation**: `cd frontend && npm install`
- **Management Area**: All files under `frontend/` directory
- **Node Version**: 24 (specified in Dockerfiles)

### Backend (FastAPI)
- **Package Manager**: uv
- **Dependency File**: `backend/pyproject.toml`
- **Installation**: `cd backend && uv pip install -e .`
- **Management Area**: All files under `backend/` directory
- **Python Version**: 3.14+
- **Note**: `requirements.txt` is NOT used. All dependencies must be managed in `pyproject.toml`

## Code Style and Conventions

### Comments
- **All comments must be written in English**
- This includes:
  - Inline comments (`// comment`)
  - Block comments (`/* comment */`)
  - JSDoc comments (`/** comment */`)
  - Markdown comments (`<!-- comment -->`)
  - Python comments (`# comment`)
  - Code explanation comments

### Rationale
- Ensures consistency across the codebase
- Improves maintainability for international developers
- Aligns with industry best practices for code documentation

### Examples

✅ **Good:**
```typescript
// Auto-focus on component mount
useEffect(() => {
  inputRef.current?.focus();
}, []);

/**
 * Get backend URL from environment variables or use default value
 */
const getBackendBaseUrl = (): string => {
  // Use environment variable if available
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
};
```

❌ **Bad:**
```typescript
// 컴포넌트 마운트 시 자동 포커스
useEffect(() => {
  inputRef.current?.focus();
}, []);

/**
 * 환경 변수에서 백엔드 URL을 가져오거나 기본값 사용
 */
const getBackendBaseUrl = (): string => {
  // 환경 변수가 있으면 사용
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';
};
```

## File Structure

The project follows a layered architecture:

```
frontend/app/
├── config.ts                  # Configuration settings (top-level)
├── chat/
│   ├── Chat.tsx              # Main chat container component
│   ├── components/           # Reusable UI components
│   │   ├── MessageBubble.tsx    # Message bubble with markdown & code highlighting
│   │   ├── ChatInput.tsx        # Input form with textarea (multi-line support)
│   │   └── ErrorMessage.tsx      # Error display component
│   └── hooks/                 # Custom React hooks
│       ├── types.ts          # Type definitions
│       └── useChatStream.ts  # Streaming logic custom hook
├── components/               # Shared components
│   ├── SettingsButton.tsx    # Settings trigger button
│   ├── SettingsModal.tsx     # Language settings modal
│   └── ContextMenu.tsx       # Context menu component
├── i18n/                     # Internationalization
│   ├── locales/              # Translation files
│   │   ├── ko.ts             # Korean translations
│   │   ├── en.ts              # English translations
│   │   └── index.ts           # Locale exports
│   ├── hooks/
│   │   └── useTranslation.ts  # Translation hook
│   ├── context/
│   │   └── I18nContext.tsx    # i18n context provider
│   └── config.ts              # i18n configuration
└── page.tsx                   # Route entry point (minimal)
```

## UI Standards

### Chat Interface Components
- **AI SDK UI Components are the standard**: Always use AI SDK UI components and patterns for chat interfaces
- **Message Alignment**:
  - **User messages**: Right-aligned with blue background (`bg-blue-500 text-white`)
  - **AI messages**: Left-aligned with transparent background, markdown support
  - **System messages**: Right-aligned with orange background (`bg-orange-500`)
- **Message Bubbles**: Use rounded corners (`rounded-2xl`) for a modern chat bubble appearance
- **Layout**: Messages should be contained within a flex container with appropriate spacing (`gap-4`)
- **Timestamps**: Display in format `HH:mm:ss` (hours, minutes, seconds) with localized formatting

### Code Blocks
- **Syntax Highlighting**: Use `react-syntax-highlighter` with Prism and `vscDarkPlus` theme
- **Language Label**: Display language name in top-right corner (only if language is specified)
- **Copy Button**: Clipboard icon button in top-right corner with tooltip
- **Tooltip Delay**: 0.5 seconds before showing tooltip
- **Copy Feedback**: Show checkmark icon when copy succeeds
- **Font Weight**: Use `fontWeight: '500'` for better readability
- **Markdown Support**: Use `remark-gfm` for GitHub Flavored Markdown (tables, etc.)

### Button and Interactive Elements
- **Cursor Pointer**: All buttons and clickable elements MUST display a pointer cursor (`cursor-pointer`)
- This includes:
  - All `<button>` elements
  - Clickable cards or containers (e.g., example prompts)
  - Interactive icons (e.g., copy buttons, close buttons)
  - Any element with `onClick` handlers that trigger actions
- **Implementation Pattern**:
  ```typescript
  // Always include cursor-pointer in button className
  <button
    onClick={handleClick}
    className="px-4 py-2 bg-blue-500 text-white rounded cursor-pointer"
  >
    Click me
  </button>
  
  // For clickable containers
  <div
    onClick={handleClick}
    className="p-4 border rounded hover:bg-gray-50 cursor-pointer"
  >
    Clickable content
  </div>
  ```

### Input Field
- **Multi-line Support**: Use `<textarea>` instead of `<input>` for multi-line input
- **Keyboard Shortcuts**:
  - `Enter`: Submit message
  - `Shift+Enter`: Insert line break
- **Auto-resize**: Textarea automatically adjusts height (max 200px)
- **Visual States**: Loading, ready, and error states with appropriate UI feedback

### Copy Functionality
- **Code Block Copy**: Each code block has its own copy button with clipboard icon
- **Message Copy**: AI messages have copy button (visible on hover)
- **Tooltip**: Custom tooltip with 0.5s delay showing "Copy to clipboard" / "Copied!"
- **Visual Feedback**: Icon changes from clipboard to checkmark on success

### Welcome Screen
- **Title**: "AWESOME CHAT" displayed prominently
- **Example Prompts**: 10 curated examples, 3 randomly selected on each visit
- **Client-side Rendering**: Use `useEffect` to avoid hydration mismatch
- **Click to Fill**: Clicking an example auto-fills the input field

### Modal and Popup Accessibility
- **ESC Key Support**: All modals, popups, and blocking dialogs MUST support ESC key to close
- This includes:
  - Settings modals
  - Context menus
  - Confirmation dialogs
  - Any overlay that blocks user interaction
- **Implementation Pattern**:
  ```typescript
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);
  ```

### Rationale
- Ensures consistency with AI SDK design patterns
- Provides a familiar and accessible user experience
- Aligns with industry-standard chat interface conventions
- ESC key support is a standard accessibility feature that users expect

### Examples

✅ **Good:**
```typescript
<div className="flex flex-col gap-4">
  {messages.map(m => (
    <div
      key={m.id}
      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          m.role === 'user'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-200 text-gray-900'
        }`}
      >
        {m.content}
      </div>
    </div>
  ))}
</div>
```

❌ **Bad:**
```typescript
// Plain text without bubble styling
{messages.map(m => (
  <div key={m.id}>
    {m.role === 'user' ? 'User: ' : 'AI: '}
    {m.content}
  </div>
))}
```

## Docker Guidelines

### Development vs Production
- **Development Dockerfiles**: `Dockerfile.dev` - Include debugging tools, hot reload
- **Production Dockerfiles**: `Dockerfile` - Optimized, minimal runtime images
- **Multi-stage Builds**: Use builder and runner stages for optimal image sizes

### Frontend Docker
- **Production**: Next.js standalone mode, multi-stage build, non-root user
- **Development**: Node.js debugger port (9229), Turbo mode, source code mounting
- **Node Version**: 24 (alpine)

### Backend Docker
- **Production**: Multi-stage build, non-root user, minimal dependencies
- **Development**: Python debugger port (5678), hot reload, debugging tools (debugpy, ipdb)
- **Python Version**: 3.14 (slim)

### Docker Compose
- **Production**: `docker/docker-compose.yaml`
- **Development**: `docker/docker-compose.dev.yaml`
- **Networking**: Use service names for inter-container communication
- **Volumes**: Mount source code in development for hot reload

## Internationalization

### Implementation
- **Context Provider**: `I18nContext` manages locale state
- **Translation Hook**: `useTranslation()` provides `t()` function
- **Locale Storage**: User preference saved in localStorage
- **Hydration Safety**: Initialize with default locale, update in `useEffect` to avoid mismatch

### Adding Translations
1. Add translation keys to `frontend/app/i18n/locales/ko.ts` and `en.ts`
2. Use nested object structure for organization
3. Access via `t('path.to.key')` in components

## Best Practices

1. **Separation of Concerns**: Business logic is separated from UI components
2. **Reusability**: Custom hooks and utilities are designed for reuse
3. **Configuration Management**: All configuration is centralized in `config.ts`
4. **Type Safety**: TypeScript interfaces are used throughout the codebase
5. **UI Consistency**: Follow AI SDK UI component patterns for all chat interfaces
6. **Hydration Safety**: Avoid `Math.random()` or `Date.now()` in initial render
7. **Error Handling**: Comprehensive error handling with user-friendly messages
8. **Accessibility**: ESC key support, proper ARIA labels, keyboard navigation

## Git Management

### Monorepo Structure
- **Single Git Repository**: Only one `.git` directory at root level
- **Subdirectories**: Frontend and backend are NOT separate git repositories
- **Ignore Files**: Each directory has its own `.gitignore` for specific patterns
- **Root Ignore**: Root `.gitignore` for common files (OS, IDE, logs)

### Commit Messages
- **Language**: Use English for commit messages
- **Format**: Follow conventional commit format when possible
