ALTER TYPE public.ride_status ADD VALUE IF NOT EXISTS 'searching';
ALTER TYPE public.ride_status ADD VALUE IF NOT EXISTS 'offered';
ALTER TYPE public.ride_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.ride_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE public.ride_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE public.ride_status ADD VALUE IF NOT EXISTS 'expired';