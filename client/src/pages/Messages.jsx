import { Archive, ArchiveRestore, Send, Trash2, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { GuestAccessCard } from "../components/GuestAccessCard.jsx";
import { ProductMedia } from "../components/ProductMedia.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useMessages } from "../context/MessageContext.jsx";

export function Messages() {
  const { isAuthenticated, user } = useAuth();
  const { refreshUnreadCount, socket } = useMessages();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("conversationId") || "");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const messageEndRef = useRef(null);

  async function loadConversations() {
    const { data } = await api.get("/messages");
    setConversations(data.conversations || []);
    const firstActive = data.conversations?.find((conversation) => !conversation.archived);
    if (!selectedId && firstActive) {
      setSelectedId(firstActive.id);
    }
  }

  async function loadConversation(id) {
    if (!id) return;
    const { data } = await api.get(`/messages/${id}`);
    setSelected(data.conversation);
    setMessages(data.messages || []);
    await markConversationRead(id);
  }

  async function markConversationRead(id) {
    if (!id) return;
    await api.patch(`/messages/conversations/${id}/read`);
    setConversations((current) => current.map((conversation) => (
      conversation.id === id ? { ...conversation, unreadCount: 0 } : conversation
    )));
    await refreshUnreadCount();
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadConversations()
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    const paramId = searchParams.get("conversationId") || "";
    if (paramId && paramId !== selectedId) setSelectedId(paramId);
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthenticated || !selectedId) return;
    setSearchParams({ conversationId: selectedId });
    loadConversation(selectedId).catch((err) => setError(getErrorMessage(err)));
  }, [isAuthenticated, selectedId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, selectedId]);

  useEffect(() => {
    if (!socket) return undefined;

    function handleConversationUpdated() {
      loadConversations().catch(() => {});
    }

    function handleMessagesRead({ conversationId }) {
      setConversations((current) => current.map((conversation) => (
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      )));
    }

    function handleNewMessage({ conversationId, message }) {
      loadConversations().catch(() => {});
      if (conversationId !== selectedId) return;

      setMessages((current) => (
        current.some((item) => item.id === message.id) ? current : [...current, message]
      ));
      markConversationRead(conversationId).catch(() => {});
    }

    function handleConversationDeleted({ conversationId }) {
      setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      if (conversationId === selectedId) {
        setSelected(null);
        setMessages([]);
        setSelectedId("");
        setSearchParams({});
      }
    }

    socket.on("conversation:updated", handleConversationUpdated);
    socket.on("messages:read", handleMessagesRead);
    socket.on("message:new", handleNewMessage);
    socket.on("conversation:deleted", handleConversationDeleted);

    return () => {
      socket.off("conversation:updated", handleConversationUpdated);
      socket.off("messages:read", handleMessagesRead);
      socket.off("message:new", handleNewMessage);
      socket.off("conversation:deleted", handleConversationDeleted);
    };
  }, [socket, selectedId]);

  async function sendReply(event) {
    event.preventDefault();
    if (!reply.trim() || !selectedId) return;
    setError("");
    try {
      await api.post(`/messages/${selectedId}/reply`, { body: reply });
      setReply("");
      await Promise.all([loadConversations(), loadConversation(selectedId)]);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function toggleArchive() {
    if (!selectedId || !selected) return;
    const archived = !selected.archived;
    setError("");
    try {
      const { data } = await api.patch(`/messages/conversations/${selectedId}/archive`, { archived });
      setConversations((current) => current.map((conversation) => (
        conversation.id === selectedId ? { ...conversation, archived: data.archived, archivedAt: data.archivedAt } : conversation
      )));
      setSelected(null);
      setMessages([]);
      setSelectedId("");
      setSearchParams({});
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function deleteConversation() {
    if (!selectedId) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/messages/conversations/${selectedId}`);
      setConversations((current) => current.filter((conversation) => conversation.id !== selectedId));
      setSelected(null);
      setMessages([]);
      setSelectedId("");
      setSearchParams({});
      setDeleteConfirmOpen(false);
      await refreshUnreadCount();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  if (!isAuthenticated) {
    return <GuestAccessCard title="Messages" message="Login to view and send messages." />;
  }

  const filteredConversations = conversations.filter((conversation) => {
    if (filter === "unread") return conversation.unreadCount > 0;
    if (filter === "archived") return conversation.archived;
    return !conversation.archived;
  });
  const filterCounts = {
    active: conversations.filter((conversation) => !conversation.archived).length,
    unread: conversations.filter((conversation) => conversation.unreadCount > 0).length,
    archived: conversations.filter((conversation) => conversation.archived).length
  };

  return (
    <section className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-clay">Messages</p>
        <h1 className="text-3xl font-black">Conversations</h1>
      </div>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p>}
      <div className="flex flex-wrap gap-2" aria-label="Conversation filters">
        {["active", "unread", "archived"].map((item) => <button className={filter === item ? "btn-primary h-9 px-4" : "btn-secondary h-9 px-4"} onClick={() => setFilter(item)} type="button" key={item}>{item.charAt(0).toUpperCase() + item.slice(1)} <span className="ml-1 text-xs opacity-70">{filterCounts[item]}</span></button>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="panel max-h-[calc(100vh-190px)] overflow-auto p-0">
          {loading ? (
            <p className="p-5 text-sm text-neutral-500">Loading conversations...</p>
          ) : filteredConversations.length ? (
            filteredConversations.map((conversation) => {
              const other = conversation.otherParticipant || {};
              return (
              <button
                className={`block w-full border-b border-neutral-200 p-3 text-left last:border-0 dark:border-neutral-800 ${selectedId === conversation.id ? "bg-clay/10" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"}`}
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{conversation.subject}</p>
                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <UserAvatar user={other} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{other.name}</p>
                        <p className="truncate text-xs text-neutral-500">{user.role === "admin" ? other.email : "Admin support"}</p>
                      </div>
                    </div>
                  </div>
                  {conversation.unreadCount > 0 && <span className="rounded-full bg-clay px-2 py-0.5 text-xs font-bold text-white">{conversation.unreadCount}</span>}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-500">{conversation.lastMessage || "No messages yet."}</p>
              </button>
            );})
          ) : (
            <p className="p-5 text-sm text-neutral-500">{filter === "unread" ? "No unread conversations." : filter === "archived" ? "No archived conversations." : "No active conversations yet."}</p>
          )}
        </aside>

        <div className="panel flex h-[calc(100vh-210px)] min-h-[430px] flex-col p-0">
          {selected ? (
            <>
              <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Conversation</p><h2 className="mt-1 text-xl font-black">{selected.subject}</h2></div><div className="flex gap-2"><button className="btn-secondary h-9 px-3" onClick={toggleArchive} type="button">{selected.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />} {selected.archived ? "Restore" : "Archive"}</button><button className="btn-secondary h-9 px-3 text-red-600" onClick={() => setDeleteConfirmOpen(true)} type="button"><Trash2 size={15} /> Delete</button></div></div>
                <div className="mt-3 flex items-center gap-3">
                  <UserAvatar user={selected.otherParticipant} size="md" />
                  <div className="min-w-0">
                    <p className="font-semibold">{selected.otherParticipant?.name}</p>
                    <p className="truncate text-sm text-neutral-500">
                      {user.role === "admin" ? selected.otherParticipant?.email : "Admin support"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((message) => {
                  const mine = message.senderId === user.id || (user.role === "admin" && ["admin", "system-admin"].includes(message.senderRole));
                  const system = message.senderRole === "system-admin";
                  return (
                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                      <div className={`max-w-[78%] rounded-lg p-3 ${mine ? "bg-ink text-white dark:bg-white dark:text-ink" : system ? "bg-clay/10" : "bg-neutral-100 dark:bg-neutral-800"}`}>
                        <p className="text-xs font-bold uppercase tracking-wide opacity-70">{message.senderName}</p>
                        {message.imageUrl && <ProductMedia className="mt-3 h-auto max-h-72 w-auto max-w-full rounded-md bg-white/90 object-contain" media={{ url: message.imageUrl, type: message.mediaType }} alt="Message attachment" controls />}
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                        <p className="mt-2 text-xs opacity-60">{new Date(message.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>
              <form className="flex gap-3 border-t border-neutral-200 p-3 dark:border-neutral-800" onSubmit={sendReply}>
                <input className="flex-1" placeholder="Write a reply..." value={reply} onChange={(event) => setReply(event.target.value)} />
                <button className="btn-primary" type="submit"><Send size={16} /> Send</button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-neutral-500">
              Select a conversation to read messages.
            </div>
          )}
        </div>
      </div>
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={() => setDeleteConfirmOpen(false)} role="presentation">
          <div className="panel w-full max-w-md p-5" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-conversation-title">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black" id="delete-conversation-title">Delete this chat?</h2><p className="mt-2 text-sm leading-6 text-neutral-500">It will disappear only for you. The other participant keeps their copy, and any future message will start the chat again without restoring deleted history.</p></div><button className="btn-secondary h-9 w-9 shrink-0 px-0" onClick={() => setDeleteConfirmOpen(false)} type="button" aria-label="Close"><X size={16} /></button></div>
            <div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setDeleteConfirmOpen(false)} type="button">Keep chat</button><button className="btn-primary bg-red-600 hover:bg-red-700" disabled={deleting} onClick={deleteConversation} type="button"><Trash2 size={16} /> {deleting ? "Deleting..." : "Delete for me"}</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
