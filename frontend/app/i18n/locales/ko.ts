// Korean translations
export const ko = {
  // Chat input
  chatInput: {
    placeholder: {
      waiting: '응답 대기 중...',
      default: '무언가 말해보세요...',
    },
    button: {
      send: '전송',
      abort: '중단',
    },
    title: {
      send: '메시지 전송',
      abort: '응답 중단',
    },
    info: {
      model: '모델',
      agent: '에이전트',
    },
  },
  // File upload
  fileUpload: {
    button: {
      title: '파일 첨부',
    },
    dragDrop: {
      hint: '파일을 여기에 놓으세요',
    },
    status: {
      parsing: '처리 중...',
      error: '오류',
    },
    error: {
      tooLarge: '파일이 너무 큽니다 (최대 10MB)',
      unsupported: '지원하지 않는 파일 형식입니다',
      parseFailed: '파일 처리에 실패했습니다',
    },
  },
  // Error messages
  error: {
    prefix: '오류:',
  },
  // Chat stream
  chatStream: {
    thinking: '생각 중',
    userAborted: '사용자가 중단했습니다',
  },
  // Message bubble
  messageBubble: {
    copy: '복사',
    copied: '복사됨!',
    copyTitle: '클립보드에 복사',
  },
  // Settings
  settings: {
    menu: '설정',
    title: '설정',
    close: '닫기',
    language: '언어',
    theme: '테마',
    themeOptions: {
      light: '라이트',
      dark: '다크',
      system: '시스템 설정',
    },
  },
  // Welcome screen
  welcome: {
    title: 'AI Studio 2.0',
    examples: [
      'Python으로 간단한 웹 크롤러 만들기',
      'React 컴포넌트 최적화 방법',
      'FastAPI로 REST API 설계하기',
      'TypeScript 타입 시스템 이해하기',
      'Docker 컨테이너 배포 가이드',
      '머신러닝 모델 평가 지표 설명',
      '데이터베이스 정규화 원칙',
      'Git 브랜치 전략 비교',
      '웹 보안 모범 사례',
      '마이크로서비스 아키텍처 설계',
    ],
  },
} as const;

