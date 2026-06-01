// Team Workspace — comments on a shared analysis (Phase 6.1)
import React, { useEffect, useState } from 'react';
import { WorkspaceComment } from '../../types';
import {
  getAnalysisComments, createWorkspaceComment, updateWorkspaceComment, deleteWorkspaceComment,
} from '../../services/persistenceService';

const AnalysisComments: React.FC<{
  workspaceId: string; analysisId: string; selfUid: string; selfName: string;
}> = ({ workspaceId, analysisId, selfUid, selfName }) => {
  const [comments, setComments] = useState<WorkspaceComment[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const load = () => getAnalysisComments(workspaceId, analysisId).then(setComments);
  useEffect(() => { load(); }, [workspaceId, analysisId]);

  const add = async (content: string, parentId: string | null) => {
    if (!content.trim()) return;
    await createWorkspaceComment({
      workspace_id: workspaceId, analysis_id: analysisId, parent_id: parentId,
      author_uid: selfUid, author_name: selfName, content: content.trim(),
    });
    setDraft(''); setReplyDraft(''); setReplyTo(null);
    await load();
  };

  const saveEdit = async (id: string) => {
    await updateWorkspaceComment(id, editDraft.trim());
    setEditId(null); setEditDraft(''); await load();
  };

  const del = async (id: string) => { await deleteWorkspaceComment(id); await load(); };

  const roots = comments.filter(c => !c.parent_id);
  const repliesOf = (id: string) => comments.filter(c => c.parent_id === id);

  const Row: React.FC<{ c: WorkspaceComment; isReply?: boolean }> = ({ c, isReply }) => (
    <div className={`${isReply ? 'ml-8' : ''} p-3 bg-white rounded-xl border border-gray-100`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {c.author_name || 'Member'} · {c.created_at ? new Date(c.created_at).toLocaleString() : ''}{c.updated_at ? ' (edited)' : ''}
        </p>
        {c.author_uid === selfUid && editId !== c.id && (
          <div className="flex gap-2">
            <button onClick={() => { setEditId(c.id); setEditDraft(c.content); }} className="text-[9px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest">Edit</button>
            <button onClick={() => del(c.id)} className="text-[9px] font-bold text-gray-400 hover:text-[#FF0000] uppercase tracking-widest">Delete</button>
          </div>
        )}
      </div>
      {editId === c.id ? (
        <div className="mt-2 flex gap-2">
          <input value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="flex-grow border border-gray-200 rounded-lg p-2 text-sm outline-none" />
          <button onClick={() => saveEdit(c.id)} className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Save</button>
          <button onClick={() => setEditId(null)} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cancel</button>
        </div>
      ) : (
        <p className="text-sm text-gray-700 mt-1">{c.content}</p>
      )}
      {!isReply && editId !== c.id && (
        <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyDraft(''); }} className="mt-2 text-[9px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest">Reply</button>
      )}
      {replyTo === c.id && (
        <div className="mt-2 flex gap-2">
          <input value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Write a reply…" className="flex-grow border border-gray-200 rounded-lg p-2 text-sm outline-none" />
          <button onClick={() => add(replyDraft, c.id)} className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest">Post</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Comments</p>
      <div className="space-y-2">
        {roots.length === 0 && <p className="text-xs text-gray-400 font-medium">No comments yet.</p>}
        {roots.map(c => (
          <div key={c.id} className="space-y-2">
            <Row c={c} />
            {repliesOf(c.id).map(r => <Row key={r.id} c={r} isReply />)}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment…" className="flex-grow border border-gray-200 rounded-lg p-2 text-sm outline-none" />
        <button onClick={() => add(draft, null)} className="px-4 text-[10px] font-bold text-white bg-[#0B0B0B] rounded-lg uppercase tracking-widest">Post</button>
      </div>
    </div>
  );
};

export default AnalysisComments;
