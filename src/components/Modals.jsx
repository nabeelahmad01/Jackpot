'use client';

import React, { useState, useEffect, useRef } from 'react';

// --- A) CUSTOMER SUPPORT MODAL ---
export function SupportModal({ isOpen, onClose, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState('');
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/support?email=${encodeURIComponent(currentUser.email)}`);
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Failed to load support chat:', err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll replies every 3 seconds

    return () => clearInterval(interval);
  }, [isOpen, currentUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!input.trim() && !attachment) return;

    const userEmail = currentUser.email;
    const userName = currentUser.name;
    const msgText = input;
    const currentAttachment = attachment;

    setInput('');
    setAttachment('');

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          userName,
          message: msgText,
          attachment: currentAttachment,
          senderType: 'player',
          senderEmail: userEmail
        })
      });
      const data = await response.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (err) {
      console.error('Send support msg error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', height: '550px', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ padding: '1rem 1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>
            <i className="fa-solid fa-headset gold-text"></i> Live Customer Support
          </h3>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>
        
        <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden', background: '#080a10' }}>
          <p style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '0.75rem', textAlign: 'center' }}>
            Experiencing login, OTP, coin or withdrawal issues? Text our support agent.
          </p>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem', marginBottom: '1rem' }}>
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                <i className="fa-solid fa-comments" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem', color: 'var(--gold-primary)' }}></i>
                No messages yet. Send a message to start!
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderType === 'player';
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      background: isMe ? 'var(--gold-primary)' : 'rgba(255,255,255,0.08)',
                      color: isMe ? '#000' : '#fff',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '12px',
                      borderBottomRightRadius: isMe ? '2px' : '12px',
                      borderBottomLeftRadius: isMe ? '12px' : '2px',
                      fontSize: '0.8rem',
                      maxWidth: '80%',
                      fontWeight: isMe ? '600' : 'normal',
                      wordBreak: 'break-word'
                    }}>
                      {msg.message}
                      {msg.attachment && (
                        <img
                          src={msg.attachment}
                          alt="Support Attachment"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '180px',
                            display: 'block',
                            borderRadius: '8px',
                            marginTop: '0.4rem',
                            border: '1px solid rgba(255,255,255,0.1)',
                            cursor: 'zoom-in'
                          }}
                          onClick={() => window.open(msg.attachment, '_blank')}
                        />
                      )}
                    </div>
                    <span style={{ fontSize: '0.55rem', opacity: 0.5, marginTop: '0.2rem' }}>
                      {isMe ? 'You' : (msg.userName || 'Support Agent')} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {attachment && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.3)', marginBottom: '0.5rem' }}>
              <img src={attachment} alt="attachment preview" style={{ width: '35px', height: '35px', objectFit: 'cover', borderRadius: '4px' }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flex: 1 }}>Image attached (ready to send)</span>
              <button type="button" onClick={() => setAttachment('')} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.9rem', cursor: 'pointer', padding: '0 0.2rem' }}>&times;</button>
            </div>
          )}

          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', alignItems: 'center' }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  alert('Screenshot attachment must be less than 2MB.');
                  return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                  setAttachment(reader.result);
                };
                reader.readAsDataURL(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: '#1c1e2b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'var(--gold-primary)',
                cursor: 'pointer',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 0,
                fontSize: '0.95rem'
              }}
              title="Attach screenshot proof"
            >
              <i className="fa-solid fa-paperclip"></i>
            </button>
            <input
              type="text"
              placeholder="Type message here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                background: '#0c0e17',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '0.65rem 1rem',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
                height: '40px'
              }}
              required={!attachment}
            />
            <button type="submit" style={{ margin: 0, padding: 0, width: '40px', height: '40px', background: 'linear-gradient(135deg, #ffd700 0%, #cca000 100%)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- B) GOOGLE WARNING MODAL ---
export function GoogleWarningModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-content border-red" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-triangle-exclamation text-red"></i> Browser Limitation
          </h3>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p>Google authentication is blocked inside Facebook/Messenger's webview wrapper for safety.</p>
          <p className="text-secondary">
            Please click the top-right menu icon in Messenger (the <strong>three dots</strong> or{' '}
            <strong>compass icon</strong>) and select <strong>"Open in Chrome"</strong> or{' '}
            <strong>"Open in Safari"</strong> to continue with Google.
          </p>
          <button type="button" className="submit-btn red-btn" onClick={onClose}>
            <span>UNDERSTOOD</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- C) ADMIN GAME ADD/EDIT MODAL (LOGO UPLOADER INTEGRATED) ---
export function AdminGameModal({ isOpen, onClose, onSave, editGame }) {
  const [title, setTitle] = useState('');
  const [badge, setBadge] = useState('none');
  const [image, setImage] = useState('');
  const [link, setLink] = useState('https://play.jackpotentry.com/game');
  
  const [titleError, setTitleError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [imageError, setImageError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editGame) {
        setTitle(editGame.title);
        setBadge(editGame.badge);
        setImage(editGame.image);
        setLink(editGame.link);
      } else {
        setTitle('');
        setBadge('none');
        setImage('');
        setLink('https://play.jackpotentry.com/game');
      }
      setTitleError('');
      setLinkError('');
      setImageError('');
    }
  }, [isOpen, editGame]);

  if (!isOpen) return null;

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setImageError('Logo cover image size must be less than 2MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result);
      setImageError('');
    };
    reader.readAsDataURL(file);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    let isValid = true;

    if (title.trim() === '') {
      setTitleError('Game title is required');
      isValid = false;
    }

    if (link.trim() === '') {
      setLinkError('Target play link is required');
      isValid = false;
    }

    if (image.trim() === '') {
      setImageError('Please upload a game cover logo graphic.');
      isValid = false;
    }

    if (isValid) {
      setIsSubmitting(true);
      try {
        await onSave({
          id: editGame ? editGame.id : null,
          title: title.trim(),
          badge,
          image,
          link: link.trim(),
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-plus-circle gold-text"></i>{' '}
            {editGame ? 'Edit Game' : 'Add New Game'}
          </h3>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <label htmlFor="game-title-input">Game Title</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-gamepad input-icon"></i>
                <input
                  type="text"
                  id="game-title-input"
                  placeholder="e.g. Juwa 2.0"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleError('');
                  }}
                  required
                />
              </div>
              <span className="error-msg">{titleError}</span>
            </div>

            <div className="input-group">
              <label htmlFor="game-badge-select">Badge Type</label>
              <div className="input-wrapper select-wrapper">
                <i className="fa-solid fa-tag input-icon"></i>
                <select
                  id="game-badge-select"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  required
                >
                  <option value="none">None</option>
                  <option value="hot">HOT (Red Badge)</option>
                  <option value="new">NEW (Gold Badge)</option>
                </select>
              </div>
            </div>

            {/* Logo Image Uploader */}
            <div className="input-group">
              <label htmlFor="game-logo-uploader">Upload Game Logo / Graphic</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-image input-icon"></i>
                <input
                  type="file"
                  id="game-logo-uploader"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ border: 'none', background: 'none', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', padding: '0.4rem 0', width: '100%' }}
                  required={!editGame}
                />
              </div>
              <span className="error-msg">{imageError}</span>
              {image && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '40px', height: '40px', overflow: 'hidden', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img src={image} alt="Cover Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 'bold' }}>Logo selected.</span>
                </div>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="game-link-input">Target Play Link (External URL)</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-link input-icon"></i>
                <input
                  type="url"
                  id="game-link-input"
                  placeholder="e.g. https://play.juwa.org/"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setLinkError('');
                  }}
                  required
                />
              </div>
              <span className="error-msg">{linkError}</span>
            </div>

            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              <span>{isSubmitting ? 'SAVING...' : (editGame ? 'UPDATE GAME' : 'SAVE GAME')}</span>
              <div className="btn-glow"></div>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- D) DYNAMIC CHOOSE PAYMENT METHOD MODAL (MAPPED FROM DATABASES) ---
export function PaymentMethodModal({ isOpen, onClose, amount, gateways = [], onSelectMethod }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0.25rem' }}>
          <h3 style={{ textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
            Choose Payment Method
          </h3>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>
        
        <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            Deposit Amount
          </span>
          <h2 style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', color: '#00d2ff', textShadow: '0 0 15px rgba(0, 210, 255, 0.4)', margin: '0.25rem 0 1.5rem 0', fontWeight: '900' }}>
            ${parseFloat(amount || 0).toFixed(2)}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
            {gateways.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No payment methods available.</p>
            ) : (
              gateways.map((g) => {
                let btnStyle = { background: '#94a3b8' };
                if (g.theme === 'chime') {
                  btnStyle = { background: '#2ecc71' };
                } else if (g.theme === 'cashapp') {
                  btnStyle = { background: '#111320', border: '1px solid rgba(255,255,255,0.1)' };
                } else if (g.theme === 'crypto') {
                  btnStyle = { background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' };
                } else if (g.theme === 'zelle') {
                  btnStyle = { background: '#7413dc' };
                } else if (g.theme === 'paypal') {
                  btnStyle = { background: '#0079c1' };
                } else if (g.theme === 'venmo') {
                  btnStyle = { background: '#008cff' };
                }

                return (
                  <div key={g.id} className="payment-gateway-option" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-muted)', borderRadius: '14px', padding: '1rem', textAlign: 'left' }}>
                    <h4 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: '700', marginBottom: '0.15rem' }}>{g.name}</h4>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{g.subtitle}</p>
                    <button
                      type="button"
                      className="submit-btn"
                      onClick={() => onSelectMethod(g)}
                      style={{ ...btnStyle, boxShadow: 'none', padding: '0.75rem', marginTop: 0 }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: '900' }}>CONTINUE WITH {g.name.toUpperCase()}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- E) ADMIN APPROVE ACCOUNT REQUEST MODAL ---
export function ApproveAccountModal({ isOpen, onClose, onApprove, requestDetails }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [userError, setUserError] = useState('');
  const [passError, setPassError] = useState('');

  useEffect(() => {
    if (isOpen && requestDetails) {
      const randomSuf = Math.floor(100 + Math.random() * 900);
      const cleanEmail = requestDetails.userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      setUsername(`${cleanEmail}${randomSuf}`);
      
      const charSet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randPass = '';
      for (let i = 0; i < 8; i++) {
        randPass += charSet.charAt(Math.floor(Math.random() * charSet.length));
      }
      setPassword(randPass);
      
      setUserError('');
      setPassError('');
    }
  }, [isOpen, requestDetails]);

  if (!isOpen || !requestDetails) return null;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    let isValid = true;
    if (username.trim() === '') {
      setUserError('Username is required');
      isValid = false;
    }
    if (password.trim() === '') {
      setPassError('Password is required');
      isValid = false;
    }

    if (isValid) {
      setIsSubmitting(true);
      try {
        await onApprove({
          requestId: requestDetails.id,
          userEmail: requestDetails.userEmail,
          gameTitle: requestDetails.gameTitle,
          username: username.trim(),
          password: password.trim()
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-user-check gold-text"></i> Approve Game Account
          </h3>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Allocating a new gaming account for player <strong>{requestDetails.userEmail}</strong> on game <strong>{requestDetails.gameTitle}</strong>.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <label htmlFor="allot-username">Login Username</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-user-gear input-icon"></i>
                <input
                  type="text"
                  id="allot-username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setUserError(''); }}
                  required
                />
              </div>
              <span className="error-msg">{userError}</span>
            </div>

            <div className="input-group">
              <label htmlFor="allot-password">Login Password</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-key input-icon"></i>
                <input
                  type="text"
                  id="allot-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPassError(''); }}
                  required
                />
              </div>
              <span className="error-msg">{passError}</span>
            </div>

            <button type="submit" className="submit-btn" style={{ marginTop: '0.5rem' }} disabled={isSubmitting}>
              <span>{isSubmitting ? 'TRANSMITTING...' : 'APPROVE & TRANSMIT'}</span>
              <div className="btn-glow"></div>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- F) DYNAMIC PAYMENT GATEWAY ADD/EDIT MODAL (QR CODE UPLOADER INTEGRATED) ---
export function AdminGatewayModal({ isOpen, onClose, onSave, editGateway }) {
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [tag, setTag] = useState('');
  const [phone, setPhone] = useState('');
  const [theme, setTheme] = useState('chime');
  const [qrImage, setQrImage] = useState('');

  const [nameError, setNameError] = useState('');
  const [tagError, setTagError] = useState('');
  const [qrError, setQrError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editGateway) {
        setName(editGateway.name);
        setSubtitle(editGateway.subtitle);
        setTag(editGateway.tag);
        setPhone(editGateway.phone);
        setTheme(editGateway.theme);
        setQrImage(editGateway.qrImage);
      } else {
        setName('');
        setSubtitle('');
        setTag('');
        setPhone('');
        setTheme('chime');
        setQrImage('');
      }
      setNameError('');
      setTagError('');
      setQrError('');
    }
  }, [isOpen, editGateway]);

  if (!isOpen) return null;

  const handleQrUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setQrError('QR graphic cover image size must be less than 2MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setQrImage(reader.result);
      setQrError('');
    };
    reader.readAsDataURL(file);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    let isValid = true;

    if (name.trim() === '') {
      setNameError('Gateway Name is required');
      isValid = false;
    }
    if (tag.trim() === '') {
      setTagError('Payment Tag/Address is required');
      isValid = false;
    }

    if (qrImage.trim() === '') {
      setQrError('Please upload the QR Code Image Graphic.');
      isValid = false;
    }

    if (isValid) {
      setIsSubmitting(true);
      try {
        await onSave({
          id: editGateway ? editGateway.id : null,
          name: name.trim(),
          subtitle: subtitle.trim(),
          tag: tag.trim(),
          phone: phone.trim(),
          theme,
          qrImage: qrImage
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-content border-gold" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-sliders gold-text"></i>{' '}
            {editGateway ? 'Edit Gateway' : 'Add New Gateway'}
          </h3>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <label htmlFor="gt-name">Gateway Name</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-wallet input-icon"></i>
                <input
                  type="text"
                  id="gt-name"
                  placeholder="e.g. Zelle, Venmo"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(''); }}
                  required
                />
              </div>
              <span className="error-msg">{nameError}</span>
            </div>

            <div className="input-group">
              <label htmlFor="gt-sub">Description subtitle</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-message input-icon"></i>
                <input
                  type="text"
                  id="gt-sub"
                  placeholder="e.g. Pay using bank transfer"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="gt-tag">Payment Tag / ID Address</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-at input-icon"></i>
                <input
                  type="text"
                  id="gt-tag"
                  placeholder="e.g. $MyTag, name@email.com"
                  value={tag}
                  onChange={(e) => { setTag(e.target.value); setTagError(''); }}
                  required
                />
              </div>
              <span className="error-msg">{tagError}</span>
            </div>

            <div className="input-group">
              <label htmlFor="gt-phone">Linked Phone / Info Details</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-phone input-icon"></i>
                <input
                  type="text"
                  id="gt-phone"
                  placeholder="e.g. 555-123-4567, USDT TRC20"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="gt-theme">Button Visual Theme</label>
              <div className="input-wrapper select-wrapper">
                <i className="fa-solid fa-palette input-icon"></i>
                <select
                  id="gt-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  required
                >
                  <option value="chime">Chime Green</option>
                  <option value="cashapp">Cash App Outline</option>
                  <option value="crypto">Crypto Pink-Purple Gradient</option>
                  <option value="zelle">Zelle Purple</option>
                  <option value="paypal">PayPal Blue</option>
                  <option value="venmo">Venmo Cyan</option>
                </select>
              </div>
            </div>

            {/* QR Graphic File Uploader */}
            <div className="input-group">
              <label htmlFor="gt-qr-uploader">Upload QR Code Image</label>
              <div className="input-wrapper">
                <i className="fa-solid fa-qrcode input-icon"></i>
                <input
                  type="file"
                  id="gt-qr-uploader"
                  accept="image/*"
                  onChange={handleQrUpload}
                  style={{ border: 'none', background: 'none', color: '#fff', fontSize: '0.75rem', cursor: 'pointer', padding: '0.4rem 0', width: '100%' }}
                  required={!editGateway}
                />
              </div>
              <span className="error-msg">{qrError}</span>
              {qrImage && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '40px', height: '40px', overflow: 'hidden', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <img src={qrImage} alt="QR Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 'bold' }}>QR Code selected.</span>
                </div>
              )}
            </div>

            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              <span>{isSubmitting ? 'SAVING...' : (editGateway ? 'UPDATE GATEWAY' : 'SAVE GATEWAY')}</span>
              <div className="btn-glow"></div>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- G) VIEW RECEIPT PROOF MODAL ---
export function ViewProofModal({ isOpen, onClose, proofUrl }) {
  if (!isOpen || !proofUrl) return null;

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', border: '1px solid var(--gold-primary)' }}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-receipt gold-text"></i> Payment Screenshot Receipt
          </h3>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div style={{ width: '100%', maxHeight: '450px', overflowY: 'auto', borderRadius: '12px', background: '#090a10', border: '1px solid rgba(255,255,255,0.05)', padding: '0.25rem' }}>
            <img
              src={proofUrl}
              alt="Payment Screenshot Receipt proof"
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px', objectFit: 'contain' }}
            />
          </div>
          <button type="button" className="submit-btn" onClick={onClose} style={{ marginTop: '0.5rem' }}>
            <span>CLOSE INSPECTOR</span>
          </button>
        </div>
      </div>
    </div>
  );
}
