import React, { useState, useEffect, useRef } from 'react';
import usePollingSWR from '../../hooks/usePollingSWR';
import { POLL } from '../../lib/pollingConfig';
import { registerNativeBackHandler } from '../../lib/nativeBack';
import { ImageLightbox } from '../Modals';
import { formatDeviceTime } from '../../lib/formatDateTime';

export default function SupportTab({ adminUser }) {
  const [chatSearch, setChatSearch] = useState('');
  const [activeChatEmail, setActiveChatEmail] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [adminAttachment, setAdminAttachment] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState('');
  const [playerHits, setPlayerHits] = useState([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [openedPlayers, setOpenedPlayers] = useState({}); // email -> { email, name }
  const chatEndRef = useRef(null);

  const distQueryParam = adminUser?.distributorId ? `&adminDistributorId=${adminUser.distributorId}` : '';

  // Android back: close lightbox first, then open chat
  useEffect(() => {
    return registerNativeBackHandler(() => {
      if (lightboxSrc) {
        setLightboxSrc('');
        return true;
      }
      if (!activeChatEmail) return false;
      setActiveChatEmail(null);
      return true;
    });
  }, [activeChatEmail, lightboxSrc]);

  const { data: convData, mutate: mutateConversations, error: convError } = usePollingSWR(
    `/api/support?limit=200${distQueryParam}`,
    POLL.SUPPORT
  );

  // keepPreviousData:false — switching chats must NOT keep showing the previous customer's messages
  // limit=100 newest messages so long threads still show the latest replies
  const {
    data: activeChatData,
    mutate: mutateActiveChat,
    isLoading: chatLoading,
    isValidating: chatValidating
  } = usePollingSWR(
    activeChatEmail
      ? `/api/support?email=${encodeURIComponent(activeChatEmail)}&limit=100${distQueryParam}`
      : null,
    POLL.CHAT,
    { keepPreviousData: false }
  );

  // Search registered players by Gmail/name so staff can message before player texts first
  useEffect(() => {
    const q = chatSearch.trim();
    if (q.length < 2) {
      setPlayerHits([]);
      setPlayerSearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setPlayerSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const distParam = adminUser?.distributorId
          ? `&adminDistributorId=${encodeURIComponent(adminUser.distributorId)}`
          : '';
        const res = await fetch(
          `/api/users?search=${encodeURIComponent(q)}&limit=8&page=1${distParam}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!data.success) {
          setPlayerHits([]);
          return;
        }
        const hits = (data.users || [])
          .filter((u) => {
            const role = String(u.role || 'user').toLowerCase();
            return !role || role === 'user';
          })
          .map((u) => ({
            email: String(u.email || '').toLowerCase().trim(),
            name: (u.name || '').trim() || String(u.email || '').split('@')[0]
          }))
          .filter((u) => u.email);
        setPlayerHits(hits);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error('Support player search failed:', err);
          setPlayerHits([]);
        }
      } finally {
        setPlayerSearchLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [chatSearch, adminUser?.distributorId]);

  const allMessages = convData?.messages || [];
  // Only show messages for the currently selected email (guards against any stale cache)
  const activeChatMessages = (() => {
    const msgs = activeChatData?.messages || [];
    if (!activeChatEmail || !msgs.length) return msgs;
    const emailKey = activeChatEmail.toLowerCase();
    const mismatched = msgs.some(
      (m) => m.userEmail && String(m.userEmail).toLowerCase() !== emailKey
    );
    return mismatched ? [] : msgs;
  })();
  const showChatLoading = Boolean(activeChatEmail) && (chatLoading || (chatValidating && !activeChatData));

  const resolveDisplayName = (email, preferredName) => {
    const emailKey = String(email || '').toLowerCase().trim();
    if (!emailKey) return 'Guest';
    if (emailKey.includes('@jackpotguest.com') || emailKey.startsWith('guest_')) {
      return 'Guest';
    }
    const raw = String(preferredName || '').trim();
    if (raw && !/^support\s*agent$/i.test(raw) && !/^player$/i.test(raw)) {
      if (/^guest(\s*#?\d+)?$/i.test(raw)) return 'Guest';
      return raw;
    }
    return emailKey.split('@')[0] || 'Guest';
  };

  // Prefer server-built conversation list (includes unread threads that raw
  // message windows used to drop). Fall back to grouping messages.
  let conversations = [];
  if (Array.isArray(convData?.conversations)) {
    conversations = convData.conversations.map((c) => ({
      email: String(c.email || c.userEmail || '').toLowerCase().trim(),
      name: resolveDisplayName(c.email || c.userEmail, c.name || c.playerName),
      lastMessage: c.lastMessage || '',
      timestamp: c.timestamp,
      unread: !!c.unread
    })).filter((c) => c.email);
  } else {
    const groups = {};
    allMessages.forEach((msg) => {
      const email = (msg.userEmail || '').toLowerCase();
      if (!email) return;

      if (!groups[email]) {
        groups[email] = {
          email: msg.userEmail,
          name: null,
          lastMessage: msg.message || (msg.attachment ? '[Image]' : ''),
          timestamp: msg.timestamp,
          unread: false
        };
      }

      const g = groups[email];
      const candidate =
        msg.playerName ||
        (msg.senderType === 'player' ? msg.userName : '') ||
        '';
      if (candidate && !/^support\s*agent$/i.test(String(candidate))) {
        g.name = candidate;
      }
      if (msg.senderType === 'player' && msg.read === false) {
        g.unread = true;
      }
    });

    conversations = Object.values(groups).map((c) => ({
      ...c,
      email: String(c.email || '').toLowerCase().trim(),
      name: resolveDisplayName(c.email, c.name)
    }));
  }

  // Keep manually opened registered players in the list even before first message
  Object.values(openedPlayers).forEach((p) => {
    const email = (p.email || '').toLowerCase();
    if (!email || conversations.some((c) => c.email === email)) return;
    conversations.push({
      email,
      name: resolveDisplayName(email, p.name),
      lastMessage: 'No messages yet — start the chat',
      timestamp: p.openedAt || new Date().toISOString(),
      unread: false,
      isNewThread: true
    });
  });

  conversations = conversations.sort((a, b) => {
    if (a.unread && !b.unread) return -1;
    if (!a.unread && b.unread) return 1;
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });

  const filteredConversations = conversations.filter(
    (c) =>
      !chatSearch.trim() ||
      c.email.toLowerCase().includes(chatSearch.toLowerCase()) ||
      (c.name && c.name.toLowerCase().includes(chatSearch.toLowerCase()))
  );

  const activeChatDisplayName = activeChatEmail
    ? resolveDisplayName(
        activeChatEmail,
        activeChatData?.playerName ||
          openedPlayers[activeChatEmail.toLowerCase()]?.name ||
          conversations.find((c) => c.email.toLowerCase() === activeChatEmail.toLowerCase())?.name ||
          activeChatMessages.find((m) => m.playerName)?.playerName ||
          activeChatMessages.find((m) => m.senderType === 'player' && m.userName)?.userName
      )
    : '';

  const openPlayerChat = (player) => {
    const email = String(player.email || '').toLowerCase().trim();
    if (!email) return;
    setOpenedPlayers((prev) => ({
      ...prev,
      [email]: {
        email,
        name: resolveDisplayName(email, player.name),
        openedAt: new Date().toISOString()
      }
    }));
    setActiveChatEmail(email);
    setChatSearch('');
    setPlayerHits([]);
    setAdminReplyText('');
    setAdminAttachment('');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatMessages]);

  useEffect(() => {
    if (!activeChatEmail) return;

    const markAsRead = async () => {
      try {
        await fetch('/api/support', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: activeChatEmail, role: 'admin' })
        });
        mutateConversations();
      } catch (err) {
        console.error('Failed to mark support messages as read:', err);
      }
    };

    markAsRead();
  }, [activeChatEmail, activeChatMessages.length, mutateConversations]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('Image file size must be less than 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAdminAttachment(reader.result);
    };
    reader.onerror = () => {
      alert('Failed to read image file.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendAdminReply = async (e) => {
    e.preventDefault();
    if ((!adminReplyText.trim() && !adminAttachment) || !activeChatEmail || !adminUser) return;

    const replyMsg = adminReplyText.trim();
    setAdminReplyText('');
    const replyAttachment = adminAttachment;
    setAdminAttachment('');

    const tempId = 'temp-' + Date.now();
    const tempMessage = {
      id: tempId,
      userEmail: activeChatEmail,
      userName: activeChatDisplayName || 'Player',
      message: replyMsg,
      attachment: replyAttachment,
      senderType: 'admin',
      senderEmail: adminUser.email,
      timestamp: new Date().toISOString()
    };

    mutateActiveChat(
      { success: true, messages: [...activeChatMessages, tempMessage], playerName: activeChatDisplayName },
      false
    );

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: activeChatEmail,
          userName: activeChatDisplayName || 'Player',
          message: replyMsg,
          attachment: replyAttachment,
          senderType: 'admin',
          senderEmail: adminUser.email
        })
      });
      const data = await response.json();
      if (data.success) {
        const saved = data.message || {};
        const confirmed = {
          ...saved,
          playerName: activeChatDisplayName,
          // Keep inline preview if we just uploaded; otherwise use lazy URL
          attachment: replyAttachment
            || (saved.hasAttachment && saved.id
              ? `/api/support?attachmentId=${encodeURIComponent(saved.id)}`
              : '')
        };
        // Replace temp bubble with saved message — don't wait on a full refetch that
        // can briefly wipe the thread (and used to drop newest msgs past the old limit).
        mutateActiveChat(
          (current) => {
            const prev = current?.messages || activeChatMessages;
            const withoutTemp = prev.filter((m) => m.id !== tempId);
            const already = withoutTemp.some((m) => m.id === confirmed.id);
            return {
              success: true,
              playerName: activeChatDisplayName,
              messages: already ? withoutTemp : [...withoutTemp, confirmed]
            };
          },
          { revalidate: true }
        );
        mutateConversations();
      } else {
        // Roll back optimistic bubble on failure
        mutateActiveChat(
          (current) => ({
            success: true,
            playerName: activeChatDisplayName,
            messages: (current?.messages || []).filter((m) => m.id !== tempId)
          }),
          false
        );
        alert(data.message || 'Failed to send reply.');
      }
    } catch (err) {
      console.error('Send admin reply error:', err);
      mutateActiveChat(
        (current) => ({
          success: true,
          playerName: activeChatDisplayName,
          messages: (current?.messages || []).filter((m) => m.id !== tempId)
        }),
        false
      );
    }
  };

  return (
    <div className={`support-chat-layout admin-layout-split${activeChatEmail ? ' support-chat-layout--active' : ''}`}>
      <div className="admin-section-card support-chat-sidebar">
        <div style={{ marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
            <i className="fa-solid fa-comments"></i> Active Conversations
          </h4>
          <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', padding: '0.35rem 0.75rem' }}>
            <input
              type="text"
              placeholder="Search chats or player Gmail..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              style={{ fontSize: '0.75rem' }}
            />
          </div>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: 1.35 }}>
            Search a registered player&apos;s Gmail to message them even if they never opened support.
          </p>

          {(playerSearchLoading || playerHits.length > 0 || chatSearch.trim().length >= 2) && chatSearch.trim().length >= 2 && (
            <div
              style={{
                marginTop: '0.5rem',
                background: '#070912',
                border: '1px solid rgba(255,215,0,0.18)',
                borderRadius: '10px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '0.4rem 0.65rem',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--gold-primary)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                Registered players
              </div>
              {playerSearchLoading && playerHits.length === 0 ? (
                <p style={{ fontSize: '0.7rem', opacity: 0.55, padding: '0.65rem', margin: 0 }}>Searching...</p>
              ) : playerHits.length > 0 ? (
                playerHits.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => openPlayerChat(p)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      padding: '0.65rem 0.75rem',
                      cursor: 'pointer',
                      color: '#fff'
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.75rem' }}>{p.name}</strong>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {p.email}
                    </span>
                    <span style={{ display: 'inline-block', marginTop: '0.35rem', fontSize: '0.6rem', color: '#86efac', fontWeight: 700 }}>
                      Message player →
                    </span>
                  </button>
                ))
              ) : (
                <p style={{ fontSize: '0.7rem', opacity: 0.55, padding: '0.65rem', margin: 0 }}>
                  No registered player found for that search.
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
          {!convData && !convError ? (
            <p style={{ fontSize: '0.75rem', opacity: 0.5, textAlign: 'center', margin: 'auto' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> Loading chats...
            </p>
          ) : convError ? (
            <p style={{ fontSize: '0.75rem', color: '#f87171', textAlign: 'center', margin: 'auto' }}>
              Could not load chats. Pull to refresh or reopen this tab.
            </p>
          ) : filteredConversations.length === 0 ? (
            <p style={{ fontSize: '0.75rem', opacity: 0.5, textAlign: 'center', margin: 'auto' }}>No chats found.</p>
          ) : (
            filteredConversations.map((chat) => (
              <div
                key={chat.email}
                onClick={() => {
                  setActiveChatEmail(chat.email);
                  setAdminReplyText('');
                  setAdminAttachment('');
                }}
                style={{
                  padding: '0.75rem',
                  background: activeChatEmail === chat.email ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.01)',
                  border: activeChatEmail === chat.email ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: activeChatEmail === chat.email ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeChatEmail === chat.email ? 'var(--gold-primary)' : 'var(--text-muted)', fontSize: '0.9rem', flexShrink: 0 }}>
                  <i className="fa-solid fa-circle-user"></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.775rem', color: '#fff', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, marginRight: '0.5rem' }}>
                      {chat.name}
                    </strong>
                    {chat.unread && (
                      <span style={{
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '0.55rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '10px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        flexShrink: 0
                      }}>
                        New
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                    {chat.lastMessage}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-section-card support-chat-window">
        {activeChatEmail ? (
          <>
            <div className="support-chat-header">
              <button
                type="button"
                className="support-chat-back-btn"
                onClick={() => setActiveChatEmail(null)}
              >
                <i className="fa-solid fa-chevron-left"></i> Chats
              </button>
              <div className="support-chat-player-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-primary)', border: '1px solid rgba(255,215,0,0.2)', flexShrink: 0 }}>
                  <i className="fa-solid fa-user" style={{ fontSize: '1rem' }}></i>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeChatDisplayName}
                  </h4>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeChatEmail}
                  </span>
                  <span className="support-chat-player-status">
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span> Active Live Chat Support
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setActiveChatEmail(null); }}
                className="close-modal"
              >
                Close Chat
              </button>
            </div>

            <div className="support-chat-messages">
              {showChatLoading ? (
                <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.7, padding: '1.25rem' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.6rem', color: 'var(--gold-primary)', display: 'block', marginBottom: '0.55rem' }}></i>
                  <p style={{ fontSize: '0.8rem', margin: 0 }}>Loading chat…</p>
                </div>
              ) : activeChatMessages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.55, padding: '1.25rem', maxWidth: '280px' }}>
                  <i className="fa-solid fa-paper-plane" style={{ fontSize: '1.6rem', color: 'var(--gold-primary)', display: 'block', marginBottom: '0.55rem' }}></i>
                  <p style={{ fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>
                    No messages yet with <strong style={{ color: '#fff' }}>{activeChatDisplayName}</strong>. Send the first message below.
                  </p>
                </div>
              ) : (
                activeChatMessages.map((msg) => {
                  const isMe = msg.senderType === 'admin';
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        background: isMe ? 'var(--gold-primary)' : 'rgba(255,255,255,0.08)',
                        color: isMe ? '#000' : '#fff',
                        padding: '0.55rem 0.8rem',
                        borderRadius: '12px',
                        borderBottomRightRadius: isMe ? '2px' : '12px',
                        borderBottomLeftRadius: isMe ? '12px' : '2px',
                        fontSize: '0.8rem',
                        maxWidth: 'min(75%, 100%)',
                        fontWeight: isMe ? '600' : 'normal',
                        wordBreak: 'break-word'
                      }}>
                        {msg.message}
                        {msg.attachment && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <img
                              src={msg.attachment}
                              alt="Chat attachment"
                              loading="lazy"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '180px',
                                borderRadius: '6px',
                                cursor: 'zoom-in',
                                border: '1px solid rgba(255,255,255,0.1)',
                                display: 'block'
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxSrc(msg.attachment);
                              }}
                              title="Click to enlarge screenshot"
                            />
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.55rem', opacity: 0.65, marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {isMe ? 'You (Agent)' : (msg.userName && !/^support\s*agent$/i.test(msg.userName) ? msg.userName : activeChatDisplayName || 'Player')} • {formatDeviceTime(msg.timestamp)}
                        {isMe && (
                          msg.read ? (
                            <span style={{ color: '#60a5fa', fontWeight: 'bold', marginLeft: '3px' }}>
                              • <i className="fa-solid fa-check-double" style={{ fontSize: '0.6rem' }}></i> Seen
                            </span>
                          ) : (
                            <span style={{ opacity: 0.6, marginLeft: '3px' }}>
                              • <i className="fa-solid fa-check" style={{ fontSize: '0.6rem' }}></i> Sent
                            </span>
                          )
                        )}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendAdminReply} style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', gap: '0.5rem', flexShrink: 0 }}>
              {adminAttachment && (
                <div style={{ alignSelf: 'flex-start' }}>
                  <div style={{ position: 'relative', display: 'inline-block', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img src={adminAttachment} alt="preview" style={{ maxHeight: '60px', borderRadius: '4px', display: 'block' }} />
                    <button
                      type="button"
                      onClick={() => setAdminAttachment('')}
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '16px',
                        height: '16px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              )}

              {(() => {
                const isTypeBSupportChat = activeChatMessages.some(m => m.distributorType === 'B');
                const isGlobalAdminView = !adminUser?.distributorId;
                const isReadOnlyChat = isTypeBSupportChat && isGlobalAdminView;

                if (isReadOnlyChat) {
                  return (
                    <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '8px', fontSize: '0.75rem', textAlign: 'center', fontWeight: 'bold', margin: '0.5rem 0' }}>
                      <i className="fa-solid fa-lock" style={{ marginRight: '5px' }}></i> Live chat is managed by distributor staff.
                    </div>
                  );
                }

                return (
                  <div className="support-chat-compose" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'nowrap' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#0c0e17',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem',
                        color: 'var(--gold-primary)',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        transition: 'all 0.2s',
                        flexShrink: 0
                      }}
                      title="Attach Image Proof"
                    >
                      <i className="fa-solid fa-paperclip"></i>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </label>

                    <input
                      type="text"
                      placeholder={activeChatMessages.length === 0 ? 'Write first message to player...' : 'Type reply to player...'}
                      value={adminReplyText}
                      onChange={(e) => setAdminReplyText(e.target.value)}
                      style={{
                        flex: '1 1 auto',
                        minWidth: 0,
                        background: '#0c0e17',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '0.65rem 1rem',
                        color: '#fff',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                      required={!adminAttachment}
                    />
                    <button
                      type="submit"
                      className="submit-btn support-chat-reply-btn"
                      style={{ margin: 0, padding: '0.65rem 1.25rem', width: 'auto', background: 'linear-gradient(135deg, #ffd700 0%, #cca000 100%)', color: '#000', fontWeight: 'bold', flexShrink: 0 }}
                    >
                      {activeChatMessages.length === 0 ? 'Send' : 'Reply'}
                    </button>
                  </div>
                );
              })()}
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.5, padding: '1rem' }}>
            <i className="fa-solid fa-headset" style={{ fontSize: '3rem', color: 'var(--gold-primary)', display: 'block', marginBottom: '0.5rem' }}></i>
            <p style={{ fontSize: '0.85rem' }}>Select a conversation or search a player Gmail to start chatting.</p>
          </div>
        )}
      </div>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc('')} alt="Chat screenshot" />
    </div>
  );
}
