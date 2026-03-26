-- Add basic location fields for "nearby" deals in the consumer app.

alter table public.restaurants
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists restaurants_lat_lon_idx on public.restaurants(latitude, longitude);

