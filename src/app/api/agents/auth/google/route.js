import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';
import { cache } from '../../../../../lib/cache';

export async function POST(req) {
  try {
    const { email, name, agentCode } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ success: false, message: 'Google email and name are required.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = await getDb();
    const agentsCollection = db.collection('agents');

    const existing = await agentsCollection.findOne({ email: normalizedEmail });

    if (existing) {
      return NextResponse.json({
        success: true,
        isNewUser: false,
        agent: {
          id: existing.id,
          name: existing.name,
          email: existing.email,
          agentCode: existing.agentCode,
          commissionRate: existing.commissionRate || 0,
          accountType: existing.accountType || (existing.agentCode?.startsWith('SUB') ? 'sub-distributor' : 'agent'),
          role: existing.role || (existing.agentCode?.startsWith('SUB') ? 'Sub-Distributor' : 'Agent'),
          status: existing.status || 'ACTIVE',
          parentAgentCode: existing.parentAgentCode || ''
        }
      });
    }

    let finalCode = agentCode ? agentCode.trim().toUpperCase() : '';
    if (!finalCode) {
      finalCode = 'SUB' + Math.floor(100000 + Math.random() * 900000).toString();
    }

    const codeDup = await agentsCollection.findOne({ agentCode: finalCode });
    if (codeDup) {
      return NextResponse.json({ success: false, message: 'This affiliate code is already taken.' }, { status: 400 });
    }

    const newAgent = {
      id: 'agent_' + Math.random().toString(36).substring(2, 7),
      name: name.trim(),
      email: normalizedEmail,
      password: 'google_' + Math.random().toString(36).substring(2, 12),
      agentCode: finalCode,
      accountType: 'sub-distributor',
      role: 'Sub-Distributor',
      status: 'ACTIVE',
      commissionRate: 10,
      authProvider: 'google',
      parentAgentCode: '',
      createdAt: new Date().toISOString()
    };

    await agentsCollection.insertOne(newAgent);
    cache.del('admin_stats');

    return NextResponse.json({
      success: true,
      isNewUser: true,
      agent: {
        id: newAgent.id,
        name: newAgent.name,
        email: newAgent.email,
        agentCode: newAgent.agentCode,
        commissionRate: newAgent.commissionRate,
        accountType: newAgent.accountType,
        role: newAgent.role,
        status: newAgent.status,
        parentAgentCode: newAgent.parentAgentCode
      }
    });
  } catch (err) {
    console.error('Agent Google Auth API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
