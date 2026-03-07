'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { fetchGraphStructure, GraphNode, GraphEdge, AgentType } from '@/app/config';
import { AgentGraphDisplayMode, useSettings } from '@/app/settings/context/SettingsContext';
import { Canvas } from '@/components/ai-elements/canvas';
import { Node, NodeHeader, NodeTitle, NodeContent } from '@/components/ai-elements/node';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node as ReactFlowNode,
  type Edge as ReactFlowEdge,
  type Connection,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import { cn } from '@/lib/utils';

interface AgentGraphPanelProps {
  currentNode: string | null;
  isLoading?: boolean;
  onClose?: () => void;
  agentType?: AgentType;
  displayMode?: AgentGraphDisplayMode;
}

interface PanelPosition {
  x: number;
  y: number;
}

interface PanelSize {
  width: number;
  height: number;
}

// Constants for panel sizing
const MIN_WIDTH = 300;
const MIN_HEIGHT = 180;
const MAX_HEIGHT = 500;
const DEFAULT_HEIGHT = 250;

// LocalStorage keys for panel state persistence
const PANEL_POSITION_KEY = 'agent-graph-panel-position';
const PANEL_SIZE_KEY = 'agent-graph-panel-size';

// Calculate positions for nodes in a horizontal layout
function calculateNodePositions(nodes: GraphNode[], edges: GraphEdge[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  
  // Find start and end nodes (check for __start__ and __end__ as well)
  const startNode = nodes.find(n => n.type === 'start' || n.id === '__start__');
  const endNode = nodes.find(n => n.type === 'end' || n.id === '__end__');
  const regularNodes = nodes.filter(n => n.type === 'node' && n.id !== '__start__' && n.id !== '__end__');
  
  // Build adjacency list to understand connections
  const adjacency = new Map<string, string[]>();
  nodes.forEach(n => {
    adjacency.set(n.id, []);
  });
  edges.forEach(e => {
    const sources = adjacency.get(e.source) || [];
    if (!sources.includes(e.target)) {
      sources.push(e.target);
      adjacency.set(e.source, sources);
    }
  });
  
  // Identify agent nodes and tool nodes for ReAct structure
  const agentNodes: GraphNode[] = [];
  const toolNodes: GraphNode[] = [];
  
  regularNodes.forEach(node => {
    const nodeIdLower = node.id.toLowerCase();
    // Tool nodes are typically named 'tools', 'tool', or connected to agent
    if (nodeIdLower.includes('tool') || nodeIdLower === 'tools') {
      toolNodes.push(node);
    } else {
      // Agent nodes: agent, main, query, etc.
      agentNodes.push(node);
    }
  });
  
  // Sort agent nodes by flow order
  agentNodes.sort((a, b) => {
    const aFromStart = edges.some(e => e.source === startNode?.id && e.target === a.id);
    const bFromStart = edges.some(e => e.source === startNode?.id && e.target === b.id);
    if (aFromStart && !bFromStart) return -1;
    if (!aFromStart && bFromStart) return 1;
    
    const aToB = edges.some(e => e.source === a.id && e.target === b.id);
    const bToA = edges.some(e => e.source === b.id && e.target === a.id);
    if (aToB && !bToA) return -1;
    if (bToA && !aToB) return 1;
    
    return 0;
  });
  
  // Layout settings - more spacious for ReAct structure
  const nodeSpacing = 240;
  const rowSpacing = 160; // More space for tool nodes below
  const startX = 120;
  const centerY = 120; // Same Y for start-agent-end alignment
  
  let x = startX;
  
  // Position start node - aligned with main flow
  if (startNode) {
    positions.set(startNode.id, { x, y: centerY });
    x += nodeSpacing;
  }
  
  // Position agent nodes in main flow - same Y as start/end
  const agentNodeX = new Map<string, number>();
  agentNodes.forEach((node) => {
    positions.set(node.id, { x, y: centerY }); // Same Y coordinate
    agentNodeX.set(node.id, x);
    x += nodeSpacing;
  });
  
  // Position tool nodes below their connected agent node
  toolNodes.forEach((node) => {
    // Find which agent this tool connects to
    const connectedAgent = agentNodes.find(agent => {
      return edges.some(e => 
        (e.source === agent.id && e.target === node.id) ||
        (e.source === node.id && e.target === agent.id)
      );
    });
    
    if (connectedAgent && agentNodeX.has(connectedAgent.id)) {
      const agentX = agentNodeX.get(connectedAgent.id)!;
      positions.set(node.id, { x: agentX, y: centerY + rowSpacing });
    } else if (agentNodes.length > 0) {
      // Default: position below first agent
      const firstAgentX = agentNodeX.get(agentNodes[0].id) || startX + nodeSpacing;
      positions.set(node.id, { x: firstAgentX, y: centerY + rowSpacing });
    } else {
      // Fallback: position at end
      positions.set(node.id, { x: startX + nodeSpacing, y: centerY + rowSpacing });
    }
  });
  
  // Position end node - aligned with main flow (same Y as start and agents)
  if (endNode) {
    positions.set(endNode.id, { x, y: centerY }); // Same Y coordinate
  }
  
  return positions;
}

// Custom node component for graph visualization
function GraphNodeComponent({ data, selected }: { data: any; selected?: boolean }) {
  const { t } = useTranslation();
  
  const getNodeLabel = (node: GraphNode): string => {
    if (node.type === 'start') return t('agentGraph.nodes.start');
    if (node.type === 'end') return t('agentGraph.nodes.end');
    
    const translationKey = `agentGraph.nodes.${node.id}`;
    const translated = t(translationKey);
    if (translated !== translationKey) return translated;
    
    return node.label || node.id;
  };
  
  const isStartOrEnd = data.nodeType === 'start' || data.nodeType === 'end' || data.node.id === '__start__' || data.node.id === '__end__';
  const isActive = data.isActive;
  const nodeLabel = getNodeLabel(data.node);
  const isStart = data.nodeType === 'start' || data.node.id === '__start__';
  const isEnd = data.nodeType === 'end' || data.node.id === '__end__';
  
  // Start/End nodes: simple text-only design
  if (isStartOrEnd) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center',
          'min-w-[80px] px-4 py-3 rounded-lg',
          'border-2 transition-all duration-300',
          'shadow-md',
          isStart
            ? isActive
              ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50 border-emerald-500 border-4 shadow-emerald-500/50 scale-110 ring-2 ring-emerald-400/50'
              : 'bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 border-emerald-300 dark:border-emerald-700'
            : isActive
              ? 'bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/50 dark:to-rose-900/50 border-rose-500 border-4 shadow-rose-500/50 scale-110 ring-2 ring-rose-400/50'
              : 'bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/30 dark:to-rose-800/30 border-rose-300 dark:border-rose-700'
        )}
      >
        {/* Start node: only right source */}
        {isStart && (
          <Handle
            type="source"
            position={Position.Right}
            className={cn(
              '!w-2.5 !h-2.5 !border-2 !rounded-full !opacity-0 pointer-events-auto',
              isActive 
                ? '!bg-emerald-500 !border-white' 
                : '!bg-emerald-400 !border-emerald-100 dark:!border-emerald-800'
            )}
            style={{ right: -6 }}
            id="right-source"
          />
        )}
        {/* End node: only left target */}
        {isEnd && (
          <Handle
            type="target"
            position={Position.Left}
            className={cn(
              '!w-2.5 !h-2.5 !border-2 !rounded-full !opacity-0 pointer-events-auto',
              isActive 
                ? '!bg-rose-500 !border-white' 
                : '!bg-rose-400 !border-rose-100 dark:!border-rose-800'
            )}
            style={{ left: -6 }}
            id="left-target"
          />
        )}
        <span className={cn(
          'text-sm font-semibold',
          isStart 
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-rose-700 dark:text-rose-300'
        )}>
          {nodeLabel}
        </span>
        {isActive && (
          <>
            {/* Glow effect */}
            <div className={cn(
              "absolute -inset-2 rounded-lg animate-pulse blur-md opacity-75",
              isStart ? 'bg-emerald-400/40' : 'bg-rose-400/40'
            )} />
            {/* Pulse ring */}
            <div className={cn(
              "absolute -inset-1 rounded-lg animate-ping opacity-20",
              isStart ? 'bg-emerald-400' : 'bg-rose-400'
            )} />
          </>
        )}
      </div>
    );
  }
  
  // Check if this is a tool node or agent node
  const nodeIdLower = data.node.id.toLowerCase();
  const isToolNode = nodeIdLower.includes('tool') || nodeIdLower === 'tools';
  const isAgentNode = nodeIdLower.includes('agent') || nodeIdLower === 'main' || nodeIdLower === 'query';
  
  // Regular nodes: rounded rectangle with gradient
  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center',
        'min-w-[100px] px-4 py-3 rounded-xl',
        'border-2 transition-all duration-300',
        'shadow-md backdrop-blur-sm',
        isToolNode
          ? isActive
            ? 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50 border-purple-500 border-4 shadow-purple-500/50 scale-110 ring-2 ring-purple-400/50'
            : 'bg-white/80 dark:bg-gray-800/80 border-purple-300 dark:border-purple-700 shadow-purple-200/30 dark:shadow-purple-900/30'
          : isActive
            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-500 border-4 shadow-blue-500/50 scale-110 ring-2 ring-blue-400/50'
            : 'bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 shadow-gray-200/50 dark:shadow-gray-900/50',
        'hover:shadow-lg hover:scale-105'
      )}
    >
      {/* Left handle for non-agent-tool connections */}
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          '!w-2.5 !h-2.5 !border-2 !rounded-full !opacity-0 pointer-events-auto',
          isToolNode
            ? isActive 
              ? '!bg-purple-500 !border-white' 
              : '!bg-purple-400 !border-purple-200 dark:!border-purple-700'
            : isActive 
              ? '!bg-blue-500 !border-white' 
              : '!bg-gray-400 !border-gray-200 dark:!border-gray-700'
        )}
        style={{ left: -6 }}
        id="left-target"
      />
      
      {/* Vertical handles for agent-tool ReAct pattern connections */}
      {isAgentNode && (
        <>
          {/* Agent bottom source: Agent -> Tool (calling tool) */}
          <Handle
            type="source"
            position={Position.Bottom}
            className={cn(
              '!w-2.5 !h-2.5 !border-2 !rounded-full !opacity-0 pointer-events-auto',
              isActive 
                ? '!bg-blue-500 !border-white' 
                : '!bg-blue-400 !border-blue-200 dark:!border-blue-700'
            )}
            style={{ bottom: -6 }}
            id="bottom-source"
          />
          {/* Agent bottom target: Tool -> Agent (tool result) */}
          <Handle
            type="target"
            position={Position.Bottom}
            className={cn(
              '!w-2.5 !h-2.5 !border-2 !rounded-full !opacity-0 pointer-events-auto',
              isActive 
                ? '!bg-blue-500 !border-white' 
                : '!bg-blue-400 !border-blue-200 dark:!border-blue-700'
            )}
            style={{ bottom: -10 }}
            id="bottom-target"
          />
        </>
      )}
      {isToolNode && (
        <>
          {/* Tool top target: Agent -> Tool (receiving call) */}
          <Handle
            type="target"
            position={Position.Top}
            className={cn(
              '!w-2.5 !h-2.5 !border-2 !rounded-full !opacity-0 pointer-events-auto',
              isActive 
                ? '!bg-purple-500 !border-white' 
                : '!bg-purple-400 !border-purple-200 dark:!border-purple-700'
            )}
            style={{ top: -6 }}
            id="top-target"
          />
          {/* Tool top source: Tool -> Agent (returning result) */}
          <Handle
            type="source"
            position={Position.Top}
            className={cn(
              '!w-2.5 !h-2.5 !border-2 !rounded-full !opacity-0 pointer-events-auto',
              isActive 
                ? '!bg-purple-500 !border-white' 
                : '!bg-purple-400 !border-purple-200 dark:!border-purple-700'
            )}
            style={{ top: -10 }}
            id="top-source"
          />
        </>
      )}
      
      <span
        className={cn(
          'text-sm font-semibold text-center',
          isToolNode
            ? isActive
              ? 'text-purple-700 dark:text-purple-300'
              : 'text-purple-600 dark:text-purple-400'
            : isActive
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300'
        )}
      >
        {nodeLabel}
      </span>
      
      {/* Right handle for non-agent-tool connections */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          '!w-2.5 !h-2.5 !border-2 !rounded-full !opacity-0 pointer-events-auto',
          isToolNode
            ? isActive 
              ? '!bg-purple-500 !border-white' 
              : '!bg-purple-400 !border-purple-200 dark:!border-purple-700'
            : isActive 
              ? '!bg-blue-500 !border-white' 
              : '!bg-gray-400 !border-gray-200 dark:!border-gray-700'
        )}
        style={{ right: -6 }}
        id="right-source"
      />
      
      {isActive && (
        <>
          {/* Glow effect */}
          <div className={cn(
            "absolute -inset-2 rounded-xl animate-pulse blur-md opacity-75",
            isToolNode ? 'bg-purple-400/40' : 'bg-blue-400/40'
          )} />
          {/* Pulse ring */}
          <div className={cn(
            "absolute -inset-1 rounded-xl animate-ping opacity-20",
            isToolNode ? 'bg-purple-400' : 'bg-blue-400'
          )} />
        </>
      )}
    </div>
  );
}

const nodeTypes = {
  graphNode: GraphNodeComponent,
};

export default function AgentGraphPanel({ currentNode, isLoading = false, onClose, agentType = 'langgraph', displayMode = 'floating' }: AgentGraphPanelProps) {
  const { t } = useTranslation();
  const { settings, setAgentGraphExpanded } = useSettings();
  
  const [isExpanded, setIsExpanded] = useState(settings.agentGraphExpanded);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Panel position and size state (only for floating mode)
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [size, setSize] = useState<PanelSize | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; posX: number; posY: number } | null>(null);
  
  const isEmbedded = displayMode === 'embedded';
  const isFloating = displayMode === 'floating';
  
  // Get default width
  const getDefaultWidth = useCallback(() => {
    if (typeof window === 'undefined') return 896;
    return Math.min(896, window.innerWidth - 32);
  }, []);
  
  // Initialize position and size from localStorage (only for floating mode)
  useEffect(() => {
    if (typeof window === 'undefined' || !isFloating) return;
    
    const savedPosition = localStorage.getItem(PANEL_POSITION_KEY);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 100;
        setPosition({
          x: Math.min(Math.max(0, parsed.x), maxX),
          y: Math.min(Math.max(0, parsed.y), maxY)
        });
      } catch {
        setPosition(null);
      }
    }
    
    const savedSize = localStorage.getItem(PANEL_SIZE_KEY);
    if (savedSize) {
      try {
        const parsed = JSON.parse(savedSize);
        setSize({
          width: Math.max(MIN_WIDTH, Math.min(parsed.width, window.innerWidth - 32)),
          height: Math.max(MIN_HEIGHT, Math.min(parsed.height, MAX_HEIGHT))
        });
      } catch {
        setSize({ width: getDefaultWidth(), height: DEFAULT_HEIGHT });
      }
    } else {
      setSize({ width: getDefaultWidth(), height: DEFAULT_HEIGHT });
    }
  }, [getDefaultWidth, isFloating]);
  
  // Save position and size to localStorage (only for floating mode)
  useEffect(() => {
    if (position && typeof window !== 'undefined' && isFloating) {
      localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify(position));
    }
  }, [position, isFloating]);
  
  useEffect(() => {
    if (size && typeof window !== 'undefined' && isFloating) {
      localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(size));
    }
  }, [size, isFloating]);
  
  // Handle drag start (only for floating mode)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!isFloating || (e.target as HTMLElement).closest('button')) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position?.x ?? rect.left,
        posY: position?.y ?? rect.top
      };
    }
  }, [position, isFloating]);
  
  // Handle resize start (only for floating mode)
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
    if (!isFloating) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: size?.width ?? rect.width,
        height: size?.height ?? rect.height,
        posX: position?.x ?? rect.left,
        posY: position?.y ?? rect.top
      };
    }
  }, [position, size, isFloating]);
  
  // Handle mouse move for dragging and resizing (only for floating mode)
  useEffect(() => {
    if ((!isDragging && !isResizing) || !isFloating) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        const newX = dragStartRef.current.posX + deltaX;
        const newY = dragStartRef.current.posY + deltaY;
        
        const maxX = window.innerWidth - (size?.width ?? 300);
        const maxY = window.innerHeight - 50;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
      
      if (isResizing && resizeStartRef.current) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        
        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        let newPosX = resizeStartRef.current.posX;
        
        if (isResizing.includes('e')) {
          newWidth = Math.max(MIN_WIDTH, resizeStartRef.current.width + deltaX);
        }
        if (isResizing.includes('w')) {
          const potentialWidth = resizeStartRef.current.width - deltaX;
          if (potentialWidth >= MIN_WIDTH) {
            newWidth = potentialWidth;
            newPosX = resizeStartRef.current.posX + deltaX;
          }
        }
        
        if (isResizing.includes('s')) {
          newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartRef.current.height + deltaY));
        }
        
        newWidth = Math.min(newWidth, window.innerWidth - 32);
        
        setSize({ width: newWidth, height: newHeight });
        if (isResizing.includes('w')) {
          setPosition(prev => prev ? { ...prev, x: newPosX } : { x: newPosX, y: 16 });
        }
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
      dragStartRef.current = null;
      resizeStartRef.current = null;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, size, isFloating]);
  
  // Reset position (only for floating mode)
  const resetPosition = useCallback(() => {
    if (!isFloating) return;
    setPosition(null);
    setSize({ width: getDefaultWidth(), height: DEFAULT_HEIGHT });
    localStorage.removeItem(PANEL_POSITION_KEY);
    localStorage.removeItem(PANEL_SIZE_KEY);
  }, [getDefaultWidth, isFloating]);
  
  // Fetch graph structure
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchGraphStructure(agentType)
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch graph structure:', err);
        setError('Failed to load graph');
        setLoading(false);
      });
  }, [agentType]);
  
  // Calculate node positions
  const nodePositions = useMemo(() => {
    if (!graphData) return new Map<string, { x: number; y: number }>();
    return calculateNodePositions(graphData.nodes, graphData.edges);
  }, [graphData]);
  
  // Convert to React Flow nodes and edges
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState([]);
  
  useEffect(() => {
    if (!graphData || !nodePositions.size) return;
    
    // Convert nodes
    const nodes: ReactFlowNode[] = graphData.nodes.map((node) => {
      const pos = nodePositions.get(node.id);
      if (!pos) return null;
      
      return {
        id: node.id,
        type: 'graphNode',
        position: pos,
        data: {
          node,
          nodeType: node.type,
          isActive: currentNode === node.id,
        },
      };
    }).filter(Boolean) as ReactFlowNode[];
    
    // Convert edges - use connection rules from backend
    const edges: ReactFlowEdge[] = graphData.edges.map((edge) => {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);
      
      if (!sourcePos || !targetPos) return null;
      
      const isActive = currentNode === edge.source || currentNode === edge.target;
      
      // Check if edge connects to/from tool node for styling
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);
      const sourceIdLower = sourceNode?.id.toLowerCase() || '';
      const targetIdLower = targetNode?.id.toLowerCase() || '';
      const isToolEdge = sourceIdLower.includes('tool') || sourceIdLower === 'tools' || 
                         targetIdLower.includes('tool') || targetIdLower === 'tools';
      
      // Use connection handles from backend (sourceHandle, targetHandle)
      return {
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: 'default', // Use default bezier curve for smooth, gentle curves
        animated: isActive,
        style: {
          stroke: isActive 
            ? (isToolEdge ? '#a78bfa' : '#60a5fa')
            : (isToolEdge ? '#c4b5fd' : '#d1d5db'),
          strokeWidth: isActive ? 3 : 2,
          opacity: isActive ? 1 : (isToolEdge ? 0.7 : 0.6),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: isActive ? 20 : 15,
          height: isActive ? 20 : 15,
          color: isActive 
            ? (isToolEdge ? '#a78bfa' : '#60a5fa')
            : (isToolEdge ? '#c4b5fd' : '#d1d5db'),
        },
      };
    }).filter(Boolean) as ReactFlowEdge[];
    
    setReactFlowNodes(nodes);
    setReactFlowEdges(edges);
  }, [graphData, nodePositions, currentNode, setReactFlowNodes, setReactFlowEdges]);
  
  const toggleExpanded = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    setAgentGraphExpanded(newExpanded);
  };
  
  // Sync isExpanded with settings when settings change (but not when we update it ourselves)
  useEffect(() => {
    setIsExpanded(settings.agentGraphExpanded);
  }, [settings.agentGraphExpanded]);
  
  // Panel styles - different for embedded vs floating
  const panelStyle: React.CSSProperties = isEmbedded
    ? {
        position: 'relative',
        width: '100%',
        height: isExpanded ? '300px' : '48px',
        cursor: 'default',
        userSelect: 'auto',
        transition: 'height 0.3s ease-in-out',
      }
    : {
        position: 'fixed',
        top: position?.y ?? 16,
        left: position?.x ?? '50%',
        transform: position ? 'none' : 'translateX(-50%)',
        width: size?.width ?? getDefaultWidth(),
        height: isExpanded ? (size?.height ?? DEFAULT_HEIGHT) : 48,
        zIndex: 10000,
        cursor: isDragging ? 'grabbing' : 'default',
        userSelect: isDragging || isResizing ? 'none' : 'auto',
      };
  
  return (
    <div 
      ref={panelRef}
      style={panelStyle}
      className={`border border-gray-200 dark:border-[#3e3e42] rounded-xl overflow-hidden ${
        isEmbedded 
          ? 'bg-white dark:bg-[#1e1e1e] shadow-sm' 
          : 'bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm shadow-lg'
      }`}
    >
      {/* Resize handles - only for floating mode */}
      {isFloating && (
        <>
          <div 
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />
          <div 
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />
          <div 
            className="absolute left-2 right-2 bottom-0 h-2 cursor-ns-resize hover:bg-blue-500/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div 
            className="absolute left-0 bottom-0 w-4 h-4 cursor-nesw-resize hover:bg-blue-500/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div 
            className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-500/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />
        </>
      )}
      
      {/* Header */}
      <div 
        className={`flex items-center justify-between px-4 py-2 bg-gray-50/90 dark:bg-[#252526]/90 ${
          isFloating ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        onMouseDown={isFloating ? handleDragStart : undefined}
      >
        <button
          onClick={toggleExpanded}
          className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-[#2d2d30] rounded-lg px-2 py-1 transition-colors cursor-pointer"
        >
          <svg
            className="w-4 h-4 text-gray-600 dark:text-[#858585]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className="text-sm font-medium text-gray-700 dark:text-[#cccccc]">
            {t('agentGraph.title')}
          </span>
          {isLoading && (
            <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          )}
          <svg
            className={cn(
              'w-4 h-4 text-gray-500 dark:text-[#858585] transition-transform duration-200',
              isExpanded && 'rotate-180'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div className="flex items-center gap-1">
          {isFloating && (
            <button
              onClick={resetPosition}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2d2d30] transition-colors cursor-pointer"
              title={t('agentGraph.resetPosition')}
            >
              <svg
                className="w-4 h-4 text-gray-500 dark:text-[#858585]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {onClose && isFloating && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2d2d30] transition-colors cursor-pointer"
              title={t('settings.close')}
            >
              <svg
                className="w-4 h-4 text-gray-500 dark:text-[#858585]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      {isExpanded && (
        <div className="h-[calc(100%-48px)]">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-[#858585]">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {t('agentGraph.loading')}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              {error}
            </div>
          ) : graphData ? (
            <Canvas
              nodes={reactFlowNodes}
              edges={reactFlowEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onInit={(instance) => {
                // Fit view after initialization
                setTimeout(() => {
                  instance.fitView({ padding: 0.2 });
                }, 100);
              }}
              nodeTypes={nodeTypes}
              className="h-full"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
