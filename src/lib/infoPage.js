/**
 * Build visible contact channels from frontend settings.
 */
export function getInfoChannels(settings = {}) {
  const s = settings || {};
  const channels = [
    {
      id: 'instagram',
      enabled: s.infoInstagramEnabled !== false,
      label: s.infoInstagramLabel || 'Instagram',
      handle: s.infoInstagramHandle || '@jackpotroyals_casino',
      href:
        s.infoInstagramUrl ||
        'https://www.instagram.com/jackpotroyals_casino?igsh=dnZjNmNwdmNzazN6',
      icon: 'fa-brands fa-instagram',
      accent: 'instagram'
    },
    {
      id: 'telegram',
      enabled: s.infoTelegramEnabled !== false,
      label: s.infoTelegramLabel || 'Telegram',
      handle: s.infoTelegramHandle || 't.me/Jackpotroyals_casino',
      href: s.infoTelegramUrl || 'https://t.me/Jackpotroyals_casino',
      icon: 'fa-brands fa-telegram',
      accent: 'telegram'
    },
    {
      id: 'facebook',
      enabled: s.infoFacebookEnabled !== false,
      label: s.infoFacebookLabel || 'Facebook',
      handle: s.infoFacebookHandle || 'Jackpot Royals',
      href: s.infoFacebookUrl || 'https://www.facebook.com/share/1KgG9SdC5N/',
      icon: 'fa-brands fa-facebook',
      accent: 'facebook'
    },
    {
      id: 'whatsapp',
      enabled: s.infoWhatsappEnabled !== false,
      label: s.infoWhatsappLabel || 'WhatsApp',
      handle: s.infoWhatsappHandle || '+1 929 630 8553',
      href: s.infoWhatsappUrl || 'https://wa.me/19296308553',
      icon: 'fa-brands fa-whatsapp',
      accent: 'whatsapp'
    },
    {
      id: 'email',
      enabled: s.infoEmailEnabled !== false,
      label: s.infoEmailLabel || 'Email Support',
      handle: s.infoEmailHandle || 'support@jackpotroyals.com',
      href: s.infoEmailUrl || 'mailto:support@jackpotroyals.com',
      icon: 'fa-solid fa-envelope',
      accent: 'email'
    }
  ];

  return channels.filter((c) => c.enabled && String(c.href || '').trim());
}

export function isInfoPageEnabled(settings = {}) {
  return settings?.infoPageEnabled !== false;
}

export function shouldShowInfoOnAuth(settings = {}) {
  return isInfoPageEnabled(settings) && settings?.infoShowOnAuth !== false;
}

export function shouldShowInfoOnLobby(settings = {}) {
  return isInfoPageEnabled(settings) && settings?.infoShowOnLobby !== false;
}
