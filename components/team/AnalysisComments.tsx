// Team Workspace — comments on a shared analysis (Phase 6.1)
import React, { useEffect, useState } from 'react';
import { Input, PrimaryButton, ErrorMessage, Skeleton } from '../UI';
import { WorkspaceComment } from '../../types';
import {
  getAnalysisComments, createWorkspaceComment, updateWorkspaceComment, deleteWorkspaceComment,
} from '../../services/persistenceService';

const rowAction = 'text-[10px] font-bold text-gray-400 hover:text-[#0B0B0B] uppercase tracking-widest transition-colors';

const AnalysisComments: React.FC<{
  workspaceId: string; analysisId: string; selfUid: string; selfName: string;
}> = ({ workspaceId, analysisId, selfUid, selfName }) => {
  const [comments, setComments] = useState<WorkspaceComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const load = () =>
    getAnalysisComments(workspaceId, analysisId)
      .then((rows) => { setComments(rows); setError(null); })
      .catch(() => setError('We could not load the comments. Please try again.'))
      .finally(() => setLoading(false));
  useEffect(() => { setLoading(true); load(); }, [workspaceId, analysisId]);

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

  // A plain render function, not a nested component: a component defined inside render is a new type
  // on every render, which remounted the edit/reply inputs and dropped focus on each keystroke.
  const renderRow = (c: WorkspaceComment, isReply?: boolean) => (
    <div key={c.id} className={`${isReply ? 'ml-8' : ''} p-4 bg-white rounded-2xl border border-gray-100`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest tabular-nums">
          {c.author_name || 'Member'} · {c.created_at ? new Date(c.created_at).toLocaleString() : ''}{c.updated_at ? ' (edited)' : ''}
        </p>
        {c.author_uid === selfUid && editId !== c.id && (
          <div className="flex items-center gap-3">
            <button onClick={() => { setEditId(c.id); setEditDraft(c.content); }} className={rowAction}>Edit</button>
            <button onClick={() => del(c.id)} className={`${rowAction} hover:text-[#FF0000]`}>Delete</button>
          </div>
        )}
      </div>
      {editId === c.id ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Input compact ariaLabel="Edit comment" placeholder="Edit your comment" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="flex-grow min-w-[12rem]" />
          <button onClick={() => saveEdit(c.id)} className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Save</button>
          <button onClick={() => setEditId(null)} className={rowAction}>Cancel</button>
        </div>
      ) : (
        <p className="text-sm text-gray-700 mt-1">{c.content}</p>
      )}
      {!isReply && editId !== c.id && (
        <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyDraft(''); }} className={`mt-3 ${rowAction}`}>Reply</button>
      )}
      {replyTo === c.id && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Input compact ariaLabel="Write a reply" placeholder="Write a reply…" value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} className="flex-grow min-w-[12rem]" />
          <button onClick={() => add(replyDraft, c.id)} className="text-[10px] font-bold text-[#FF0000] uppercase tracking-widest">Post</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Comments</p>
      {error && <ErrorMessage message={error} className="mb-3" action={{ label: 'Retry', onClick: () => { setLoading(true); load(); } }} />}
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {roots.length === 0 && !error && <p className="text-xs text-gray-400 font-medium">No comments yet.</p>}
          {roots.map(c => (
            <div key={c.id} className="space-y-2">
              {renderRow(c)}
              {repliesOf(c.id).map(r => renderRow(r, true))}
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input compact ariaLabel="Add a comment" placeholder="Add a comment…" value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-grow min-w-[12rem]" />
        <PrimaryButton size="sm" onClick={() => add(draft, null)}>Post</PrimaryButton>
      </div>
    </div>
  );
};

export default AnalysisComments;
