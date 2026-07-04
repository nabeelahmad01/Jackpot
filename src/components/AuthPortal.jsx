'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';

export default function AuthPortal({
  onLoginSuccess,
  onRegisterSuccess,
  onGoogleWarning,
  triggerLoading,
  showToast,
  onOpenSupport,
}) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'your_google_client_id_here';

  // Detect Facebook/Messenger In-App WebView
  const isMessengerWebView = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Messenger") > -1);
  };

  // Google OAuth Authentication login hook
  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      triggerLoading(1500, async () => {
        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
          });
          const profile = await res.json();
          
          if (!profile.email) {
            showToast('Failed to fetch email profile from Google.', 'error');
            return;
          }

          const userEmail = profile.email.toLowerCase();
          const userName = profile.name || 'Google Player';
          
          try {
            const googleRes = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: userEmail, name: userName, referredBy: localStorage.getItem('jackpot_ref_code') || '' })
            });
            const googleData = await googleRes.json();
            
            if (googleData.success) {
              if (googleData.isNewUser) {
                showToast(`Google account registered! Welcome, ${userName}.`, 'success');
              } else {
                showToast(`Welcome back, ${userName}!`, 'success');
              }
              onLoginSuccess(googleData.user);
            } else {
              showToast(googleData.message || 'Google registration/login failed on server.', 'error');
            }
          } catch (err) {
            console.error('Google DB save failed:', err);
            showToast('Connection error connecting Google credentials to server.', 'error');
          }
        } catch (err) {
          console.error('Google profile fetch failed:', err);
          showToast('Google Authentication succeeded, but profile fetch failed.', 'error');
        }
      });
    },
    onError: (error) => {
      console.error('Google Login Error:', error);
      showToast('Google Sign-In failed or was cancelled.', 'error');
    }
  });

  const handleGoogleClick = () => {
    if (isMessengerWebView()) {
      onGoogleWarning();
    } else {
      if (googleClientId === 'your_google_client_id_here' || !googleClientId) {
        // Run Simulator Fallback
        showToast('Google OAuth Simulator triggered (Client ID not configured in .env.local).', 'info');
        triggerLoading(1200, async () => {
          const testUser = {
            name: 'Google Demo Player',
            email: 'google-player@test.com'
          };
          try {
            const googleRes = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: testUser.email, name: testUser.name, referredBy: localStorage.getItem('jackpot_ref_code') || '' })
            });
            const googleData = await googleRes.json();
            if (googleData.success) {
              onLoginSuccess(googleData.user);
            }
          } catch (err) {
            console.error('Google Simulator save failed:', err);
          }
        });
      } else {
        loginWithGoogle();
      }
    }
  };

  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register' | 'forgot' | 'otp'
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);

  // Error Hooks
  const [errors, setErrors] = useState({});

  // OTP Countdown States
  const [countdown, setCountdown] = useState(30);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [activeOtpCode, setActiveOtpCode] = useState(null);
  const [pendingUserData, setPendingUserData] = useState(null);

  // References for OTP boxes chaining
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // Clear verification styles on field inputs
  const handleInputChange = (field, val, setter) => {
    setter(val);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

  // Validation Actions
  const validateEmail = (email, fieldName) => {
    if (email.trim() === '') {
      return `${fieldName} is required`;
    }
    if (!emailPattern.test(email.trim())) {
      return 'Please enter a valid email format';
    }
    return '';
  };

  // OTP timer effect
  useEffect(() => {
    let timer;
    if (activeTab === 'otp' && countdown > 0) {
      setResendDisabled(true);
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setResendDisabled(false);
    }
    return () => clearInterval(timer);
  }, [activeTab, countdown]);

  // Generate OTP and dispatch via real SMTP or simulator fallback
  const triggerDemoOtpCode = async (userData) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setActiveOtpCode(code);
    console.log(`[Verification Code Generated] OTP Code: ${code}`);

    const targetEmail = userData?.email || userData?.recoveryEmail;
    const targetName = userData?.name || 'Player';

    if (targetEmail) {
      try {
        const response = await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail, otp: code, name: targetName })
        });
        const data = await response.json();
        
        if (data.success) {
          if (data.simulated) {
            // SMTP not set in env variables
            setTimeout(() => {
              showToast(`🚨 DEMO CODE: Enter verification OTP code ${code} to proceed.`, 'info');
            }, 1000);
          } else {
            showToast('Real OTP Verification code sent to your email inbox!', 'success');
          }
        } else {
          showToast('Real SMTP dispatch failed. Falling back to demo alert!', 'error');
          setTimeout(() => {
            showToast(`🚨 DEMO CODE: Enter verification OTP code ${code} to proceed.`, 'info');
          }, 1500);
        }
      } catch (err) {
        console.error('Mail dispatch network error:', err);
        setTimeout(() => {
          showToast(`🚨 DEMO CODE: Enter verification OTP code ${code} to proceed.`, 'info');
        }, 1500);
      }
    } else {
      setTimeout(() => {
        showToast(`🚨 DEMO CODE: Enter verification OTP code ${code} to proceed.`, 'info');
      }, 1500);
    }
  };

  const startOtpFlow = (userData) => {
    setPendingUserData(userData);
    setActiveTab('otp');
    setCountdown(30);
    triggerDemoOtpCode(userData);
  };

  // Submit Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(loginEmail, 'Email address');
    const passErr = loginPassword.trim() === '' ? 'Password is required' : '';

    if (emailErr || passErr) {
      setErrors({ loginEmail: emailErr, loginPassword: passErr });
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await response.json();
      
      if (data.success) {
        triggerLoading(1500, () => {
          onLoginSuccess(data.user);
          setLoginEmail('');
          setLoginPassword('');
        });
      } else {
        setErrors({ loginPassword: data.message || 'Incorrect email or password' });
      }
    } catch (err) {
      console.error('Login submit error:', err);
      setErrors({ loginPassword: 'Connection error during login.' });
    }
  };

  // Submit Register (Fires OTP verification page)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const nameErr = regName.trim() === '' ? 'Full Name is required' : '';
    const emailErr = validateEmail(regEmail, 'Email address');
    let passErr = regPassword.trim() === '' ? 'Password is required' : '';
    if (!passErr && regPassword.length < 8) {
      passErr = 'Password must be at least 8 characters long';
    }

    if (nameErr || emailErr || passErr) {
      setErrors({ regName: nameErr, regEmail: emailErr, regPassword: passErr });
      return;
    }

    try {
      const checkRes = await fetch(`/api/auth/register?email=${encodeURIComponent(regEmail.trim())}`);
      const checkData = await checkRes.json();
      
      if (checkData.success && checkData.exists) {
        setErrors({ regEmail: 'An account is already registered with this email' });
        return;
      }

      const newUser = {
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: 'user',
        referredBy: localStorage.getItem('jackpot_ref_code') || '',
      };

      triggerLoading(1200, () => {
        startOtpFlow(newUser);
        showToast('Security code dispatched. Check the top info bar!', 'success');
      });
    } catch (err) {
      console.error('Registration email check error:', err);
      showToast('Connection error during registration check.', 'error');
    }
  };

  // Submit Forgot Password (Fires OTP verification page)
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    const emailErr = validateEmail(forgotEmail, 'Email address');

    if (emailErr) {
      setErrors({ forgotEmail: emailErr });
      return;
    }

    try {
      const response = await fetch(`/api/auth/register?email=${encodeURIComponent(forgotEmail.trim())}`);
      const data = await response.json();
      
      if (data.success && data.exists) {
        triggerLoading(1200, () => {
          startOtpFlow({
            recoveryEmail: forgotEmail.trim(),
            name: data.name,
            password: data.password
          });
          showToast('Password reset code dispatched. Check the top info bar!', 'success');
        });
      } else {
        setErrors({ forgotEmail: 'No account found with this email address' });
      }
    } catch (err) {
      console.error('Forgot password check error:', err);
      showToast('Connection error checking email account.', 'error');
    }
  };

  // Chaining OTP Input Fields
  const handleOtpInput = (val, index) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    const newOtp = [...otpValues];
    newOtp[index] = cleanVal;
    setOtpValues(newOtp);

    // Shift Focus
    if (cleanVal.length === 1 && index < 5) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace' && otpValues[index] === '' && index > 0) {
      const newOtp = [...otpValues];
      newOtp[index - 1] = '';
      setOtpValues(newOtp);
      otpRefs[index - 1].current.focus();
    }
  };

  // Submit OTP Verification Code
  const handleOtpVerify = (e) => {
    e.preventDefault();
    const code = otpValues.join('');
    
    if (code.length < 6) {
      setErrors({ otp: 'Please enter all 6 digits' });
      return;
    }

    setErrors({ otp: '' });

    triggerLoading(2000, () => {
      if (code === activeOtpCode) {
        if (pendingUserData && pendingUserData.recoveryEmail) {
          // Password Recovery Case
          showToast(
            `Verification successful! Password recovery: Your password is "${pendingUserData.password}".`,
            'success',
            12000
          );
          resetOtpState();
          switchTab('login');
        } else if (pendingUserData) {
          // Account Registration Case
          fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pendingUserData)
          })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              onRegisterSuccess(data.user);
              resetOtpState();
              resetFormFields();
            } else {
              setErrors({ otp: data.message || 'Server error during registration.' });
            }
          })
          .catch(err => {
            console.error('Registration fetch error:', err);
            setErrors({ otp: 'Connection error finalizing registration.' });
          });
        }
      } else {
        setErrors({ otp: 'Invalid verification code. Please check & try again.' });
        // Trigger shaking effects on container
        const otpContainer = document.querySelector('.otp-inputs-container');
        if (otpContainer) {
          otpContainer.style.animation = 'none';
          otpContainer.offsetHeight; // Reflow trigger
          otpContainer.style.animation = 'shake 0.4s ease';
        }
      }
    });
  };

  const resetOtpState = () => {
    setOtpValues(['', '', '', '', '', '']);
    setPendingUserData(null);
    setActiveOtpCode(null);
  };

  const resetFormFields = () => {
    setLoginEmail('');
    setLoginPassword('');
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setForgotEmail('');
    setErrors({});
  };

  const handleResendOtp = () => {
    triggerLoading(1000, () => {
      setCountdown(30);
      triggerDemoOtpCode();
      showToast('A new verification code has been dispatched to your email.', 'success');
    });
  };

  const switchTab = (tab) => {
    setErrors({});
    setActiveTab(tab);
    resetOtpState();
  };

  return (
    <div className="auth-page-wrapper">
      {/* Left Graphic Panel (Desktop only) */}
      <div className="auth-graphic-panel"></div>

      {/* Right Form Panel */}
      <div className="auth-form-panel">
        {/* Top welcome banner */}
        <div className="header-banner">
          <div className="banner-text">
            <div className="banner-subtitle">WELCOME TO JACKPOT ROYALS</div>
            <div className="banner-desc">Grab amazing bonuses and win big!</div>
          </div>
          <div className="banner-logo-container animate-float">
            <img src="/jackpot_royals_logo.png" alt="Jackpot Royals Logo" className="banner-logo" />
            <div className="logo-glow"></div>
          </div>
        </div>

        {/* Big logo/brand title */}
        <div className="brand-title-container">
          <h2 className="brand-title">
            <span className="brand-text-1">JACKPOT</span>
            <span className="brand-text-2">ROYALS</span>
          </h2>
        </div>

        {/* Auth Card wrapper */}
        <article className="auth-card" id="auth-card">
          <div className="glow-border-layer"></div>

          <div className="auth-panels">
            {/* ==========================================
                 1) LOGIN PANEL 
                 ========================================== */}
            {activeTab === 'login' && (
              <section className="auth-panel active" aria-labelledby="login-header">
                <h3 className="sr-only" id="login-header">Login Account</h3>
                
                <button type="button" className="google-auth-btn" onClick={handleGoogleClick}>
                  <svg className="google-svg" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>
                
                <p className="messenger-warning">
                  <i className="fa-solid fa-circle-exclamation"></i> Google sign-in is not supported inside Messenger. Please open this page in Chrome or Safari.
                </p>

                <div className="divider">
                  <span>or login with email</span>
                </div>

                <form onSubmit={handleLoginSubmit} noValidate>
                  <div className="input-group">
                    <label htmlFor="login-email">Email Address</label>
                    <div className="input-wrapper">
                      <i className="fa-solid fa-envelope input-icon"></i>
                      <input
                        type="email"
                        id="login-email"
                        placeholder="example@email.com"
                        value={loginEmail}
                        onChange={(e) => handleInputChange('loginEmail', e.target.value, setLoginEmail)}
                        required
                      />
                    </div>
                    <span className="error-msg">{errors.loginEmail}</span>
                  </div>

                  <div className="input-group">
                    <div className="label-row">
                      <label htmlFor="login-password">Password</label>
                    </div>
                    <div className="input-wrapper">
                      <i className="fa-solid fa-lock input-icon"></i>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="login-password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => handleInputChange('loginPassword', e.target.value, setLoginPassword)}
                        required
                      />
                      <button
                        type="button"
                        className="toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Toggle Password Visibility"
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                      </button>
                    </div>
                    <span className="error-msg">{errors.loginPassword}</span>
                  </div>

                  <button type="submit" className="submit-btn slanted-green-btn">
                    <span className="btn-inner">LOGIN</span>
                    <div className="btn-glow"></div>
                  </button>
                </form>

                <div className="bottom-action-buttons">
                  <button type="button" className="slanted-action-btn register-btn" onClick={() => switchTab('register')}>
                    <span className="btn-inner">REGISTER</span>
                  </button>
                  <button type="button" className="slanted-action-btn forgot-btn" onClick={() => switchTab('forgot')}>
                    <span className="btn-inner">FORGOT</span>
                  </button>
                </div>
              </section>
            )}

            {/* ==========================================
                 2) REGISTER PANEL
                 ========================================== */}
            {activeTab === 'register' && (
              <section className="auth-panel active" aria-labelledby="register-header">
                <h3 className="panel-heading" id="register-header">Quick signup</h3>
                
                <button type="button" className="google-auth-btn" onClick={handleGoogleClick}>
                  <svg className="google-svg" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span>Sign up with Google</span>
                </button>
                
                <p className="messenger-warning">
                  <i className="fa-solid fa-circle-exclamation"></i> Google sign-in is not supported inside Messenger. Please open this page in Chrome or Safari.
                </p>

                <div className="divider">
                  <span>or create account with email</span>
                </div>

                <form onSubmit={handleRegisterSubmit} noValidate>
                  <div className="input-group">
                    <label htmlFor="reg-name">Full Name</label>
                    <div className="input-wrapper">
                      <i className="fa-solid fa-user input-icon"></i>
                      <input
                        type="text"
                        id="reg-name"
                        placeholder="John Doe"
                        value={regName}
                        onChange={(e) => handleInputChange('regName', e.target.value, setRegName)}
                        required
                      />
                    </div>
                    <span className="error-msg">{errors.regName}</span>
                  </div>

                  <div className="input-group">
                    <label htmlFor="reg-email">Email Address</label>
                    <div className="input-wrapper">
                      <i className="fa-solid fa-envelope input-icon"></i>
                      <input
                        type="email"
                        id="reg-email"
                        placeholder="example@email.com"
                        value={regEmail}
                        onChange={(e) => handleInputChange('regEmail', e.target.value, setRegEmail)}
                        required
                      />
                    </div>
                    <span className="error-msg">{errors.regEmail}</span>
                  </div>

                  <div className="input-group">
                    <label htmlFor="reg-password">Password</label>
                    <div className="input-wrapper">
                      <i className="fa-solid fa-lock input-icon"></i>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="reg-password"
                        placeholder="Min. 8 characters"
                        value={regPassword}
                        onChange={(e) => handleInputChange('regPassword', e.target.value, setRegPassword)}
                        required
                      />
                      <button
                        type="button"
                        className="toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Toggle Password Visibility"
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                      </button>
                    </div>
                    <span className="error-msg">{errors.regPassword}</span>
                  </div>

                  <button type="submit" className="submit-btn slanted-green-btn">
                    <span className="btn-inner">SIGN UP</span>
                    <div className="btn-glow"></div>
                  </button>
                </form>

                <div className="bottom-action-buttons single-btn">
                  <button type="button" className="slanted-action-btn login-btn" onClick={() => switchTab('login')}>
                    <span className="btn-inner">LOGIN</span>
                  </button>
                </div>
              </section>
            )}

            {/* ==========================================
                 3) FORGOT PASSWORD PANEL
                 ========================================== */}
            {activeTab === 'forgot' && (
              <section className="auth-panel active" aria-labelledby="forgot-header">
                <h3 className="panel-heading" id="forgot-header">Reset Password</h3>
                <p className="panel-description">
                  Enter your registered email below, and we will send you an OTP (One-Time Password) to reset your account.
                </p>

                <form onSubmit={handleForgotSubmit} noValidate>
                  <div className="input-group">
                    <label htmlFor="forgot-email">Email Address</label>
                    <div className="input-wrapper">
                      <i className="fa-solid fa-envelope input-icon"></i>
                      <input
                        type="email"
                        id="forgot-email"
                        placeholder="example@email.com"
                        value={forgotEmail}
                        onChange={(e) => handleInputChange('forgotEmail', e.target.value, setForgotEmail)}
                        required
                      />
                    </div>
                    <span className="error-msg">{errors.forgotEmail}</span>
                  </div>

                  <button type="submit" className="submit-btn slanted-green-btn">
                    <span className="btn-inner">SEND OTP</span>
                    <div className="btn-glow"></div>
                  </button>
                </form>

                <div className="bottom-action-buttons">
                  <button type="button" className="slanted-action-btn login-btn" onClick={() => switchTab('login')}>
                    <span className="btn-inner">LOGIN</span>
                  </button>
                  <button type="button" className="slanted-action-btn register-btn" onClick={() => switchTab('register')}>
                    <span className="btn-inner">REGISTER</span>
                  </button>
                </div>
              </section>
            )}

            {/* ==========================================
                 4) OTP VERIFICATION PANEL
                 ========================================== */}
            {activeTab === 'otp' && (
              <section className="auth-panel active" aria-labelledby="otp-header">
                <h3 className="panel-heading" id="otp-header">Verify your email</h3>
                <p className="panel-description">
                  We have sent a verification code to your email. Please enter the OTP below.
                </p>
                
                <p className="messenger-warning otp-warning">
                  <i className="fa-solid fa-envelope-open-text"></i> OTP email may be delayed. If you don't receive it, please contact customer support.
                </p>

                <form onSubmit={handleOtpVerify} noValidate>
                  <div className="otp-inputs-container">
                    {otpValues.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={otpRefs[idx]}
                        type="text"
                        maxLength={1}
                        className="otp-box"
                        aria-label={`OTP Digit ${idx + 1}`}
                        value={digit}
                        onChange={(e) => handleOtpInput(e.target.value, idx)}
                        onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                        required
                        pattern="[0-9]"
                        inputMode="numeric"
                      />
                    ))}
                  </div>
                  <span className="error-msg text-center">{errors.otp}</span>

                  <button type="submit" className="submit-btn slanted-green-btn" id="otp-submit-btn">
                    <span className="btn-inner">VERIFY</span>
                    <div className="btn-glow"></div>
                  </button>
                </form>

                <div className="otp-timer-container">
                  <p>
                    Didn't receive code?{' '}
                    <button
                      type="button"
                      className="resend-btn"
                      onClick={handleResendOtp}
                      disabled={resendDisabled}
                    >
                      Resend OTP
                    </button>{' '}
                    {resendDisabled && <span className="countdown-timer">({countdown}s)</span>}
                  </p>
                </div>

                <div className="bottom-action-buttons single-btn">
                  <button type="button" className="slanted-action-btn login-btn" onClick={() => switchTab('login')}>
                    <span className="btn-inner">LOGIN</span>
                  </button>
                </div>
              </section>
            )}
          </div>
        </article>

        {/* Floating Support Button FAB */}
        {onOpenSupport && (
          <button type="button" className="support-fab" onClick={onOpenSupport}>
            <i className="fa-solid fa-comment-dots"></i>
            <span>Support</span>
          </button>
        )}
      </div>
    </div>
  );
}
