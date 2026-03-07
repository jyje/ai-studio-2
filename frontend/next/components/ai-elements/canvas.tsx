"use client";

import React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  type ReactFlowProps,
  Background,
  Controls,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";

export type CanvasProps = ReactFlowProps & {
  children?: React.ReactNode;
};

export const Canvas = ({ children, className, ...props }: CanvasProps) => {
  // Extract props that are not valid React Flow props to avoid passing to DOM
  const { 
    disableDoubleClickZoom,
    defaultPosition,
    defaultZoom,
    ...reactFlowProps 
  } = props;
  
  return (
    <ReactFlowProvider>
      <ReactFlow
        className={cn("bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800", className)}
        panOnScroll={reactFlowProps.panOnScroll ?? true}
        nodesDraggable={reactFlowProps.nodesDraggable ?? false}
        nodesConnectable={reactFlowProps.nodesConnectable ?? false}
        elementsSelectable={reactFlowProps.elementsSelectable ?? false}
        deleteKeyCode={reactFlowProps.deleteKeyCode ?? null}
        panOnDrag={reactFlowProps.panOnDrag ?? true}
        nodes={reactFlowProps.nodes}
        edges={reactFlowProps.edges}
        onNodesChange={reactFlowProps.onNodesChange}
        onEdgesChange={reactFlowProps.onEdgesChange}
        nodeTypes={reactFlowProps.nodeTypes}
        edgeTypes={reactFlowProps.edgeTypes}
        onInit={reactFlowProps.onInit}
        onConnect={reactFlowProps.onConnect}
        onMove={reactFlowProps.onMove}
        onMoveStart={reactFlowProps.onMoveStart}
        onMoveEnd={reactFlowProps.onMoveEnd}
        onSelectionChange={reactFlowProps.onSelectionChange}
        onNodesDelete={reactFlowProps.onNodesDelete}
        onEdgesDelete={reactFlowProps.onEdgesDelete}
        onNodeClick={reactFlowProps.onNodeClick}
        onEdgeClick={reactFlowProps.onEdgeClick}
        onPaneClick={reactFlowProps.onPaneClick}
        onPaneScroll={reactFlowProps.onPaneScroll}
        onPaneContextMenu={reactFlowProps.onPaneContextMenu}
        fitView={reactFlowProps.fitView}
        fitViewOptions={reactFlowProps.fitViewOptions}
        defaultViewport={reactFlowProps.defaultViewport}
        minZoom={reactFlowProps.minZoom}
        maxZoom={reactFlowProps.maxZoom}
        translateExtent={reactFlowProps.translateExtent}
        nodeExtent={reactFlowProps.nodeExtent}
        preventScrolling={reactFlowProps.preventScrolling}
        attributionPosition={reactFlowProps.attributionPosition}
        proOptions={reactFlowProps.proOptions}
        autoPanOnConnect={reactFlowProps.autoPanOnConnect}
        autoPanOnNodeDrag={reactFlowProps.autoPanOnNodeDrag}
        connectionMode={reactFlowProps.connectionMode}
        connectionRadius={reactFlowProps.connectionRadius}
        snapToGrid={reactFlowProps.snapToGrid}
        snapGrid={reactFlowProps.snapGrid}
        selectNodesOnDrag={reactFlowProps.selectNodesOnDrag}
      >
        {children}
        <Background 
          gap={20} 
          size={1} 
          color="#e5e7eb" 
          className="opacity-40"
        />
        <Controls 
          className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
          showInteractive={false}
        />
      </ReactFlow>
    </ReactFlowProvider>
  );
};

export { Panel };

