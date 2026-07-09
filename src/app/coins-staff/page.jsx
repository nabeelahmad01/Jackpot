'use client';

import React from 'react';
import AdminPage from '../admin/page';

export default function CoinsPortal() {
  return <AdminPage portalName="Coins Admin Portal" forcedRole="coins_admin" />;
}
