<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useChatStream, type Message } from '@/composables/useChatStream'
import { getChatApiUrl, fetchModelsList, type LLMProfile, type ModelsListResponse, AGENT_TYPES } from '@/config'
import CustomChatInput from '@/components/custom/ChatInput.vue'
import CustomMessageBubble from '@/components/custom/MessageBubble.vue'

const {
  messages,
  isLoading,
  error,
  sendMessage,
  abort,
  clearError,
  selectedLLM,
  selectedAgentType,
  currentNode,
} = useChatStream(getChatApiUrl())

const input = ref('')
const allProfiles = ref<LLMProfile[]>([])
const messagesContainerRef = ref<HTMLDivElement | null>(null)
const shouldAutoScroll = ref(true)

// Welcome examples
const welcomeExamples = ref<string[]>([
  '오늘 날씨를 알려줘',
  'TypeScript에서 제네릭 타입의 장점을 설명해줘',
  'FastAPI로 RESTful API를 만드는 방법을 알려줘',
])

const hasMessages = computed(() => messages.value.length > 0)

// Fetch models list on mount
onMounted(async () => {
  try {
    const list = await fetchModelsList()
    const profiles: LLMProfile[] = []
    for (const provider of list.providers) {
      profiles.push(...(list.models[provider] || []))
    }
    allProfiles.value = profiles
  } catch (err) {
    console.error('Failed to fetch models list:', err)
  }
})

// Scroll handling
const isAtBottom = (): boolean => {
  const windowHeight = window.innerHeight
  const documentHeight = document.documentElement.scrollHeight
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  return documentHeight - scrollTop - windowHeight < 100
}

const scrollToBottom = () => {
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior: 'smooth',
  })
}

const handleScroll = () => {
  shouldAutoScroll.value = isAtBottom()
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

// Auto-scroll when messages update
watch(messages, () => {
  if (shouldAutoScroll.value) {
    nextTick(() => {
      requestAnimationFrame(() => scrollToBottom())
    })
  }
}, { deep: true })

// Reset auto-scroll when loading starts
watch(isLoading, (loading) => {
  if (loading) {
    shouldAutoScroll.value = true
    scrollToBottom()
  }
})

// ESC to abort
onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isLoading.value) {
      e.preventDefault()
      abort()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
})

const handleSubmit = async () => {
  if (!input.value.trim() || isLoading.value) return
  const messageContent = input.value
  input.value = ''
  await sendMessage(messageContent)
}

const handleExampleClick = (example: string) => {
  input.value = example
}
</script>

<template>
  <div class="flex flex-col w-full max-w-full md:max-w-2xl lg:max-w-4xl py-24 mx-auto stretch px-4">
    <!-- Welcome screen -->
    <div v-if="!hasMessages" class="flex flex-col items-center justify-center min-h-[60vh] pb-32">
      <h1 class="text-5xl font-bold mb-12 text-gray-900 dark:text-[#cccccc]">
        AI Studio 2.0
      </h1>
      <div class="flex flex-col gap-3 w-full max-w-2xl">
        <button
          v-for="(example, index) in welcomeExamples"
          :key="index"
          class="text-left p-4 rounded-xl border border-gray-300 dark:border-[#3e3e42] bg-white dark:bg-[#252526] hover:bg-gray-50 dark:hover:bg-[#2d2d30] transition-colors shadow-sm hover:shadow-md cursor-pointer"
          @click="handleExampleClick(example)"
        >
          <span class="text-gray-900 dark:text-[#cccccc]">{{ example }}</span>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainerRef" class="flex flex-col gap-4 pb-32 outline-none select-text" tabindex="0">
      <CustomMessageBubble
        v-for="m in messages"
        :key="m.id"
        :message="m"
      />
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="fixed bottom-28 left-1/2 -translate-x-1/2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-2 z-50"
    >
      <span>{{ error.message }}</span>
      <button class="text-red-400 hover:text-red-600 cursor-pointer" @click="clearError">✕</button>
    </div>

    <!-- Chat Input -->
    <CustomChatInput
      v-model="input"
      :is-loading="isLoading"
      :selected-llm="selectedLLM"
      :all-profiles="allProfiles"
      :selected-agent-type="selectedAgentType"
      @submit="handleSubmit"
      @abort="abort"
      @profile-change="selectedLLM = $event"
      @agent-type-change="selectedAgentType = $event"
    />
  </div>
</template>
