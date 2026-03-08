import { ref, onMounted, onUnmounted } from 'vue'
import {
    type LLMProfile,
    type AgentType,
    type ModelsListResponse,
    fetchModelsList,
    getDefaultModel,
    generateSessionId,
} from '@/config'

export interface MessageMeta {
    modelName?: string
    agentType?: AgentType
}

export interface ToolCall {
    id: string
    tool: string
    input: Record<string, unknown>
    output?: string
    status: 'running' | 'completed' | 'error'
}

export interface PlanStep {
    step_number: number
    description: string
    status: 'pending' | 'in_progress' | 'completed' | 'skipped'
}

export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp?: Date
    meta?: MessageMeta
    toolCalls?: ToolCall[]
    plan?: PlanStep[]
    suggestions?: string[]
}

export function useChatStream(apiUrl: string) {
    const messages = ref<Message[]>([])
    const isLoading = ref(false)
    const error = ref<Error | null>(null)
    const selectedLLM = ref<LLMProfile | null>(null)
    const selectedAgentType = ref<AgentType>('langgraph')
    const currentNode = ref<string | null>(null)
    const sessionId = ref<string>(generateSessionId())

    let abortController: AbortController | null = null

    const generateMessageId = (): string => {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    // Load default model on mount
    onMounted(async () => {
        try {
            const modelsList = await fetchModelsList()
            const defaultLLM = getDefaultModel(modelsList)
            if (defaultLLM) {
                selectedLLM.value = defaultLLM
            }
        } catch (err) {
            console.error('Failed to load default LLM:', err)
        }
    })

    const sendMessage = async (content: string) => {
        if (!content.trim() || isLoading.value) return

        const userMessage: Message = {
            id: generateMessageId(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
        }

        messages.value.push(userMessage)
        isLoading.value = true
        error.value = null

        if (abortController) {
            abortController.abort()
        }
        abortController = new AbortController()

        const assistantMessageId = generateMessageId()
        const thinkingText = '생각 중...'
        const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: thinkingText,
            timestamp: new Date(),
        }

        // Clear suggestions from previous assistant messages
        messages.value = messages.value.map((msg) =>
            msg.role === 'assistant' && msg.id !== assistantMessageId
                ? { ...msg, suggestions: undefined }
                : msg
        )
        messages.value.push(assistantMessage)

        const currentMeta: MessageMeta = {
            modelName: selectedLLM.value?.name || selectedLLM.value?.model || 'Unknown',
            agentType: selectedAgentType.value,
        }

        const toolCalls: ToolCall[] = []
        let toolCallIdCounter = 0
        let currentPlan: PlanStep[] = []
        let accumulatedContent = ''
        let isFirstToken = true
        let streamEnded = false

        const generateToolCallId = (): string => {
            return `tool-${Date.now()}-${toolCallIdCounter++}`
        }

        const updateAssistantMessage = (updates: Partial<Message>) => {
            const idx = messages.value.findIndex((m) => m.id === assistantMessageId)
            if (idx !== -1) {
                messages.value[idx] = { ...messages.value[idx], ...updates }
            }
        }

        const finalizeMessage = (finalContent: string) => {
            if (finalContent && finalContent !== thinkingText) {
                const completedPlan = currentPlan.map((step) => ({
                    ...step,
                    status: 'completed' as const,
                }))
                updateAssistantMessage({
                    content: finalContent,
                    meta: currentMeta,
                    toolCalls: toolCalls.length > 0 ? [...toolCalls] : undefined,
                    plan: completedPlan.length > 0 ? completedPlan : undefined,
                })
            }
        }

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content.trim(),
                    model: selectedLLM.value?.name || selectedLLM.value?.model || '',
                    ...(selectedLLM.value?.provider ? { provider: selectedLLM.value.provider } : {}),
                    agent_type: selectedAgentType.value,
                    session_id: sessionId.value,
                }),
                signal: abortController.signal,
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            if (!response.body) {
                throw new Error('Response body is null')
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            while (!streamEnded) {
                const { done, value } = await reader.read()

                if (done) {
                    finalizeMessage(accumulatedContent)
                    break
                }

                buffer += decoder.decode(value, { stream: true })
                const parts = buffer.split('\n\n')
                buffer = parts.pop() || ''

                for (const message of parts) {
                    if (!message.trim()) continue

                    const lines = message.split('\n')
                    let eventType = ''
                    let data = ''

                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            eventType = line.substring(7).trim()
                        } else if (line.startsWith('data: ')) {
                            data = line.substring(6).trim()
                        }
                    }

                    if (eventType === 'start') continue
                    else if (eventType === 'end') {
                        finalizeMessage(accumulatedContent)
                        streamEnded = true
                        break
                    } else if (eventType === 'node_start') {
                        try {
                            const nodeData = JSON.parse(data)
                            currentNode.value = nodeData.node
                        } catch { }
                        continue
                    } else if (eventType === 'node_end') {
                        continue
                    } else if (eventType === 'tool_start') {
                        try {
                            const toolData = JSON.parse(data)
                            toolCalls.push({
                                id: generateToolCallId(),
                                tool: toolData.tool,
                                input: toolData.input || {},
                                status: 'running',
                            })
                            updateAssistantMessage({ toolCalls: [...toolCalls] })
                            currentNode.value = selectedAgentType.value === 'plan-1' ? 'TOOL' : 'tools'
                        } catch { }
                        continue
                    } else if (eventType === 'tool_end') {
                        try {
                            const toolData = JSON.parse(data)
                            const tc = toolCalls.find((t) => t.tool === toolData.tool && t.status === 'running')
                            if (tc) {
                                tc.output = toolData.output || ''
                                tc.status = 'completed'
                                updateAssistantMessage({ toolCalls: [...toolCalls] })
                            }
                            currentNode.value = selectedAgentType.value === 'plan-1' ? 'MAIN' : 'agent'
                        } catch { }
                        continue
                    } else if (eventType === 'plan_created') {
                        try {
                            const planData = JSON.parse(data)
                            currentPlan = (planData.plan || []).map((s: PlanStep) => ({ ...s, status: 'pending' as const }))
                            updateAssistantMessage({ plan: [...currentPlan] })
                        } catch { }
                        continue
                    } else if (eventType === 'plan_step_completed') {
                        try {
                            const stepData = JSON.parse(data)
                            currentPlan = currentPlan.map((s) =>
                                s.step_number === stepData.step_number ? { ...s, status: 'completed' as const } : s
                            )
                            updateAssistantMessage({ plan: [...currentPlan] })
                        } catch { }
                        continue
                    } else if (eventType === 'suggestions') {
                        try {
                            const sugData = JSON.parse(data)
                            updateAssistantMessage({ suggestions: sugData.suggestions || [] })
                        } catch { }
                        continue
                    } else if (eventType === 'token' || eventType === '') {
                        if (!data) continue
                        let tokenContent = data
                        try {
                            const parsed = JSON.parse(data)
                            if (typeof parsed === 'string') tokenContent = parsed
                        } catch { }

                        if (isFirstToken) {
                            isFirstToken = false
                            accumulatedContent = tokenContent
                        } else {
                            accumulatedContent += tokenContent
                        }

                        updateAssistantMessage({ content: accumulatedContent })
                        continue
                    } else if (eventType === 'error') {
                        try {
                            const errorData = JSON.parse(data)
                            throw new Error(errorData.error || 'Unknown error')
                        } catch (e) {
                            throw e instanceof Error ? e : new Error(data || 'Unknown error')
                        }
                    }

                    // Fallback for unknown data events
                    if (data) {
                        let processedData = ''
                        try {
                            const parsedData = JSON.parse(data)
                            if (parsedData.error) throw new Error(parsedData.error)
                            if (typeof parsedData === 'string') processedData = parsedData
                            else if (parsedData.status === 'completed') {
                                finalizeMessage(accumulatedContent)
                                streamEnded = true
                                break
                            }
                        } catch (e) {
                            if (e instanceof Error && e.message !== data) throw e
                            processedData = data
                        }

                        if (processedData) {
                            if (isFirstToken) {
                                isFirstToken = false
                                accumulatedContent = processedData
                            } else {
                                accumulatedContent += processedData
                            }
                            updateAssistantMessage({ content: accumulatedContent })
                        }
                    }
                }
            }

            if (isFirstToken && accumulatedContent === '') {
                messages.value = messages.value.filter((m) => m.id !== assistantMessageId)
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return
            console.error('Chat error:', err)
            const chatError = err instanceof Error ? err : new Error('Unknown error occurred')
            error.value = chatError
            messages.value = messages.value.filter((m) => m.id !== assistantMessageId)
        } finally {
            isLoading.value = false
            currentNode.value = null
            abortController = null
        }
    }

    const abort = () => {
        if (abortController) {
            abortController.abort()
            abortController = null
            isLoading.value = false

            const thinkingText = '생각 중...'
            messages.value = messages.value
                .map((msg) => {
                    if (msg.role === 'assistant' && msg.content && msg.content !== thinkingText) {
                        return {
                            ...msg,
                            meta: {
                                modelName: selectedLLM.value?.name || 'Unknown',
                                agentType: selectedAgentType.value,
                            },
                        }
                    }
                    return msg
                })
                .filter((msg) => !(msg.role === 'assistant' && msg.content === thinkingText))

            messages.value.push({
                id: generateMessageId(),
                role: 'system',
                content: '사용자에 의해 중단되었습니다.',
                timestamp: new Date(),
            })
        }
    }

    const clearError = () => {
        error.value = null
    }

    const resetSession = () => {
        sessionId.value = generateSessionId()
        messages.value = []
        error.value = null
    }

    onUnmounted(() => {
        if (abortController) {
            abortController.abort()
        }
    })

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        abort,
        clearError,
        selectedLLM,
        selectedAgentType,
        currentNode,
        sessionId,
        resetSession,
    }
}
