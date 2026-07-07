import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function SupportTab({ adminUser }) {
  const [chatSearch, setChatSearch] = useState('');
  const [activeChatEmail, setActiveChatEmail] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const chatEndRef = useRef(null);

  // Poll conversation list every 3s
  const { data: convData, mutate: mutateConversations } = useSWR('/api/support?limit=100', fetcher, {
    refreshInterval: 3000
  });

  // Poll active chat messages every 1.5s if one is selected
  const { data: activeChatData, mutate: mutateActiveChat } = useSWR(
    activeChatEmail ? `/api/support?email=${encodeURIComponent(activeChatEmail)}` : null,
    fetcher,
    { refreshInterval: 1500 }
  );

  const allMessages = convData?.messages || [];
  const activeChatMessages = activeChatData?.messages || [];

  // Group messages for sidebar conversations
  const groups = {};
  allMessages.forEach((msg) => {
    const email = msg.userEmail.toLowerCase();
    if (!groups[email]) {
      groups[email] = {
        email: msg.userEmail,
        name: msg.userName,
        lastMessage: msg.message,
        timestamp: msg.timestamp,
        unread: msg.senderType === 'player' && msg.read === false
      };
    }
  });

  const conversations = Object.values(groups).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const filteredConversations = conversations.filter(
    (c) =>
      c.email.toLowerCase().includes(chatSearch.toLowerCase()) ||
      (c.name && c.name.toLowerCase().includes(chatSearch.toLowerCase()))
  );

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
          body: JSON.stringify({ email: activeChatEmail })
        });
        mutateConversations();
      } catch (err) {
        console.error('Failed to mark support messages as read:', err);
      }
    };

    markAsRead();
  }, [activeChatEmail, activeChatMessages.length, mutateConversations]);

  const handleSendAdminReply = async (e) => {
    e.preventDefault();
    if (!adminReplyText.trim() || !activeChatEmail || !adminUser) return;

    const replyMsg = adminReplyText;
    setAdminReplyText('');

    // Optimistic Update
    const tempMessage = {
      id: 'temp-' + Date.now(),
      userEmail: activeChatEmail,
      userName: 'Support Agent',
      message: replyMsg,
      senderType: 'admin',
      senderEmail: adminUser.email,
      timestamp: new Date().toISOString()
    };

    // Mutate state locally
    mutateActiveChat(
      { success: true, messages: [...activeChatMessages, tempMessage] },
      false
    );

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: activeChatEmail,
          userName: 'Support Agent',
          message: replyMsg,
          senderType: 'admin',
          senderEmail: adminUser.email
        })
      });
      const data = await response.json();
      if (data.success) {
        mutateActiveChat();
        mutateConversations();
      }
    } catch (err) {
      console.error('Send admin reply error:', err);
    }
  };

  return (
    <div className="admin-layout-split" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', height: '600px', animation: 'fade-in 0.2s ease-out' }}>
      
      {/* Active chats list */}
      <div className="admin-section-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            <i className="fa-solid fa-comments"></i> Active Conversations
          </h4>
          <div className="input-wrapper search-wrapper" style={{ background: '#0b0d16', padding: '0.35rem 0.75rem' }}>
            <input
              type="text"
              placeholder="Search chats..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              style={{ fontSize: '0.75rem' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredConversations.length === 0 ? (
            <p style={{ fontSize: '0.75rem', opacity: 0.5, textAlign: 'center', margin: 'auto' }}>No chats found.</p>
          ) : (
            filteredConversations.map((chat) => (
              <div
                key={chat.email}
                onClick={() => setActiveChatEmail(chat.email)}
                style={{
                  padding: '0.75rem 1rem',
                  background: activeChatEmail === chat.email ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.02)',
                  border: activeChatEmail === chat.email ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.8rem', color: '#fff', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, marginRight: '0.5rem' }}>
                    {chat.name || 'Player'}
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
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                  {chat.lastMessage}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation window */}
      <div className="admin-section-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden', background: '#07090f' }}>
        {activeChatEmail ? (
          <>
            <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Chat: {activeChatEmail}</h4>
                <span style={{ fontSize: '0.7rem', color: '#ffd700' }}>Active Live Support Session</span>
              </div>
              <button
                onClick={() => { setActiveChatEmail(null); }}
                className="close-modal"
                style={{ fontSize: '1rem', border: '1px solid rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}
              >
                Close Chat
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: '1rem 0', paddingRight: '0.25rem' }}>
              {activeChatMessages.map((msg) => {
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
                      maxWidth: '75%',
                      fontWeight: isMe ? '600' : 'normal',
                      wordBreak: 'break-word'
                    }}>
                      {msg.message}
                      {msg.attachment && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <img
                            src={msg.attachment}
                            alt="User Attachment"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '180px',
                              borderRadius: '6px',
                              cursor: 'zoom-in',
                              border: '1px solid rgba(255,255,255,0.1)',
                              display: 'block'
                            }}
                            onClick={() => window.open(msg.attachment, '_blank')}
                            title="Click to view full-size image proof"
                          />
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '0.55rem', opacity: 0.5, marginTop: '0.15rem' }}>
                      {isMe ? 'You (Agent)' : (msg.userName || 'Player')} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendAdminReply} style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
              <input
                type="text"
                placeholder="Type reply to player..."
                value={adminReplyText}
                onChange={(e) => setAdminReplyText(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0c0e17',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '0.65rem 1rem',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
                required
              />
              <button type="submit" className="submit-btn" style={{ margin: 0, padding: '0.65rem 1.25rem', width: 'auto', background: 'linear-gradient(135deg, #ffd700 0%, #cca000 100%)', color: '#000', fontWeight: 'bold' }}>
                Reply
              </button>
            </form>
          </>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.5 }}>
            <i className="fa-solid fa-headset" style={{ fontSize: '3rem', color: 'var(--gold-primary)', display: 'block', marginBottom: '0.5rem' }}></i>
            <p style={{ fontSize: '0.85rem' }}>Select a conversation from the sidebar to text live with players.</p>
          </div>
        )}
      </div>
    </div>
  );
}
