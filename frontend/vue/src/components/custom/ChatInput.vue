<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { type LLMProfile, type AgentType, AGENT_TYPES, fetchModelInfo, type ModelInfo } from '@/config'

const props = defineProps<{
  modelValue: string
  isLoading: boolean
  selectedLlm: LLMProfile | null
  allProfiles: LLMProfile[]
  selectedAgentType: AgentType
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'abort'): void
  (e: 'profileChange', profile: LLMProfile): void
  (e: 'agentTypeChange', agentType: AgentType): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const modelInfo = ref<ModelInfo | null>(null)
const showProfileDropdown = ref(false)
const showAgentDropdown = ref(false)
const dropdownRef = ref<HTMLDivElement | null>(null)
const agentDropdownRef = ref<HTMLDivElement | null>(null)

let hoverTimeout: ReturnType<typeof setTimeout> | null = null
let agentHoverTimeout: ReturnType<typeof setTimeout> | null = null

const hasInput = computed(() => props.modelValue.trim().length > 0)
const showSendButton = computed(() => !props.isLoading && hasInput.value)
const showAbortButton = computed(() => props.isLoading)
const currentProfileName = computed(() => props.selectedLlm?.name || modelInfo.value?.profile_name || '')

// Fetch model info
onMounted(async () => {
  try {
    modelInfo.value = await fetchModelInfo()
  } catch (err) {
    console.error('Failed to fetch model info:', err)
  }
  textareaRef.value?.focus()
})

// Re-focus when loading completes
watch(() => props.isLoading, (loading) => {
  if (!loading) {
    nextTick(() => textareaRef.value?.focus())
  }
})

// Auto-resize textarea
const resizeTextarea = () => {
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 400)
    textarea.style.height = `${newHeight}px`
  }
}

watch(() => props.modelValue, () => {
  nextTick(resizeTextarea)
})

const handleInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (!props.isLoading && hasInput.value) {
      emit('submit')
    }
  }
}

// Close dropdowns on click outside
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showProfileDropdown.value = false
  }
  if (agentDropdownRef.value && !agentDropdownRef.value.contains(event.target as Node)) {
    showAgentDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  if (hoverTimeout) clearTimeout(hoverTimeout)
  if (agentHoverTimeout) clearTimeout(agentHoverTimeout)
})

const handleProfileSelect = (profile: LLMProfile) => {
  emit('profileChange', profile)
  showProfileDropdown.value = false
}

// Hover helpers for model dropdown
const onModelEnter = () => {
  if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null }
  showProfileDropdown.value = true
}
const onModelLeave = () => {
  hoverTimeout = setTimeout(() => { showProfileDropdown.value = false; hoverTimeout = null }, 200)
}

// Hover helpers for agent dropdown
const onAgentEnter = () => {
  if (agentHoverTimeout) { clearTimeout(agentHoverTimeout); agentHoverTimeout = null }
  showAgentDropdown.value = true
}
const onAgentLeave = () => {
  agentHoverTimeout = setTimeout(() => { showAgentDropdown.value = false; agentHoverTimeout = null }, 200)
}
</script>

<template>
  <form
    class="fixed bottom-0 left-0 right-0 w-full max-w-full md:max-w-2xl lg:max-w-4xl mx-auto p-2 mb-8 bg-white dark:bg-[#252526]/95 backdrop-blur-sm border border-gray-300 dark:border-[#3e3e42] rounded-2xl shadow-xl dark:shadow-2xl z-40"
    @submit.prevent="emit('submit')"
  >
    <div class="flex items-end">
      <div class="flex-1 flex flex-col">
        <textarea
          ref="textareaRef"
          class="w-full p-2 rounded-xl resize-none overflow-y-auto min-h-[40px] max-h-[400px] bg-transparent text-gray-900 dark:text-[#d4d4d4] placeholder:text-gray-400 dark:placeholder:text-[#858585] focus:outline-none"
          style="height: auto"
          :value="modelValue"
          :placeholder="isLoading ? '응답 대기 중...' : '메시지를 입력하세요...'"
          :disabled="isLoading"
          rows="1"
          @input="handleInput"
          @keydown="handleKeyDown"
        />
        <!-- Model and Agent Info -->
        <div v-if="modelInfo" class="flex items-center gap-3 mt-1 px-2 text-xs text-gray-500 dark:text-gray-400 h-5">
          <!-- Model Selector -->
          <div ref="dropdownRef" class="relative">
            <span
              class="hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              @mouseenter="onModelEnter"
              @mouseleave="onModelLeave"
            >
              <svg class="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              모델: <span class="font-medium">{{ currentProfileName }}</span>
            </span>
            <!-- Model Dropdown -->
            <div
              v-if="showProfileDropdown && allProfiles.length > 0"
              class="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#252526] border border-gray-300 dark:border-[#3e3e42] rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto min-w-[200px]"
              @mouseenter="onModelEnter"
              @mouseleave="onModelLeave"
            >
              <button
                v-for="profile in allProfiles"
                :key="profile.name"
                type="button"
                :disabled="profile.available === false"
                class="w-full text-left px-3 py-2 text-sm transition-colors"
                :class="{
                  'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600': profile.available === false,
                  'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer': profile.available !== false && selectedLlm?.name === profile.name,
                  'hover:bg-gray-100 dark:hover:bg-[#2d2d30] text-gray-900 dark:text-[#cccccc] cursor-pointer': profile.available !== false && selectedLlm?.name !== profile.name,
                  'font-semibold': profile.default,
                }"
                @click="profile.available !== false && handleProfileSelect(profile)"
              >
                <div class="flex items-center justify-between">
                  <span>{{ profile.name }}</span>
                  <div class="flex items-center gap-2">
                    <span v-if="profile.available === false" class="text-xs text-orange-500 dark:text-orange-400">
                      비활성
                    </span>
                    <span v-if="profile.default" class="text-xs text-gray-500 dark:text-gray-400">
                      기본
                    </span>
                  </div>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ profile.provider }} / {{ profile.model }}
                </div>
              </button>
            </div>
          </div>

          <span class="text-gray-300 dark:text-gray-600">|</span>

          <!-- Agent Type Selector -->
          <div ref="agentDropdownRef" class="relative">
            <span
              class="hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
              @mouseenter="onAgentEnter"
              @mouseleave="onAgentLeave"
            >
              <svg class="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              에이전트: <span class="font-medium">{{ selectedAgentType }}</span>
            </span>
            <!-- Agent Dropdown -->
            <div
              v-if="showAgentDropdown"
              class="absolute bottom-full left-0 mb-2 bg-white dark:bg-[#252526] border border-gray-300 dark:border-[#3e3e42] rounded-lg shadow-lg z-50 min-w-[200px]"
              @mouseenter="onAgentEnter"
              @mouseleave="onAgentLeave"
            >
              <button
                v-for="agent in AGENT_TYPES"
                :key="agent.value"
                type="button"
                class="w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer"
                :class="{
                  'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30': selectedAgentType === agent.value,
                  'hover:bg-gray-100 dark:hover:bg-[#2d2d30] text-gray-900 dark:text-[#cccccc]': selectedAgentType !== agent.value,
                }"
                @click="emit('agentTypeChange', agent.value); showAgentDropdown = false"
              >
                <div class="font-medium">{{ agent.label }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ agent.description }}</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Send / Abort Button -->
      <div
        class="relative overflow-hidden transition-all duration-200"
        :class="{
          'opacity-100 scale-100 translate-x-0 ml-2 w-auto': showSendButton || showAbortButton,
          'opacity-0 scale-95 translate-x-2 ml-0 w-0 pointer-events-none': !showSendButton && !showAbortButton,
          'mb-6': modelInfo,
        }"
      >
        <!-- Send -->
        <button
          type="submit"
          class="absolute inset-0 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-xl whitespace-nowrap transition-all duration-200 px-3 py-2 cursor-pointer"
          :class="{
            'opacity-100 scale-100 translate-x-0 pointer-events-auto': showSendButton,
            'opacity-0 scale-95 translate-x-2 pointer-events-none': !showSendButton,
          }"
          :disabled="!showSendButton"
          title="전송"
        >
          전송
        </button>
        <!-- Abort -->
        <button
          type="button"
          class="absolute inset-0 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl whitespace-nowrap transition-all duration-200 px-3 py-2 cursor-pointer"
          :class="{
            'opacity-100 scale-100 translate-x-0 pointer-events-auto': showAbortButton,
            'opacity-0 scale-95 -translate-x-2 pointer-events-none': !showAbortButton,
          }"
          title="중단"
          @click="emit('abort')"
        >
          중단
        </button>
        <!-- Spacer -->
        <div class="invisible px-3 py-2 text-sm whitespace-nowrap">
          {{ showAbortButton ? '중단' : '전송' }}
        </div>
      </div>
    </div>
  </form>
</template>
