// Shapes returned by the FastAPI backend (see call_logs.py / bookings_store.py).

export interface Call {
  id: string;
  call_id: string;
  created_at: string | null;
  updated_at: string | null;
  transcript: string | null;
  summary: string | null;
  caller_name: string | null;
  caller_phone: string | null;
  intent: string | null;
  is_booking: boolean;
  booking_details: string | null;
  status: string; // 'unresolved' | 'resolved'
  from_number: string | null;
  to_number: string | null;
  direction: string | null;
  duration_sec: number | null;
  language: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface Booking {
  id: string;
  call_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  service: string | null;
  start_ts: string | null;
  end_ts: string | null;
  notes: string | null;
  calendar_event_id: string | null;
  status: string; // 'booked' | 'cancelled' | 'completed' | 'no_show'
  created_at: string | null;
}

export interface Org {
  org_id: string;
  name: string;
  role: string;
}

export interface Session {
  token: string | null;
  org: string | null;
  orgName: string | null;
}
