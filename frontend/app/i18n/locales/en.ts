// English translations
export const en = {
  // Chat input
  chatInput: {
    placeholder: {
      waiting: 'Waiting for response...',
      default: 'Say something...',
    },
    button: {
      send: 'Send',
      abort: 'Abort',
    },
    title: {
      send: 'Send message',
      abort: 'Stop response',
    },
    info: {
      model: 'Model',
      agent: 'Agent',
      agentType: 'Agent Type',
    },
    profile: {
      default: 'Default',
      unavailable: 'Unavailable',
    },
    agentType: {
      basic: 'Basic',
      basicDescription: 'Direct LLM chat',
      langgraph: 'LangGraph',
      langgraphDescription: 'ReAct agent with tools',
    },
  },
  // File upload
  fileUpload: {
    button: {
      title: 'Attach file',
    },
    dragDrop: {
      hint: 'Drop files here',
    },
    status: {
      parsing: 'Processing...',
      error: 'Error',
    },
    error: {
      tooLarge: 'File is too large (max 10MB)',
      unsupported: 'Unsupported file type',
      parseFailed: 'Failed to process file',
    },
  },
  // Error messages
  error: {
    prefix: 'Error:',
  },
  // Chat stream
  chatStream: {
    thinking: 'Thinking...',
    userAborted: 'User aborted',
  },
  // Message bubble
  messageBubble: {
    copy: 'Copy',
    copied: 'Copied!',
    copyTitle: 'Copy to clipboard',
  },
  // Settings
  settings: {
    menu: 'Settings',
    title: 'Settings',
    close: 'Close',
    language: 'Language',
    theme: 'Theme',
    themeOptions: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
  },
  // Welcome screen
  welcome: {
    title: 'AI Studio 2.0',
    examples: [
      'What time is it now?',
      "What's the weather in Seoul?",
      'Tell me the current time and weather in London',
      'Create a simple web crawler in Python',
      'How to optimize React components',
      'Design a REST API with FastAPI',
      'Understanding TypeScript type system',
      'Docker container deployment guide',
      'Machine learning model evaluation metrics',
      'Database normalization principles',
      'Git branching strategy comparison',
      'Web security best practices',
    ],
  },
} as const;

