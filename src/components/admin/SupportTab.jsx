import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';

const fetcher = (...args) => fetch(...args).then((res) => res.json());

export default function SupportTab({ adminUser }) {
  const [chatSearch, setChatSearch] = useState('');
  const [activeChatEmail, setActiveChatEmail] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const chatEndRef = useRef(null);

  const distQueryParam = adminUser?.distributorId ? `&adminDistributorId=${adminUser.distributorId}` : '';

  // Poll conversation list every 3s
  const { data: convData, mutate: mutateConversations } = useSWR(`/api/support?limit=100${distQueryParam}`, fetcher, {
    refreshInterval: 3000
  });

  // Poll active chat messages every 1.5s if one is selected
  const { data: activeChatData, mutate: mutateActiveChat } = useSWR(
    activeChatEmail ? `/api/support?email=${encodeURIComponent(activeChatEmail)}${distQueryParam}` : null,
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

  const [adminAttachment, setAdminAttachment] = useState('');

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

    // Optimistic Update
    const tempMessage = {
      id: 'temp-' + Date.now(),
      userEmail: activeChatEmail,
      userName: 'Support Agent',
      message: replyMsg,
      attachment: replyAttachment,
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
          attachment: replyAttachment,
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
    <div className="admin-layout-split" style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr',
      gap: '1rem',
      height: '100%',
      minHeight: '520px',
      maxHeight: '100%',
      alignItems: 'stretch',
      animation: 'fade-in 0.2s ease-out'
    }}>
      
      {/* Active chats list */}
      <div className="admin-section-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '0.5rem', letterSpacing: '0.5px' }}>
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
                      {chat.name || chat.email.split('@')[0]}
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

      {/* Conversation window */}
      <div className="admin-section-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden', background: '#07090f' }}>
        {activeChatEmail ? (
          <>
            <div style={{ padding: '0.75rem 1rem', background: '#0b0d16', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '-1rem -1rem 0 -1rem', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,215,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-primary)', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <i className="fa-solid fa-user" style={{ fontSize: '1.1rem' }}></i>
                </div>
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold', margin: 0 }}>{activeChatEmail}</h4>
                  <span style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span> Active Live Chat Support
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setActiveChatEmail(null); }}
                className="close-modal"
                style={{ fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: 'pointer', margin: 0 }}
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

            <form onSubmit={handleSendAdminReply} style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', gap: '0.5rem' }}>
              {/* Attachment Preview */}
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
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Paperclip Button */}
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
                        transition: 'all 0.2s'
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
                      required={!adminAttachment}
                    />
                    <button type="submit" className="submit-btn" style={{ margin: 0, padding: '0.65rem 1.25rem', width: 'auto', background: 'linear-gradient(135deg, #ffd700 0%, #cca000 100%)', color: '#000', fontWeight: 'bold' }}>
                      Reply
                    </button>
                  </div>
                );
              })()}
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
