# AI Studio 2.0

A modern, full-stack AI chat application built with Next.js and FastAPI, featuring real-time streaming responses, code syntax highlighting, multilingual support, and comprehensive Docker containerization.

## 🚀 Features

### Core Chat Features
- **Real-time Streaming**: Server-Sent Events (SSE) for live AI responses
- **Message Interface**: Clean, modern chat UI with distinct user and AI message bubbles
- **Auto-scroll**: Intelligent scrolling that follows new messages
- **Error Handling**: Comprehensive error handling with user-friendly error messages
- **Message Timestamps**: Display timestamps in `HH:mm:ss` format with localized formatting

### Input & Interaction
- **Multi-line Input**: Shift+Enter for line breaks, Enter to send
- **Auto-resize Textarea**: Input field automatically adjusts height (max 200px)
- **Send/Abort Controls**: Clear visual feedback for message sending and cancellation
- **Keyboard Shortcuts**:
  - `Enter`: Send message
  - `Shift+Enter`: Insert line break
  - `ESC`: Abort ongoing response
  - `Cmd/Ctrl+A`: Select all messages and copy formatted version

### Welcome Screen
- **Dynamic Title**: "AWESOME CHAT" branding
- **Prompt Examples**: 10 curated example prompts
- **Random Selection**: Displays 3 random examples on each visit (client-side to avoid hydration issues)
- **Quick Start**: Click any example to auto-fill the input field

### Code Features
- **Syntax Highlighting**: Full code syntax highlighting using Prism (react-syntax-highlighter)
- **VS Code Dark Theme**: Professional code block styling with `vscDarkPlus`
- **Multi-language Support**: Supports all major programming languages
- **Language Label**: Displays programming language name in code block header (when specified)
- **Copy to Clipboard**: 
  - Individual code block copy buttons with clipboard icon
  - Message-level copy functionality
  - Custom tooltip with 0.5s delay
  - Visual feedback (checkmark icon) on successful copy
- **Font Weight**: Enhanced readability with `fontWeight: 500`

### Markdown Support
- **GitHub Flavored Markdown**: Full GFM support via `remark-gfm`
- **Tables**: Properly styled and responsive tables
- **Code Blocks**: Syntax highlighted with language detection
- **All Standard Markdown**: Headings, lists, links, blockquotes, etc.

### Internationalization
- **Multi-language**: Korean and English support
- **Language Switcher**: Settings modal for language selection
- **Localized Content**: All UI elements and example prompts translated
- **Persistent Preference**: Language choice saved in localStorage
- **Hydration Safe**: Proper client-side initialization to avoid SSR mismatch

### User Experience
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Dark Mode Ready**: UI components support dark mode
- **Accessibility**: ESC key support for modals and dialogs
- **Formatted Copy**: Messages copied with timestamps and role labels
- **Tooltips**: Custom tooltips with appropriate delays for better UX

## 📁 Project Structure

```
ai-studio-2/
├── backend/              # Backend applications
│   └── fastapi/          # FastAPI backend application
├── frontend/             # Frontend applications
│   ├── next/             # Next.js frontend application
│   └── vue/              # Vue frontend application (initialized via Vite)
├── docker/               # Docker configuration
│   ├── docker-compose.yaml      # Production compose
│   └── docker-compose.dev.yaml  # Development compose
├── .gitignore            # Root-level ignore rules
├── AGENTS.md             # Development guidelines
└── README.md             # This file
```

## 🛠️ Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **OpenAI SDK**: OpenAI-compatible API client
- **Uvicorn**: ASGI server
- **Python 3.12**: Runtime environment
- **uv**: Python package manager

### Frontend
- **Next.js 16**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first CSS framework
- **react-markdown**: Markdown rendering
- **remark-gfm**: GitHub Flavored Markdown support
- **react-syntax-highlighter**: Code syntax highlighting
- **Vercel AI SDK**: AI integration utilities

## 🚦 Getting Started

### Prerequisites
- **Python 3.12** with `uv` package manager
- **Node.js 24+** with `pnpm`
- **Docker** (optional, for containerized deployment)
- **OpenAI-compatible API** (or OpenAI API key)

### Local Development Setup

#### Backend Setup

1. Navigate to backend directory:
```bash
cd backend/fastapi
```

2. Install dependencies using uv:
```bash
uv sync
```

3. Configure environment variables:
Create a `.env` file or set environment variables:
```bash
export LLM_API_BASE_URL="https://api.openai.com/v1"  # or your API endpoint
export LLM_API_KEY="your-api-key"
export LLM_MODEL_NAME="gpt-4"  # or your model name
```

4. Run the development server:
```bash
uv run fastapi dev app/main.py --port 8000
```

The backend will be available at `http://127.0.0.1:8000`

#### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend/next
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables (optional):
Create a `.env.local` file:
```bash
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

4. Run the development server:
```bash
pnpm dev
```

The frontend will be available at `http://localhost:4000`

#### Vue Frontend Setup

1. Navigate to the Vue frontend directory:
```bash
cd frontend/vue
```

2. Install dependencies:
```bash
pnpm install
```

4. Run the development server:
```bash
pnpm dev
```

The Vue frontend will be available at `http://localhost:3000`

### Docker Setup

#### Development Environment

For development with hot reload and debugging:

```bash
cd docker
docker-compose -f docker-compose.dev.yaml up --build
```

**Features:**
- Hot reload enabled (code changes auto-refresh)
- Debugging ports exposed:
  - Frontend: `9229` (Node.js debugger)
  - Backend: `5678` (Python debugger - debugpy)
- Source code mounted for live editing
- Development dependencies included

**Access:**
- Next.js: `http://localhost:4000`
- Vue.js: `http://localhost:3000`
- Backend: `http://127.0.0.1:8000` (use 127.0.0.1, not localhost)

#### Production Environment

For optimized production deployment:

```bash
cd docker
docker-compose up --build
```

**Features:**
- Multi-stage builds for minimal image sizes
- Next.js standalone mode for optimal performance
- Non-root user execution for security
- Production dependencies only

## 📝 Configuration

### Backend Configuration

Edit `backend/fastapi/app/config.py` or set environment variables:
- `LLM_API_BASE_URL`: API endpoint URL
- `LLM_API_KEY`: API authentication key
- `LLM_MODEL_NAME`: Model identifier

### Frontend Configuration

Edit `frontend/next/app/config.ts` or set environment variables:
- `NEXT_PUBLIC_BACKEND_URL`: Backend API URL (default: `http://127.0.0.1:8000`)

**Note**: Use `127.0.0.1` instead of `localhost` to avoid IPv6/IPv4 resolution issues.

### Next.js Configuration

`frontend/next/next.config.ts`:
- Standalone output mode for production Docker builds
- Image optimization enabled

## 🎨 UI Components

### Chat Interface
- **User Messages**: Right-aligned blue bubbles (`bg-blue-500 text-white`)
- **AI Messages**: Left-aligned with markdown support and code highlighting
- **System Messages**: Orange bubbles for system notifications
- **Message Timestamps**: Localized time display in `HH:mm:ss` format

### Code Blocks
- **Syntax Highlighting**: VS Code dark theme (`vscDarkPlus`)
- **Language Label**: Shows programming language name (when specified)
- **Copy Button**: Clipboard icon in top-right corner
- **Tooltip**: Custom tooltip with 0.5s delay
- **Font Weight**: `500` for better readability
- **Responsive**: Horizontal scroll for long lines

### Input Field
- **Multi-line Support**: Auto-expanding textarea (max 200px)
- **Visual States**: Loading, ready, and error states
- **Button Transitions**: Smooth animations for send/abort buttons
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for line break

### Welcome Screen
- **Title**: "AWESOME CHAT" prominently displayed
- **Examples**: 3 randomly selected from 10 curated prompts
- **Interactive**: Click to auto-fill input field

## 🌐 Internationalization

### Supported Languages
- **Korean (ko)**: 한국어
- **English (en)**: English

### Adding New Languages

1. Create a new translation file in `frontend/next/app/i18n/locales/`
2. Export translations matching the structure in `ko.ts` or `en.ts`
3. Add the locale to `frontend/next/app/i18n/config.ts`
4. Update the settings modal to include the new language

### Translation Structure

```typescript
export const locale = {
  chatInput: { ... },
  error: { ... },
  chatStream: { ... },
  messageBubble: { ... },
  settings: { ... },
  welcome: { ... },
} as const;
```

## 🔧 Development

### Code Style
- **Comments**: All comments must be in English (see `AGENTS.md`)
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with Next.js config

### Key Features Implementation

#### Streaming Chat
- Uses Server-Sent Events (SSE) for real-time responses
- Handles client disconnections gracefully
- Error recovery and retry mechanisms
- Proper event parsing and state management

#### Code Highlighting
- Prism-based syntax highlighting via `react-syntax-highlighter`
- Supports 100+ programming languages
- Custom VS Code dark theme styling
- Language detection from markdown code fences

#### Copy Functionality
- Clipboard API with fallback for older browsers
- Custom tooltip implementation with 0.5s delay
- Visual feedback with icon state changes (clipboard → checkmark)
- Formatted message export with timestamps and role labels

#### Markdown Rendering
- GitHub Flavored Markdown via `remark-gfm`
- Custom component styling for all markdown elements
- Table support with proper styling
- Code block integration with syntax highlighting

## 🐳 Docker

### Architecture

The project uses multi-stage Docker builds for optimal image sizes:

#### Frontend
- **Builder Stage**: Install dependencies and build Next.js app
- **Runner Stage**: Minimal runtime with only production files
- **Standalone Mode**: Next.js standalone output for efficient deployment

#### Backend
- **Builder Stage**: Install dependencies and prepare virtual environment
- **Runner Stage**: Copy only necessary files, use non-root user

### Development vs Production

| Feature | Development | Production |
|---------|------------|------------|
| Hot Reload | ✅ Enabled | ❌ Disabled |
| Debugging | ✅ Ports exposed | ❌ Not exposed |
| Source Mount | ✅ Yes | ❌ No |
| Image Size | Larger | Optimized |
| Dependencies | All (dev + prod) | Production only |

### Debugging

#### Frontend (Node.js)
- Debugger port: `9229`
- Attach VS Code debugger to `localhost:9229`

#### Backend (Python)
- Debugger port: `5678`
- Use `debugpy` for remote debugging
- Attach VS Code Python debugger to `localhost:5678`

## 📦 Dependencies

### Backend
- `fastapi`: Web framework
- `uvicorn`: ASGI server
- `openai`: OpenAI API client

### Frontend
- `next`: React framework
- `react`: UI library
- `react-markdown`: Markdown rendering
- `remark-gfm`: GitHub Flavored Markdown
- `react-syntax-highlighter`: Code highlighting
- `tailwindcss`: CSS framework

## 🔒 Security

### Docker
- Non-root user execution in production containers
- Minimal base images (alpine/slim)
- Separate development and production configurations

### Environment Variables
- Never commit `.env` files
- Use environment variables for sensitive data
- Backend: API keys and endpoints
- Frontend: Public configuration only

## 📄 License

See [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Follow the code style guidelines in `AGENTS.md`
2. Ensure all comments are in English
3. Test your changes thoroughly
4. Update documentation as needed
5. Use conventional commit messages (in English)

## 🎯 Roadmap

- [ ] Additional language support
- [ ] Message history persistence
- [ ] Custom theme selection
- [ ] Export conversation as markdown/PDF
- [ ] Voice input support
- [ ] Mobile app version

---

Built with ❤️ using Next.js, Vue.js, and FastAPI
