import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/mongodb';
import { generateUniqueDepositCode } from '../../../lib/depositCodeGenerator';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const db = await getDb();
    const noteCode = await generateUniqueDepositCode(db);

    return NextResponse.json({
      success: true,
      noteCode
    });
  } catch (err) {
    console.error('API /api/deposit-code error:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to generate deposit code.' },
      { status: 500 }
    );
  }
}
