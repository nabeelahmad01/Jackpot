'use client';

import React from 'react';
import AdminPage from '../admin/page';

export default function BossPortal() {
  return <AdminPage portalName="Super Boss Panel" forcedRole="admin" />;
}
