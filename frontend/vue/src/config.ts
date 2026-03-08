/**
 * Chat configuration settings (mirrors Next.js app/config.ts)
 */

export interface ChatConfig {
    backendBaseUrl: string
    chatEndpoint: string
    timeout?: number
}

export type AgentType = 'basic' | 'langgraph' | 'plan-1'

export const AGENT_TYPES: { value: AgentType; label: string; description: string; hasGraph: boolean }[] = [
    { value: 'basic', label: 'Basic', description: 'Direct LLM chat', hasGraph: false },
    { value: 'langgraph', label: 'LangGraph', description: 'ReAct agent with tools', hasGraph: true },
    { value: 'plan-1', label: 'Plan-1', description: 'Planning agent with QUERY/MAIN/TOOL', hasGraph: true },
]

export const getBackendBaseUrl = (): string => {
    return import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'
}

export const chatConfig: ChatConfig = {
    backendBaseUrl: getBackendBaseUrl(),
    chatEndpoint: '/v2/chat',
    timeout: 30000,
}

export const getChatApiUrl = (): string => {
    const baseUrl = chatConfig.backendBaseUrl.replace(/\/$/, '')
    const endpoint = chatConfig.chatEndpoint.startsWith('/')
        ? chatConfig.chatEndpoint
        : `/${chatConfig.chatEndpoint}`
    return `${baseUrl}${endpoint}`
}

export const getInfoApiUrl = (): string => {
    const baseUrl = chatConfig.backendBaseUrl.replace(/\/$/, '')
    return `${baseUrl}/v2/info`
}

export interface ModelInfo {
    profile_name: string
    provider: string
    agent: string
}

export interface LLMProfile {
    name: string
    provider: string
    provider_name?: string
    model: string
    base_url: string
    model_type?: string
    default: boolean
    available?: boolean
}

export interface ModelsListResponse {
    models: Record<string, LLMProfile[]>
    providers: string[]
}

export const fetchModelInfo = async (): Promise<ModelInfo> => {
    const url = getInfoApiUrl()
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch model info: ${response.statusText}`)
    }
    return await response.json()
}

export const getModelsApiUrl = (): string => {
    const baseUrl = chatConfig.backendBaseUrl.replace(/\/$/, '')
    return `${baseUrl}/v2/models`
}

export const getGraphApiUrl = (): string => {
    const baseUrl = chatConfig.backendBaseUrl.replace(/\/$/, '')
    return `${baseUrl}/v2/graph`
}

export interface GraphNode {
    id: string
    type: 'start' | 'end' | 'node'
    label?: string
}

export interface GraphEdge {
    source: string
    target: string
    conditional?: boolean
    label?: string
    sourceHandle?: string
    targetHandle?: string
}

export interface GraphStructureResponse {
    nodes: GraphNode[]
    edges: GraphEdge[]
}

export const fetchGraphStructure = async (agentType: AgentType = 'langgraph'): Promise<GraphStructureResponse> => {
    const baseUrl = getGraphApiUrl()
    const url = `${baseUrl}?agent_type=${encodeURIComponent(agentType)}`
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch graph structure: ${response.statusText}`)
    }
    return await response.json()
}

export const fetchModelsList = async (): Promise<ModelsListResponse> => {
    const url = getModelsApiUrl()
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch models list: ${response.statusText}`)
    }
    return await response.json()
}

export const getDefaultModel = (modelsList: ModelsListResponse): LLMProfile | null => {
    for (const provider of modelsList.providers) {
        const profiles = modelsList.models[provider] || []
        const defaultProfile = profiles.find((p) => p.default)
        if (defaultProfile) {
            return defaultProfile
        }
    }
    const firstProvider = modelsList.providers[0]
    if (firstProvider && modelsList.models[firstProvider]?.length > 0) {
        return modelsList.models[firstProvider][0]
    }
    return null
}

export const generateSessionId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}
