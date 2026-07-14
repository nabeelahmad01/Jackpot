import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { cache } from '../../../lib/cache';

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

    const campaigns = await campaignsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // If querying for a specific agent, calculate their remaining budget limit
    let remainingLimit = 6000.0;
    if (agentEmail) {
      const activeCampaigns = campaigns.filter(c => c.status !== 'REJECTED');
      const totalSpent = activeCampaigns.reduce((sum, c) => sum + parseFloat(c.budget || 0), 0);
      remainingLimit = Math.max(0, 6000.0 - totalSpent);
    }

    return NextResponse.json({
      success: true,
      campaigns,
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
    const agentCampaigns = await campaignsCollection.find({ agentEmail: cleanEmail }).toArray();
    const totalSpent = agentCampaigns.filter(c => c.status !== 'REJECTED').reduce((sum, c) => sum + parseFloat(c.budget || 0), 0);
    const remainingLimit = Math.max(0, 6000.0 - totalSpent);

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
      status: 'PENDING',
      trackingLink: '',
      createdAt: new Date().toISOString()
    };

    await campaignsCollection.insertOne(newRequest);

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

    return NextResponse.json({
      success: true,
      message: `Campaign request status updated to ${status}!`
    });
  } catch (err) {
    console.error('Update Campaign API Error:', err);
    return NextResponse.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 });
  }
}
