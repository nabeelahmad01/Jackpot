'use client';

import React from 'react';
import AdminPage from '../admin/page';

export default function OperationsPortal() {
  return <AdminPage portalName="Operation Manager Panel" forcedRole="operation_admin" />;
}
