'use client';

import React from 'react';
import AdminPage from '../admin/page';

export default function FinancePortal() {
  return <AdminPage portalName="Financial Manager Portal" forcedRole="financial_admin" />;
}
