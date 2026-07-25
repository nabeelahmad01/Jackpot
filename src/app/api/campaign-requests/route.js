import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';
import { notifyStaffAsync } from '../../../lib/pushNotifications';

async function getAdBudgetLimit(db) {
  const settings = await db.collection('settings').findOne({ id: 'global_settings' });
  return Number(settings?.adBudgetLimit) > 0 ? Number(settings.adBudgetLimit) : 6000;
}

// GET campaign requests
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const agentEmail = searchParams.get('agentEmail');

    const db = await getDb();
    const campaignsCollection = db.collection('campaignRequests');

    let query = {};
    if (agentEmail) {
      query.agentEmail = agentEmail.toLowerCase().trim();
    }

    // Single campaign with full proof (inspect modal)
    const campaignId = searchParams.get('id');
    if (campaignId) {
      const one = await campaignsCollection.findOne({ id: String(campaignId) });
      if (!one) {
        return NextResponse.json({ success: false, message: 'Campaign not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, campaign: one });
    }

    // List: never ship base64 paymentProof (inspect loads via ?id=)
    const campaigns = await campaignsCollection
      .find(query)
      .project({ paymentProof: 0 })
      .sort({ createdAt: -1 })
      .toArray();

    const lean = campaigns.map((c) => ({
      ...c,
      // Keep truthy paymentProof so existing UI "Inspect" buttons still render;
      // actual image is fetched on click via ?id=
      paymentProof: c.hasPaymentProof === false ? '' : '1',
      hasPaymentProof: c.hasPaymentProof !== false
    }));

    // If querying for a specific agent, calculate their remaining budget limit
    const budgetCap = await getAdBudgetLimit(db);
    let remainingLimit = budgetCap;
    if (agentEmail) {
      const activeCampaigns = lean.filter(c => c.status !== 'REJECTED');
      const totalSpent = activeCampaigns.reduce((sum, c) => sum + parseFloat(c.budget || 0), 0);
      remainingLimit = Math.max(0, budgetCap - totalSpent);
    }

    return NextResponse.json({
      success: true,
      campaigns: lean,
      remainingLimit
    });
  } catch (err) {
    console.error('Fetch Campaigns API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// POST create a campaign request
export async function POST(req) {
  try {
    const {
      agentEmail,
      agentCode,
      budget,
      campaignName,
      facebookPageLink,
      startDate,
      endDate,
      notes,
      paymentProof
    } = await req.json();

    if (!agentEmail || !agentCode || !budget || !campaignName || !facebookPageLink || !startDate || !endDate) {
      return NextResponse.json({ success: false, message: 'All fields (budget, campaign name, facebook link, dates) are required.' }, { status: 400 });
    }

    const db = await getDb();
    const campaignsCollection = db.collection('campaignRequests');

    // Double check agent limit
    const cleanEmail = agentEmail.toLowerCase().trim();
    const budgetCap = await getAdBudgetLimit(db);
    const agentCampaigns = await campaignsCollection.find({ agentEmail: cleanEmail }).toArray();
    const totalSpent = agentCampaigns.filter(c => c.status !== 'REJECTED').reduce((sum, c) => sum + parseFloat(c.budget || 0), 0);
    const remainingLimit = Math.max(0, budgetCap - totalSpent);

    const budgetVal = parseFloat(budget);
    if (budgetVal > remainingLimit) {
      return NextResponse.json({ success: false, message: `Budget exceeds your remaining limit of $${remainingLimit.toFixed(2)}` }, { status: 400 });
    }

    const newRequest = {
      id: Date.now().toString() + Math.floor(Math.random() * 100).toString(),
      agentEmail: cleanEmail,
      agentCode: agentCode.toUpperCase().trim(),
      budget: budgetVal,
      campaignName: campaignName.trim(),
      facebookPageLink: facebookPageLink.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      notes: (notes || '').trim(),
      paymentProof: paymentProof || '', // Base64 screenshot proof
      hasPaymentProof: Boolean(paymentProof && String(paymentProof).trim()),
      status: 'PENDING',
      trackingLink: '',
      createdAt: new Date().toISOString()
    };

    await campaignsCollection.insertOne(newRequest);
    cache.del('admin_stats');

    notifyStaffAsync(db, {
      title: 'New Campaign Request',
      body: `${cleanEmail} · $${budgetVal.toFixed(2)} · ${campaignName.trim()}`,
      url: '/admin',
      tag: `campaign-${newRequest.id}`,
      alertKind: 'campaign'
    });

    return NextResponse.json({
      success: true,
      campaign: newRequest,
      message: 'Campaign request submitted successfully!'
    });
  } catch (err) {
    console.error('Submit Campaign API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}

// PUT approve/reject campaign request
export async function PUT(req) {
  try {
    const { id, status, trackingLink } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ success: false, message: 'ID and status are required.' }, { status: 400 });
    }

    const db = await getDb();
    const campaignsCollection = db.collection('campaignRequests');

    const matched = await campaignsCollection.findOne({ id });
    if (!matched) {
      return NextResponse.json({ success: false, message: 'Campaign request not found.' }, { status: 404 });
    }

    const updateFields = { status };
    if (status === 'APPROVED') {
      updateFields.trackingLink = trackingLink || `https://jackpotentry.com/?agent=${matched.agentCode}&campaign=${encodeURIComponent(matched.campaignName)}`;
    }

    await campaignsCollection.updateOne(
      { id },
      { $set: updateFields }
    );

    cache.del('admin_stats');

    return NextResponse.json({
      success: true,
      message: `Campaign request status updated to ${status}!`
    });
  } catch (err) {
    console.error('Update Campaign API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
