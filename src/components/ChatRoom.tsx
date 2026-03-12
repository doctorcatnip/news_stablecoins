'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '@/lib/db';

const POLL_INTERVAL_MS = 3000;

function formatChatTime(dateStr: string): string {
  const d = new Date(dateStr + 'Z');
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getAvatarColor(username: string): string {
  const colors = [
    'bg-sky-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
    'bg-rose-500', 'bg-teal-500', 'bg-indigo-500', 'bg-orange-500',
  ];
  let hash = 0;
  for (const char of username) hash = hash * 31 + char.charCodeAt(0);
  return colors[Math.abs(hash) % colors.length];
}

export default function ChatRoom() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [username, setUsername] = useState('');
  const [usernameSet, setUsernameSet] = useState(false);
  const [inputUsername, setInputUsername] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lastId, setLastId] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Load saved username from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chat_username');
    if (saved) {
      setUsername(saved);
      setUsernameSet(true);
      setInputUsername(saved);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  // Initial message load
  useEffect(() => {
    if (!usernameSet) return;
    fetch('/api/chat/messages?limit=50')
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        if (data.messages?.length > 0) {
          setLastId(data.messages[data.messages.length - 1].id);
        }
      })
      .catch(console.error);
  }, [usernameSet]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Poll for new messages
  useEffect(() => {
    if (!usernameSet) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/messages?after=${lastId}&limit=50`);
        const data = await res.json();
        const newMsgs: ChatMessage[] = data.messages ?? [];
        if (newMsgs.length > 0) {
          setMessages((prev) => [...prev, ...newMsgs]);
          setLastId(newMsgs[newMsgs.length - 1].id);
        }
      } catch {
        // Silently ignore poll errors
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [usernameSet, lastId]);

  const handleScrollMessages = () => {
    const el = messagesRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(atBottom);
  };

  const handleSetUsername = (e: React.FormEvent) => {
    e.preventDefault();
    const name = inputUsername.trim();
    if (!name) return;
    setUsername(name);
    setUsernameSet(true);
    localStorage.setItem('chat_username', name);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = inputMessage.trim();
    if (!msg || sending) return;

    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, message: msg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to send message');
        return;
      }
      setMessages((prev) => [...prev, data.message]);
      setLastId(data.message.id);
      setInputMessage('');
      setAutoScroll(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Username picker screen
  if (!usernameSet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-[#1c2128] border border-[#30363d] rounded-2xl p-8 w-full max-w-md">
          <div className="text-4xl mb-4 text-center">💬</div>
          <h2 className="text-xl font-bold text-center text-[#e6edf3] mb-2">
            Join the Community
          </h2>
          <p className="text-sm text-center text-[#8b949e] mb-6">
            Discuss stablecoins, payments, and crypto gateways with the community.
          </p>
          <form onSubmit={handleSetUsername} className="flex flex-col gap-3">
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Choose a username…"
              maxLength={24}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5
                         text-[#e6edf3] placeholder-[#6e7681] focus:outline-none
                         focus:border-sky-500 transition-colors"
              autoFocus
            />
            <p className="text-xs text-[#6e7681]">
              Letters, numbers, _, -, . allowed. Max 24 characters.
            </p>
            <button
              type="submit"
              disabled={!inputUsername.trim()}
              className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/40
                         text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              Enter Chat
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Community Chat</h1>
          <p className="text-sm text-[#8b949e] mt-0.5">
            Discuss stablecoins, payments &amp; crypto gateways
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full ${getAvatarColor(username)} flex items-center justify-center text-xs font-bold text-white`}>
            {username[0]?.toUpperCase()}
          </div>
          <span className="text-sm text-[#8b949e]">{username}</span>
          <button
            onClick={() => {
              setUsernameSet(false);
              localStorage.removeItem('chat_username');
            }}
            className="text-xs text-[#6e7681] hover:text-[#8b949e] ml-1"
            title="Change username"
          >
            ✎
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesRef}
        onScroll={handleScrollMessages}
        className="flex-1 overflow-y-auto bg-[#0d1117] border border-[#30363d] rounded-xl p-4 space-y-3"
      >
        {messages.length === 0 && (
          <div className="text-center text-[#8b949e] py-12">
            <div className="text-4xl mb-3">👋</div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwnMessage = msg.username === username;
          return (
            <div
              key={msg.id}
              className={`message-enter flex gap-2.5 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`shrink-0 w-8 h-8 rounded-full ${getAvatarColor(msg.username)} flex items-center justify-center text-xs font-bold text-white`}
              >
                {msg.username[0]?.toUpperCase()}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col gap-0.5 max-w-[75%] ${isOwnMessage ? 'items-end' : ''}`}>
                <div className={`flex items-baseline gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-semibold text-[#e6edf3]">{msg.username}</span>
                  <span className="text-xs text-[#6e7681]">{formatChatTime(msg.created_at)}</span>
                </div>
                <div
                  className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                    isOwnMessage
                      ? 'bg-sky-500 text-white rounded-tr-sm'
                      : 'bg-[#1c2128] text-[#e6edf3] border border-[#30363d] rounded-tl-sm'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-24 right-8 bg-sky-500 text-white rounded-full p-2 shadow-lg hover:bg-sky-400 transition-colors text-sm"
        >
          ↓
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 mt-1 px-1">{error}</p>
      )}

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="flex gap-2 mt-3">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message… (max 500 chars)"
          maxLength={500}
          disabled={sending}
          className="flex-1 bg-[#1c2128] border border-[#30363d] rounded-xl px-4 py-2.5
                     text-[#e6edf3] placeholder-[#6e7681] focus:outline-none
                     focus:border-sky-500 transition-colors text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || sending}
          className="bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/40 text-white
                     px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
