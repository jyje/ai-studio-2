---
trigger: model_decision
description: Standard of Frontend Mirror Development. If the user requests to implement a feature in one frontend, the agent must implement it in the other frontend as well.
---

# Frontend Mirror Development Rule

This policy ensures that the Next.js and Vue.js frontends remain functionally and visually identical. Any change made to one must be reflected in the other to maintain parity.

## Core Principle: Parity by Default
- **Functional Parity**: Both applications must implement the same business logic, API integrations, and state management flows.
- **Visual Parity**: Both applications must use identical Tailwind CSS classes, component structures, and design tokens to ensure a consistent user experience.
- **Backend Consistency**: Both frontends must consume the same FastAPI backend endpoints and handle data types/schemas identically.

## Tech Stack & Package Mirroring
When introducing a dependency in one frontend, the equivalent version for the other framework must be used.

| Feature / Domain | Next.js (React) Implementation | Vue.js Implementation |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | Vue 3 (Vite) |
| **AI Integration** | `@ai-sdk/react`, `ai` | `@ai-sdk/vue`, `ai` |
| **UI Components** | `shadcn-ui`, `ai-elements` | `shadcn-vue`, `ai-elements-vue` |
| **Icons** | `lucide-react` | `lucide-vue-next` |
| **Animation** | `motion` (Framer Motion) | `@motionone/vue` or `motion/vue` |
| **Flow/Diagrams** | `@xyflow/react` | `@xyflow/vue` |
| **Markdown** | `react-markdown` | `vue-markdown-render` or equivalent |
| **Styling** | Tailwind CSS 4 | Tailwind CSS 4 |
| **Utility** | `tailwind-merge`, `clsx` | `tailwind-merge`, `clsx` |
| **State Management** | React Context / Hooks | Vue Provide/Inject / Composables |

## Workflow Requirements
1. **Parallel Implementation**: When developing a feature, the agent should ideally implement it in both `frontend/next` and `frontend/vue` within the same task context.
2. **Package Synchronization**: If `npm install` is run in one folder for a new library, the corresponding library for the other framework must be installed in the other folder.
3. **UI Consistency**: Use the same Tailwind classes. Avoid framework-specific styling unless absolutely necessary.
4. **Verification**: After implementing a feature, verify it in both environments to ensure the "Mirror" requirement is met.

## Rationale
- Provides flexibility for users to choose their preferred frontend framework while receiving the same feature set.
- Simplifies maintenance by keeping logic consistent across platforms.
- Ensures a premium, "wow" factor regardless of the underlying technology.
