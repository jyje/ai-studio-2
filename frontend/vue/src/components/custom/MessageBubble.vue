<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '@/composables/useChatStream'

const props = defineProps<{
  message: Message
}>()

const isUser = computed(() => props.message.role === 'user')
const isSystem = computed(() => props.message.role === 'system')
const isAssistant = computed(() => props.message.role === 'assistant')

const timestamp = computed(() => {
  if (!props.message.timestamp) return ''
  return new Date(props.message.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })
})
</script>

<template>
  <!-- System message -->
  <div v-if="isSystem" class="flex justify-center my-2">
    <div class="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2d2d30] rounded-full">
      {{ message.content }}
    </div>
  </div>

  <!-- User message -->
  <div v-else-if="isUser" class="flex justify-end">
    <div class="max-w-[85%] px-4 py-3 rounded-2xl bg-blue-500 text-white shadow-sm">
      <div class="whitespace-pre-wrap break-words text-sm">{{ message.content }}</div>
      <div v-if="timestamp" class="text-xs text-blue-200 mt-1 text-right">{{ timestamp }}</div>
    </div>
  </div>

  <!-- Assistant message -->
  <div v-else-if="isAssistant" class="flex justify-start">
    <div class="max-w-[85%] px-4 py-3 rounded-2xl bg-gray-100 dark:bg-[#2d2d30] text-gray-900 dark:text-[#d4d4d4] shadow-sm">
      <!-- Tool calls -->
      <div v-if="message.toolCalls && message.toolCalls.length > 0" class="mb-3">
        <div
          v-for="tc in message.toolCalls"
          :key="tc.id"
          class="flex items-center gap-2 text-xs px-2 py-1 mb-1 rounded bg-gray-200 dark:bg-[#3e3e42]"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="{
              'bg-yellow-400 animate-pulse': tc.status === 'running',
              'bg-green-400': tc.status === 'completed',
              'bg-red-400': tc.status === 'error',
            }"
          />
          <span class="font-mono">{{ tc.tool }}</span>
          <span v-if="tc.status === 'running'" class="text-gray-400">실행 중...</span>
          <span v-else-if="tc.status === 'completed'" class="text-green-500 dark:text-green-400">완료</span>
        </div>
      </div>

      <!-- Plan -->
      <div v-if="message.plan && message.plan.length > 0" class="mb-3">
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">실행 계획</div>
        <div
          v-for="step in message.plan"
          :key="step.step_number"
          class="flex items-center gap-2 text-xs px-2 py-1 mb-0.5"
        >
          <span v-if="step.status === 'completed'" class="text-green-500">✓</span>
          <span v-else-if="step.status === 'in_progress'" class="text-blue-500 animate-pulse">●</span>
          <span v-else class="text-gray-400">○</span>
          <span>{{ step.description }}</span>
        </div>
      </div>

      <!-- Content -->
      <div class="whitespace-pre-wrap break-words text-sm">{{ message.content }}</div>

      <!-- Meta info -->
      <div v-if="message.meta" class="flex items-center gap-2 mt-2">
        <span v-if="message.meta.modelName" class="text-xs text-gray-400 dark:text-gray-500">
          {{ message.meta.modelName }}
        </span>
        <span v-if="message.meta.agentType" class="text-xs text-gray-400 dark:text-gray-500">
          · {{ message.meta.agentType }}
        </span>
        <span v-if="timestamp" class="text-xs text-gray-400 dark:text-gray-500">
          · {{ timestamp }}
        </span>
      </div>
      <div v-else-if="timestamp" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {{ timestamp }}
      </div>
    </div>
  </div>
</template>
