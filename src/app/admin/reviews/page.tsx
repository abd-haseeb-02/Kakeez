"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import {
  Loader2, Star, CheckCircle, XCircle, Clock,
  ExternalLink, BadgeCheck, MessageSquare,
} from "lucide-react"

interface ReviewRow {
  id: string
  product_id: string
  product_name: string
  product_slug: string
  user_id: string | null
  user_email: string | null
  user_full_name: string | null
  order_id: string | null
  rating: number
  title: string | null
  body: string | null
  verified_purchase: boolean
  status: 'pending' | 'published' | 'rejected'
  created_at: string
}

const FILTERS: { label: string; value: string | null; icon: typeof Clock }[] = [
  { label: 'Pending',   value: 'pending',   icon: Clock },
  { label: 'Published', value: 'published', icon: CheckCircle },
  { label: 'Rejected',  value: 'rejected',  icon: XCircle },
  { label: 'All',       value: null,        icon: MessageSquare },
]

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-white/15'}
        />
      ))}
    </div>
  )
}

export default function ReviewsModeration() {
  const [filter, setFilter] = useState<string | null>('pending')
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string>("")
  const [counts, setCounts] = useState({ pending: 0, published: 0, rejected: 0 })
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_reviews', { p_status: filter })
    if (error) {
      toast.push({ kind: 'warn', title: 'Could not load reviews', body: error.message })
      setReviews([])
    } else {
      setReviews((data as ReviewRow[]) ?? [])
    }
    // Pull header counts in a second call (small price for cleaner UX).
    const { data: allData } = await supabase.rpc('admin_list_reviews', { p_status: null })
    const all = (allData as ReviewRow[]) ?? []
    setCounts({
      pending:   all.filter((r) => r.status === 'pending').length,
      published: all.filter((r) => r.status === 'published').length,
      rejected:  all.filter((r) => r.status === 'rejected').length,
    })
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter])

  const moderate = async (id: string, next: 'published' | 'rejected' | 'pending') => {
    setBusyId(id)
    const { error } = await supabase.rpc('moderate_product_review', {
      p_review_id: id, p_status: next,
    })
    setBusyId("")
    if (error) {
      toast.push({ kind: 'warn', title: 'Could not update review', body: error.message })
      return
    }
    toast.push({
      kind: next === 'published' ? 'success' : next === 'rejected' ? 'warn' : 'info',
      title: `Review ${next}`,
    })
    await load()
  }

  return (
    <div className="admin-modern space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <p className="admin-pill mb-3 inline-flex rounded-full px-3 py-1 ff-apfel text-[11px] uppercase tracking-[0.16em]">Trust signals</p>
          <h1 className="text-3xl font-bold ff-accia text-primary-brown">Reviews</h1>
          <p className="text-white/50 ff-apfel mt-1">
            {counts.pending} pending · {counts.published} published · {counts.rejected} rejected
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ label, value, icon: Icon }) => {
          const isActive = filter === value
          const c = value === null ? counts.pending + counts.published + counts.rejected
            : counts[value as 'pending' | 'published' | 'rejected']
          return (
            <button
              key={label}
              onClick={() => setFilter(value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full ff-apfel text-sm transition-all border ${
                isActive
                  ? 'bg-primary-brown text-white border-primary-brown'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 border-white/10'
              }`}
            >
              <Icon size={14} />
              {label}
              <span className={`ff-apfel text-[10px] px-1.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-white/10'}`}>{c}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-brown" size={32} /></div>
      ) : reviews.length === 0 ? (
        <div className="admin-card rounded-2xl p-10 text-center">
          <MessageSquare size={28} className="mx-auto text-white/30 mb-3" />
          <p className="ff-accia text-white">No reviews in this bucket</p>
          <p className="ff-apfel text-sm text-white/40 mt-1">
            {filter === 'pending'
              ? 'You\'re all caught up — nothing waiting for moderation.'
              : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="admin-card rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Stars rating={r.rating} />
                    {r.verified_purchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded">
                        <BadgeCheck size={11} /> Verified purchase
                      </span>
                    )}
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ${
                      r.status === 'pending'   ? 'bg-amber-500/15 text-amber-300' :
                      r.status === 'published' ? 'bg-emerald-500/15 text-emerald-300' :
                                                 'bg-red-500/15 text-red-300'
                    }`}>{r.status}</span>
                  </div>
                  {r.title && <p className="ff-accia text-white text-lg mt-2">{r.title}</p>}
                  {r.body && <p className="ff-apfel text-sm text-white/70 mt-1 leading-relaxed whitespace-pre-wrap">{r.body}</p>}
                  <div className="ff-apfel text-xs text-white/40 mt-3 space-y-0.5">
                    <p>
                      <span className="text-white/30">For:</span>{' '}
                      <Link href={`/product/${r.product_slug}`} target="_blank" className="text-primary-brown hover:underline inline-flex items-center gap-1">
                        {r.product_name} <ExternalLink size={10} />
                      </Link>
                    </p>
                    <p>
                      <span className="text-white/30">By:</span>{' '}
                      {r.user_full_name ?? r.user_email ?? <span className="italic">deleted user</span>}
                      {r.user_email && <span className="text-white/30"> · {r.user_email}</span>}
                    </p>
                    <p><span className="text-white/30">When:</span> {new Date(r.created_at).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {r.status !== 'published' && (
                    <button
                      onClick={() => moderate(r.id, 'published')}
                      disabled={busyId === r.id}
                      className="px-4 py-2 rounded-lg ff-apfel text-xs flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all disabled:opacity-50"
                    >
                      <CheckCircle size={12} /> Publish
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      onClick={() => moderate(r.id, 'rejected')}
                      disabled={busyId === r.id}
                      className="px-4 py-2 rounded-lg ff-apfel text-xs flex items-center gap-1.5 bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/30 transition-all disabled:opacity-50"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  )}
                  {r.status !== 'pending' && (
                    <button
                      onClick={() => moderate(r.id, 'pending')}
                      disabled={busyId === r.id}
                      className="px-4 py-2 rounded-lg ff-apfel text-xs flex items-center gap-1.5 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 transition-all disabled:opacity-50"
                    >
                      <Clock size={12} /> Re-queue
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
