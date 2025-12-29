import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')

    if (reportId) {
      // Fetch specific report
      const { data: report, error } = await supabase
        .from('ai_categorization_reports')
        .select('*')
        .eq('id', reportId)
        .eq('user_id', user.id)
        .single()

      if (error || !report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }

      return NextResponse.json(report)
    }

    // Fetch all reports (recent first)
    const { data: reports, error } = await supabase
      .from('ai_categorization_reports')
      .select('id, transactions_found, transactions_categorized, transactions_skipped, trigger_type, reviewed, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching AI reports:', error)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Error in AI reports API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Mark report as reviewed
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, reviewed } = body

    if (!id) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('ai_categorization_reports')
      .update({
        reviewed: reviewed ?? true,
        reviewed_at: reviewed ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error updating AI report:', error)
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in AI reports PATCH:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
