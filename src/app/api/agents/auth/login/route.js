import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/mongodb';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 });
    }

    const db = await getDb();
    const agentsCollection = db.collection('agents');

    const agent = await agentsCollection.findOne({ email: email.toLowerCase().trim() });
    if (!agent) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 });
    }

    if (agent.password !== password.trim()) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      message: 'Agent authenticated successfully!',
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        agentCode: agent.agentCode,
        commissionRate: agent.commissionRate || 0,
        accountType: agent.accountType || (agent.agentCode?.startsWith('SUB') ? 'sub-distributor' : 'agent'),
        role: agent.role || (agent.agentCode?.startsWith('SUB') ? 'Sub-Distributor' : 'Agent'),
        status: agent.status || 'ACTIVE',
        parentAgentCode: agent.parentAgentCode || ''
      }
    });
  } catch (err) {
    console.error('Agent Login API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
