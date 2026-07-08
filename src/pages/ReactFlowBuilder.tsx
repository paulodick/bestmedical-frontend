import React, { useState, useRef } from 'react';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent' | 'condition' | 'webhook' | 'whatsapp_send';
  label: string;
  x: number;
  y: number;
  props: {
    prompt?: string;
    variable?: string;
    messageText?: string;
    url?: string;
  };
}

interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
}

export const ReactFlowBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: 'n-1', type: 'trigger', label: 'Mensagem do Paciente', x: 80, y: 150, props: {} },
    { id: 'n-2', type: 'agent', label: 'Agente Triador Gemini', x: 340, y: 100, props: { prompt: 'Triar paciente.' } },
  ]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([
    { id: 'e-1', from: 'n-1', to: 'n-2' },
  ]);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('n-2');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setSelectedNodeId(id);
    setDraggingNodeId(id);
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragOffset({
        x: (e.clientX - rect.left) - node.x,
        y: (e.clientY - rect.top) - node.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = (e.clientX - rect.left) - dragOffset.x;
      const newY = (e.clientY - rect.top) - dragOffset.y;
      setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: Math.max(10, newX), y: Math.max(10, newY) } : n));
    }
  };

  const handleAddAgent = () => {
    const id = `n-${Date.now()}`;
    const newNode: WorkflowNode = { id, type: 'agent', label: 'Agente Gemini', x: 200, y: 200, props: { prompt: 'Responda.' } };
    setNodes(prev => [...prev, newNode]);
    
    const lastNode = nodes[nodes.length - 1];
    if (lastNode) {
      const newEdgeId = `e-${Date.now()}`;
      setEdges(prev => [...prev, { id: newEdgeId, from: lastNode.id, to: id }]);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0B0F19] text-slate-100 overflow-hidden font-sans">
      <div className="w-72 bg-[#121824] border-r border-[#1B2234] p-5 flex flex-col justify-between">
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Adicionar Elementos</h2>
          <div className="space-y-2">
            <button onClick={handleAddAgent} className="w-full text-left p-3 bg-[#1B2234] border border-[#1B2234] hover:border-teal-500/40 rounded-xl text-xs transition-colors">
              🤖 Novo Agente IA
            </button>
          </div>
        </div>

        {selectedNode && (
          <div className="border-t border-[#1B2234] pt-4">
            <h3 className="text-xs font-bold text-teal-400 uppercase">Propriedades</h3>
            <p className="text-[11px] text-slate-300 mt-1">ID: {selectedNode.id}</p>
            <p className="text-[11px] text-slate-300">Tipo: {selectedNode.type}</p>
            <p className="text-[11px] text-slate-400 mt-2 font-mono">Conexões Ativas: {edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length}</p>
          </div>
        )}
      </div>
      
      <div ref={canvasRef} onMouseMove={handleMouseMove} onMouseUp={() => setDraggingNodeId(null)} className="flex-grow relative bg-[radial-gradient(#1B2234_1px,transparent_1px)] [background-size:20px_20px]">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {edges.map((edge) => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            return (
              <line
                key={edge.id}
                x1={fromNode.x + 100}
                y1={fromNode.y + 30}
                x2={toNode.x + 100}
                y2={toNode.y + 30}
                stroke="#10E5CA"
                strokeWidth="2"
                strokeDasharray="4"
              />
            );
          })}
        </svg>

        {nodes.map(node => (
          <div key={node.id} onMouseDown={(e) => handleNodeMouseDown(e, node.id)} style={{ left: node.x, top: node.y }} className={`absolute w-52 p-4 bg-[#121824] border rounded-2xl shadow-xl cursor-grab ${selectedNodeId === node.id ? 'border-[#10E5CA]' : 'border-[#1B2234]'}`}>
            <div className="text-[10px] text-teal-400 font-bold uppercase">{node.type}</div>
            <div className="text-xs font-semibold mt-1">{node.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
