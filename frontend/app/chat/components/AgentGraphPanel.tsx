'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from '@/app/i18n/hooks/useTranslation';
import { fetchGraphStructure, GraphNode, GraphEdge, AgentType } from '@/app/config';

interface AgentGraphPanelProps {
  currentNode: string | null;
  isLoading?: boolean;
  onClose?: () => void;
  agentType?: AgentType;
}

interface NodePosition {
  x: number;
  y: number;
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
function calculateNodePositions(nodes: GraphNode[], edges: GraphEdge[]): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  
  // Find start and end nodes
  const startNode = nodes.find(n => n.type === 'start');
  const endNode = nodes.find(n => n.type === 'end');
  const regularNodes = nodes.filter(n => n.type === 'node');
  
  // Build adjacency list and reverse adjacency
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  nodes.forEach(n => {
    adjacency.set(n.id, []);
    reverseAdjacency.set(n.id, []);
  });
  edges.forEach(e => {
    const sources = adjacency.get(e.source) || [];
    if (!sources.includes(e.target)) {
      sources.push(e.target);
      adjacency.set(e.source, sources);
    }
    const targets = reverseAdjacency.get(e.target) || [];
    if (!targets.includes(e.source)) {
      targets.push(e.source);
      reverseAdjacency.set(e.target, targets);
    }
  });
  
  // Find nodes that are in loops (have bidirectional edges with another node)
  const loopNodes = new Set<string>();
  regularNodes.forEach(node => {
    const targets = adjacency.get(node.id) || [];
    targets.forEach(target => {
      const reverseTargets = adjacency.get(target) || [];
      if (reverseTargets.includes(node.id)) {
        // Found a loop between node and target
        loopNodes.add(node.id);
        loopNodes.add(target);
      }
    });
  });
  
  // Find main flow nodes (not just loop nodes, but nodes on the main path)
  const mainFlowNodes: GraphNode[] = [];
  const secondaryNodes: GraphNode[] = [];
  
  // Determine main flow: nodes directly connected from start or that connect to end
  regularNodes.forEach(node => {
    const hasConnectionFromStart = edges.some(e => e.source === startNode?.id && e.target === node.id);
    const hasConnectionToEnd = edges.some(e => e.source === node.id && e.target === endNode?.id);
    const isMainAgent = node.id.toLowerCase().includes('agent') || node.id.toLowerCase().includes('main') || node.id === 'MAIN';
    const isQueryNode = node.id.toLowerCase().includes('query') || node.id === 'QUERY';
    
    if (hasConnectionFromStart || hasConnectionToEnd || isMainAgent || isQueryNode) {
      mainFlowNodes.push(node);
    } else {
      secondaryNodes.push(node);
    }
  });
  
  // If we didn't categorize properly, use simple ordering
  if (mainFlowNodes.length === 0) {
    mainFlowNodes.push(...regularNodes);
  }
  
  // Sort main flow nodes by their position in the flow
  mainFlowNodes.sort((a, b) => {
    const aFromStart = edges.some(e => e.source === startNode?.id && e.target === a.id);
    const bFromStart = edges.some(e => e.source === startNode?.id && e.target === b.id);
    if (aFromStart && !bFromStart) return -1;
    if (!aFromStart && bFromStart) return 1;
    
    // Check if a connects to b
    const aToB = edges.some(e => e.source === a.id && e.target === b.id);
    const bToA = edges.some(e => e.source === b.id && e.target === a.id);
    if (aToB && !bToA) return -1;
    if (bToA && !aToB) return 1;
    
    return 0;
  });
  
  // Layout settings
  const nodeSpacing = 140;
  const rowSpacing = 90;
  const startX = 60;
  const centerY = 50;
  
  let x = startX;
  
  // Position start node
  if (startNode) {
    positions.set(startNode.id, { x, y: centerY });
    x += nodeSpacing;
  }
  
  // Position main flow nodes
  const mainNodeX = new Map<string, number>();
  mainFlowNodes.forEach((node) => {
    positions.set(node.id, { x, y: centerY });
    mainNodeX.set(node.id, x);
    x += nodeSpacing;
  });
  
  // Position end node
  if (endNode) {
    positions.set(endNode.id, { x, y: centerY });
  }
  
  // Position secondary nodes (tool nodes, etc.) below their connected main node
  secondaryNodes.forEach((node, index) => {
    // Find which main node this secondary node connects to
    const connectedMainNode = mainFlowNodes.find(mainNode => {
      return edges.some(e => 
        (e.source === mainNode.id && e.target === node.id) ||
        (e.source === node.id && e.target === mainNode.id)
      );
    });
    
    if (connectedMainNode && mainNodeX.has(connectedMainNode.id)) {
      const mainX = mainNodeX.get(connectedMainNode.id)!;
      positions.set(node.id, { x: mainX, y: centerY + rowSpacing });
    } else {
      // Fallback: position at the end
      positions.set(node.id, { 
        x: startX + (mainFlowNodes.length + index) * nodeSpacing, 
        y: centerY + rowSpacing 
      });
    }
  });
  
  return positions;
}

// Generate SVG path for an edge
function generateEdgePath(
  source: NodePosition,
  target: NodePosition,
  sourceType: string,
  targetType: string,
  isLoop: boolean = false
): string {
  const nodeRadius = 32;
  const startEndRadius = 14;
  
  const sourceR = sourceType === 'start' || sourceType === 'end' ? startEndRadius : nodeRadius;
  const targetR = targetType === 'start' || targetType === 'end' ? startEndRadius : nodeRadius;
  
  // Calculate direction
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance === 0) return '';
  
  const normalX = dx / distance;
  const normalY = dy / distance;
  
  // Start and end points adjusted for node radius
  const startX = source.x + normalX * sourceR;
  const startY = source.y + normalY * sourceR;
  const endX = target.x - normalX * targetR;
  const endY = target.y - normalY * targetR;
  
  if (isLoop || (dx < 0 && Math.abs(dy) > 20)) {
    // Create a curved path for loops or backward edges
    const midY = Math.max(source.y, target.y) + 50;
    return `M ${startX} ${startY} Q ${source.x} ${midY} ${(source.x + target.x) / 2} ${midY} Q ${target.x} ${midY} ${endX} ${endY}`;
  }
  
  // Straight line for forward edges
  return `M ${startX} ${startY} L ${endX} ${endY}`;
}

export default function AgentGraphPanel({ currentNode, isLoading = false, onClose, agentType = 'langgraph' }: AgentGraphPanelProps) {
  const { t } = useTranslation();
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Panel position and size state
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [size, setSize] = useState<PanelSize | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null); // 'e', 'w', 's', 'se', 'sw', etc.
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; posX: number; posY: number } | null>(null);
  
  // Get default width based on chat container (max-w-4xl = 56rem = 896px)
  const getDefaultWidth = useCallback(() => {
    if (typeof window === 'undefined') return 896;
    // Use the lesser of 896px or viewport width - 32px padding
    return Math.min(896, window.innerWidth - 32);
  }, []);
  
  // Initialize position and size from localStorage or defaults
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load saved position
    const savedPosition = localStorage.getItem(PANEL_POSITION_KEY);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        // Validate position is within viewport
        const maxX = window.innerWidth - 100;
        const maxY = window.innerHeight - 100;
        setPosition({
          x: Math.min(Math.max(0, parsed.x), maxX),
          y: Math.min(Math.max(0, parsed.y), maxY)
        });
      } catch {
        // Use centered default
        setPosition(null);
      }
    }
    
    // Load saved size
    const savedSize = localStorage.getItem(PANEL_SIZE_KEY);
    if (savedSize) {
      try {
        const parsed = JSON.parse(savedSize);
        setSize({
          width: Math.max(MIN_WIDTH, Math.min(parsed.width, window.innerWidth - 32)),
          height: Math.max(MIN_HEIGHT, Math.min(parsed.height, MAX_HEIGHT))
        });
      } catch {
        // Use default size
        setSize({ width: getDefaultWidth(), height: DEFAULT_HEIGHT });
      }
    } else {
      setSize({ width: getDefaultWidth(), height: DEFAULT_HEIGHT });
    }
  }, [getDefaultWidth]);
  
  // Save position to localStorage
  useEffect(() => {
    if (position && typeof window !== 'undefined') {
      localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify(position));
    }
  }, [position]);
  
  // Save size to localStorage
  useEffect(() => {
    if (size && typeof window !== 'undefined') {
      localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(size));
    }
  }, [size]);
  
  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // Don't drag when clicking buttons
    
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
  }, [position]);
  
  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: string) => {
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
  }, [position, size]);
  
  // Handle mouse move for dragging and resizing
  useEffect(() => {
    if (!isDragging && !isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        const newX = dragStartRef.current.posX + deltaX;
        const newY = dragStartRef.current.posY + deltaY;
        
        // Constrain to viewport
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
        
        // Handle horizontal resize
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
        
        // Handle vertical resize
        if (isResizing.includes('s')) {
          newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartRef.current.height + deltaY));
        }
        
        // Constrain width to viewport
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
  }, [isDragging, isResizing, size]);
  
  // Reset position to center
  const resetPosition = useCallback(() => {
    setPosition(null);
    setSize({ width: getDefaultWidth(), height: DEFAULT_HEIGHT });
    localStorage.removeItem(PANEL_POSITION_KEY);
    localStorage.removeItem(PANEL_SIZE_KEY);
  }, [getDefaultWidth]);
  
  // Fetch graph structure when component mounts or agent type changes
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
  }, [agentType]); // Refetch when agent type changes
  
  // Calculate node positions
  const nodePositions = useMemo(() => {
    if (!graphData) return new Map<string, NodePosition>();
    return calculateNodePositions(graphData.nodes, graphData.edges);
  }, [graphData]);
  
  // Calculate SVG dimensions
  const svgDimensions = useMemo(() => {
    if (!nodePositions.size) return { width: 400, height: 120 };
    
    let maxX = 0;
    let maxY = 0;
    nodePositions.forEach((pos) => {
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    });
    
    return { width: maxX + 80, height: maxY + 60 };
  }, [nodePositions]);
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Calculate panel styles
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: position?.y ?? 16,
    left: position?.x ?? '50%',
    transform: position ? 'none' : 'translateX(-50%)',
    width: size?.width ?? getDefaultWidth(),
    zIndex: 10000, // High z-index to be above dev tools and other overlays
    cursor: isDragging ? 'grabbing' : 'default',
    userSelect: isDragging || isResizing ? 'none' : 'auto',
  };
  
  // Get display label for a node
  const getNodeLabel = (node: GraphNode): string => {
    if (node.type === 'start') return t('agentGraph.nodes.start');
    if (node.type === 'end') return t('agentGraph.nodes.end');
    
    // Use translation if available, otherwise use label or id
    const translationKey = `agentGraph.nodes.${node.id}`;
    const translated = t(translationKey);
    if (translated !== translationKey) return translated;
    
    return node.label || node.id;
  };
  
  // Check if a node is active
  const isNodeActive = (nodeId: string): boolean => {
    return currentNode === nodeId;
  };
  
  // Check if an edge is active (leads to or from active node)
  const isEdgeActive = (edge: GraphEdge): boolean => {
    return currentNode === edge.source || currentNode === edge.target;
  };
  
  return (
    <div 
      ref={panelRef}
      style={panelStyle}
      className="border border-gray-200 dark:border-[#3e3e42] rounded-xl overflow-visible bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm shadow-lg"
    >
      {/* Resize handles */}
      {/* Left edge */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 transition-colors"
        onMouseDown={(e) => handleResizeStart(e, 'w')}
      />
      {/* Right edge */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/20 transition-colors"
        onMouseDown={(e) => handleResizeStart(e, 'e')}
      />
      {/* Bottom edge */}
      <div 
        className="absolute left-2 right-2 bottom-0 h-2 cursor-ns-resize hover:bg-blue-500/20 transition-colors"
        onMouseDown={(e) => handleResizeStart(e, 's')}
      />
      {/* Bottom-left corner */}
      <div 
        className="absolute left-0 bottom-0 w-4 h-4 cursor-nesw-resize hover:bg-blue-500/20 transition-colors"
        onMouseDown={(e) => handleResizeStart(e, 'sw')}
      />
      {/* Bottom-right corner */}
      <div 
        className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-500/20 transition-colors"
        onMouseDown={(e) => handleResizeStart(e, 'se')}
      />
      
      {/* Header - draggable */}
      <div 
        className="flex items-center justify-between px-4 py-2 bg-gray-50/90 dark:bg-[#252526]/90 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
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
            className={`w-4 h-4 text-gray-500 dark:text-[#858585] transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <div className="flex items-center gap-1">
          {/* Reset position button */}
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
          {/* Close button */}
          {onClose && (
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
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'opacity-100' : 'max-h-0 opacity-0'
        }`}
        style={isExpanded ? { maxHeight: (size?.height ?? DEFAULT_HEIGHT) - 48 } : undefined}
      >
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-20 text-gray-500 dark:text-[#858585]">
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
            <div className="flex items-center justify-center h-20 text-red-500">
              {error}
            </div>
          ) : graphData ? (
            <div className="flex justify-center overflow-x-auto">
              <svg
                width={svgDimensions.width}
                height={svgDimensions.height}
                className="min-w-fit"
              >
                {/* Define arrow marker */}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill="currentColor"
                      className="text-gray-400 dark:text-[#6e6e6e]"
                    />
                  </marker>
                  <marker
                    id="arrowhead-active"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 3.5, 0 7"
                      fill="currentColor"
                      className="text-blue-500"
                    />
                  </marker>
                  {/* Glow filter for active nodes */}
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Edges */}
                {graphData.edges.map((edge, index) => {
                  const sourcePos = nodePositions.get(edge.source);
                  const targetPos = nodePositions.get(edge.target);
                  if (!sourcePos || !targetPos) return null;
                  
                  const sourceNode = graphData.nodes.find(n => n.id === edge.source);
                  const targetNode = graphData.nodes.find(n => n.id === edge.target);
                  
                  // Detect loop edges (target appears before source in typical flow)
                  const isLoop = targetPos.x < sourcePos.x;
                  
                  const path = generateEdgePath(
                    sourcePos,
                    targetPos,
                    sourceNode?.type || 'node',
                    targetNode?.type || 'node',
                    isLoop
                  );
                  
                  const active = isEdgeActive(edge);
                  
                  return (
                    <g key={`edge-${index}`}>
                      {/* Edge path */}
                      <path
                        d={path}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={active ? 2.5 : 1.5}
                        strokeDasharray={edge.conditional ? '5,5' : 'none'}
                        markerEnd={active ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                        className={`transition-all duration-300 ${
                          active
                            ? 'text-blue-500'
                            : 'text-gray-300 dark:text-[#4e4e4e]'
                        }`}
                      />
                      {/* Animated flow for active edges */}
                      {active && (
                        <circle r="3" fill="currentColor" className="text-blue-500">
                          <animateMotion
                            dur="1s"
                            repeatCount="indefinite"
                            path={path}
                          />
                        </circle>
                      )}
                    </g>
                  );
                })}
                
                {/* Nodes */}
                {graphData.nodes.map((node) => {
                  const pos = nodePositions.get(node.id);
                  if (!pos) return null;
                  
                  const active = isNodeActive(node.id);
                  const isStartOrEnd = node.type === 'start' || node.type === 'end';
                  const radius = isStartOrEnd ? 14 : 32;
                  
                  return (
                    <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
                      {/* Node circle */}
                      <circle
                        r={radius}
                        fill="currentColor"
                        filter={active ? 'url(#glow)' : undefined}
                        className={`transition-all duration-300 ${
                          active
                            ? 'text-blue-500'
                            : isStartOrEnd
                            ? 'text-gray-400 dark:text-[#6e6e6e]'
                            : 'text-white dark:text-[#2d2d30]'
                        }`}
                      />
                      {/* Node border */}
                      <circle
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={active ? 3 : 2}
                        className={`transition-all duration-300 ${
                          active
                            ? 'text-blue-600'
                            : 'text-gray-400 dark:text-[#5e5e5e]'
                        }`}
                      />
                      {/* Pulse animation for active node */}
                      {active && (
                        <circle
                          r={radius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="text-blue-400"
                        >
                          <animate
                            attributeName="r"
                            from={radius}
                            to={radius + 12}
                            dur="1s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            from="1"
                            to="0"
                            dur="1s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}
                      {/* Node label - inside the circle */}
                      {!isStartOrEnd && (
                        <text
                          y={0}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={`text-xs font-semibold fill-current transition-colors duration-300 pointer-events-none ${
                            active
                              ? 'text-white'
                              : 'text-gray-700 dark:text-[#cccccc]'
                          }`}
                        >
                          {getNodeLabel(node)}
                        </text>
                      )}
                      {/* Icon for start/end nodes */}
                      {node.type === 'start' && (
                        <polygon
                          points="-5,-6 7,0 -5,6"
                          fill="white"
                          transform="translate(1, 0)"
                        />
                      )}
                      {node.type === 'end' && (
                        <rect
                          x="-5"
                          y="-5"
                          width="10"
                          height="10"
                          fill="white"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

