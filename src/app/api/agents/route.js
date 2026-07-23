import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { enrichAgentsWithStats } from '../../../lib/entityStats';
import { jsonOk } from '../../../lib/apiResponse';
import { purgeAccountAccess } from '../../../lib/sessionRevoke';

// GET all agents with dynamic statistics
export async function GET() {
  try {
    const cached = cache.get('agents_enriched');
    if (cached) {
      return jsonOk({ success: true, agents: cached }, { cacheSeconds: 45 });
    }

    const db = await getDb();
    const agents = await db.collection('agents').find({}, {
      projection: { password: 0 }
    }).toArray();

    const enrichedAgents = await enrichAgentsWithStats(db, agents);
    cache.set('agents_enriched', enrichedAgents, 45);

    return jsonOk({ success: true, agents: enrichedAgents }, { cacheSeconds: 45 });
  } catch (err) {
    console.error('GET Agents API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST create a new agent
export async function POST(req) {
  try {
    const { name, email, password, commissionRate, agentCode, parentAgentCode, accountType, status } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, message: 'Name, email, and password are required.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, message: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const db = await getDb();
    const agentsCollection = db.collection('agents');

    const existing = await agentsCollection.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json({ success: false, message: 'An agent with this email is already registered.' }, { status: 400 });
    }

    const normalizedType = (accountType || 'agent').toLowerCase();
    const isSubDistributor = normalizedType === 'sub-distributor' || normalizedType === 'sub_distributor';

    let finalCode = agentCode ? agentCode.trim().toUpperCase() : '';
    if (!finalCode) {
      const prefix = isSubDistributor ? 'SUB' : 'AGT';
      finalCode = prefix + Math.floor(100000 + Math.random() * 900000).toString();
    }

    const codeDup = await agentsCollection.findOne({ agentCode: finalCode });
    if (codeDup) {
      return NextResponse.json({ success: false, message: 'This affiliate code is already taken.' }, { status: 400 });
    }

    const defaultCommission = isSubDistributor ? parseFloat(commissionRate || 0) : 0;

    const newAgent = {
      id: 'agent_' + Math.random().toString(36).substring(2, 7),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      agentCode: finalCode,
      accountType: isSubDistributor ? 'sub-distributor' : 'agent',
      role: isSubDistributor ? 'Sub-Distributor' : 'Agent',
      status: (status || 'ACTIVE').toUpperCase(),
      commissionRate: defaultCommission,
      parentAgentCode: parentAgentCode ? parentAgentCode.trim().toUpperCase() : '',
      createdAt: new Date().toISOString()
    };

    await agentsCollection.insertOne(newAgent);
    cache.del('admin_stats');
    cache.del('agents_enriched');

    return NextResponse.json({ success: true, agent: newAgent, message: 'Team account created successfully!' });
  } catch (err) {
    console.error('POST Create Agent API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT edit agent details
export async function PUT(req) {
  try {
    const { id, name, email, password, commissionRate, agentCode, status, accountType } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'Agent ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const agentsCollection = db.collection('agents');

    const updateFields = {};
    if (name !== undefined) updateFields.name = name.trim();
    if (email !== undefined) updateFields.email = email.toLowerCase().trim();
    if (password !== undefined && password.trim() !== '') updateFields.password = password.trim();
    if (commissionRate !== undefined) updateFields.commissionRate = parseFloat(commissionRate || 0);
    if (status !== undefined) updateFields.status = (status || 'ACTIVE').toUpperCase();
    if (accountType !== undefined) {
      const isSub = accountType === 'sub-distributor';
      updateFields.accountType = isSub ? 'sub-distributor' : 'agent';
      updateFields.role = isSub ? 'Sub-Distributor' : 'Agent';
    }

    if (agentCode !== undefined && agentCode.trim() !== '') {
      const finalCode = agentCode.trim().toUpperCase();
      const codeDup = await agentsCollection.findOne({ agentCode: finalCode, id: { $ne: id } });
      if (codeDup) {
        return NextResponse.json({ success: false, message: 'This affiliate code is already taken by another agent.' }, { status: 400 });
      }
      updateFields.agentCode = finalCode;
    }

    await agentsCollection.updateOne({ id }, { $set: updateFields });
    cache.del('admin_stats');
    cache.del('agents_enriched');

    return NextResponse.json({ success: true, message: 'Agent details updated successfully!' });
  } catch (err) {
    console.error('PUT Update Agent API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// DELETE delete agent
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'Agent ID is required.' }, { status: 400 });
    }

    const db = await getDb();
    const agentDoc = await db.collection('agents').findOne({ id });
    await db.collection('agents').deleteOne({ id });
    if (agentDoc?.email) {
      await purgeAccountAccess(db, agentDoc.email, agentDoc);
    }
    cache.del('admin_stats');
    cache.del('agents_enriched');

    return NextResponse.json({ success: true, message: 'Agent successfully deleted.' });
  } catch (err) {
    console.error('DELETE Agent API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
