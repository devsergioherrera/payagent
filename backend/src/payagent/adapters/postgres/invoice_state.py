"""The single definition of an invoice's visible state, as SQL.

Every query that shows or filters an invoice uses these expressions; nothing else derives a state.
Expects the aliases `i` (invoice), `d` (decision) and `a` (approval).
"""

INVOICE_STATE_SQL = """case
    when i.status = 'FAILED' then 'FAILED'
    when d.id is null then 'PROCESSING'
    when a.verdict = 'APPROVED' then 'APPROVED'
    when a.verdict = 'REJECTED' then 'REJECTED'
    when d.outcome = 'PAY' then 'PAID'
    when d.outcome = 'HOLD' then 'HELD'
    else 'WAITING'
  end"""
