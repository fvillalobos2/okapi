import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!

export async function GET(req: NextRequest) {
  // Verify admin via bearer token
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all restaurants
  const { data: restaurants } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, plan, subscription_status, trial_ends_at, created_at, subscription_ends_at')
    .order('created_at', { ascending: false })

  if (!restaurants) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  // Status breakdown
  const byStatus = {
    active: restaurants.filter(r => r.subscription_status === 'active').length,
    trial: restaurants.filter(r => r.subscription_status === 'trial').length,
    expired: restaurants.filter(r => r.subscription_status === 'expired').length,
    canceled: restaurants.filter(r => r.subscription_status === 'canceled').length,
  }

  // Revenue estimate (active subscriptions)
  const PLAN_PRICES: Record<string, number> = { starter: 29, pro: 59, business: 129 }
  const monthlyRevenue = restaurants
    .filter(r => r.subscription_status === 'active' && r.plan)
    .reduce((sum, r) => sum + (PLAN_PRICES[r.plan] ?? 0), 0)

  // Plan distribution (active only)
  const byPlan = {
    starter: restaurants.filter(r => r.subscription_status === 'active' && r.plan === 'starter').length,
    pro: restaurants.filter(r => r.subscription_status === 'active' && r.plan === 'pro').length,
    business: restaurants.filter(r => r.subscription_status === 'active' && r.plan === 'business').length,
  }

  // Recent signups (this month)
  const newThisMonth = restaurants.filter(r => new Date(r.created_at) >= startOfMonth).length

  // Churn this month (canceled this month)
  const { data: canceledThisMonth } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('subscription_status', 'canceled')
    .gte('updated_at', startOfMonth.toISOString())

  const churnThisMonth = canceledThisMonth?.length ?? 0

  // Total scans
  const { count: totalScans } = await supabaseAdmin
    .from('scans')
    .select('*', { count: 'exact', head: true })

  // Scans this month
  const { count: scansThisMonth } = await supabaseAdmin
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString())

  // Impressions
  const { count: totalImpressions } = await supabaseAdmin
    .from('impressions')
    .select('*', { count: 'exact', head: true })

  const { count: impressionsThisMonth } = await supabaseAdmin
    .from('impressions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfMonth.toISOString())

  // Restaurants with at least 1 scan (active product usage)
  const { data: restaurantsWithScans } = await supabaseAdmin
    .from('scans')
    .select('restaurant_id')
    .gte('created_at', startOfMonth.toISOString())
  const activeRestaurants = new Set(restaurantsWithScans?.map(s => s.restaurant_id) ?? []).size

  // Retention activation rate (active plan restaurants with retention_active = true)
  const { data: retentionActive } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('retention_active', true)
    .eq('subscription_status', 'active')
  const retentionRate = byStatus.active > 0
    ? Math.round(((retentionActive?.length ?? 0) / byStatus.active) * 100)
    : 0

  // QR usage (restaurants with at least 1 staff member)
  const { data: restaurantsWithStaff } = await supabaseAdmin
    .from('staff_members')
    .select('restaurant_id')
    .is('deleted_at', null)
  const qrUsage = new Set(restaurantsWithStaff?.map(s => s.restaurant_id) ?? []).size

  // Avg scans per active restaurant this month
  const avgScansPerRestaurant = activeRestaurants > 0
    ? Math.round((scansThisMonth ?? 0) / activeRestaurants)
    : 0

  // Conversion rate this month (scans / impressions)
  const conversionRate = (impressionsThisMonth ?? 0) > 0
    ? Math.round(((scansThisMonth ?? 0) / (impressionsThisMonth ?? 0)) * 100)
    : null

  // Recent 10 restaurants
  const recent = restaurants.slice(0, 10).map(r => ({
    id: r.id,
    name: r.name,
    plan: r.plan,
    status: r.subscription_status,
    created_at: r.created_at,
  }))

  return NextResponse.json({
    total: restaurants.length,
    byStatus,
    byPlan,
    monthlyRevenue,
    newThisMonth,
    churnThisMonth,
    totalScans: totalScans ?? 0,
    scansThisMonth: scansThisMonth ?? 0,
    totalImpressions: totalImpressions ?? 0,
    impressionsThisMonth: impressionsThisMonth ?? 0,
    conversionRate,
    activeRestaurants,
    retentionRate,
    qrUsage,
    avgScansPerRestaurant,
    recent,
  })
}
