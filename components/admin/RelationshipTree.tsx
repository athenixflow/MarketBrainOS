// Simple indented relationship/hierarchy tree (Prompt 4 "Organization Relationship View").
// Enterprise → Brands/Departments → linked containers, rendered as a nested list.

import React from 'react';

export interface TreeNode { label: string; sublabel?: string; tone?: string; children?: TreeNode[]; }

const Node: React.FC<{ node: TreeNode; depth: number; last: boolean }> = ({ node, depth }) => (
  <div>
    <div className="flex items-center gap-3 py-1.5" style={{ paddingLeft: depth * 20 }}>
      {depth > 0 && <span className="text-gray-300 font-mono text-xs">└─</span>}
      <span className={`w-1.5 h-1.5 rounded-full ${depth === 0 ? 'bg-[#FF0000]' : 'bg-gray-300'}`} />
      <span className={`text-sm ${depth === 0 ? 'font-black text-[#0B0B0B]' : 'font-bold text-gray-600'}`}>{node.label}</span>
      {node.sublabel && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{node.sublabel}</span>}
    </div>
    {node.children?.map((c, i) => <Node key={i} node={c} depth={depth + 1} last={i === (node.children!.length - 1)} />)}
  </div>
);

const RelationshipTree: React.FC<{ root: TreeNode }> = ({ root }) => (
  <div className="font-sans">
    <Node node={root} depth={0} last />
  </div>
);

export default RelationshipTree;
