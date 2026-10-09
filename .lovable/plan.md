# Pink Wheels: Google Maps ride booking (Pakistan)

## What exists today
- Booking page uses a drawn map and a made-up distance from the address text. Fares come from hardcoded per-vehicle numbers.
- Admin assigns drivers by hand. Drivers have an online switch but no location is saved.
- Pink Pool has routes, seat requests, and seat counting in the database. It has no map, no coordinates, and no city-to-city matching by location.
- No Google Maps connection is set up.

## Missing pieces
1. Google Maps connection. This is a paid Google service, so it needs your approval.
2. Database changes for coordinates, live driver location, fare settings, and safe seat booking. These need your approval.
3. A map-based booking screen, live tracking, and Pink Pool on the map.

## Step 1: Google Maps (needs approval, billable)
- Link Google Maps (Managed by Lovable). The map key on the website only shows maps and only works on Lovable domains.
- Address search, place details, routes, distance and travel time all run on our server, and only for signed-in users. Address search waits until typing pauses, results are cached, and each request is size-limited to keep costs down.
- Searches are limited to Pakistan and biased to Lahore, Gujranwala, Islamabad and Rawalpindi.

## Step 2: Database changes (needs approval, additive only, nothing removed)
- **Fare settings** (admin-editable): base fare, price per km, price per minute and minimum fare for each vehicle type. The table starts empty. Until the admin enters real prices, the app shows "Fare not set yet" and does not use invented numbers.
- **Service cities** table with the four cities and their map areas.
- **Ride bookings:** add pickup/drop-off coordinates, place IDs, route distance (km), duration (min) and the encoded route line. Existing rides stay as they are.
- **Driver live location** (new table): latitude, longitude, heading and update time.
  - A driver writes only her own row, and only while she is online and approved.
  - A rider can read it only while that driver is assigned to her active ride.
  - Admins can read all of it.
  - On the map, nearby available drivers appear only as anonymous dots, rounded to about 300 m, with vehicle type. No names, phones or exact positions are shown. This goes through a server function.
- **Location sharing consent:** a per-user setting. Drivers must turn it on before going online.
- **Pink Pool:** add start/destination coordinates, city, and route line to routes. Add pickup/drop-off coordinates to seat requests.
- **Overbooking protection:** a `request_pool_seat` and accept function that locks the route row (`SELECT ... FOR UPDATE`) before checking and reserving seats, so two riders cannot take the last seat at the same time.

## Step 3: Interface (current pink branding, mobile-first)
- **/book becomes a full-screen map** with a bottom sheet:
  - Pickup ("Use my location" asks for GPS permission first) and drop-off fields with suggestions.
  - Draggable pins with reverse address lookup.
  - The route drawn on the map, with km and travel time.
  - Vehicle choice (Car / Scooty / Bike) showing each fare from the admin settings.
  - Confirm button.
- **Live tracking:** after a driver is assigned, the rider sees her moving on the map with the Trip PIN and the safety buttons. Updates arrive instantly from the database.
- **Driver dashboard:** while online, her location is sent every ~10 seconds (with her permission). It shows a map of her current ride.
- **Offer My Route:** pick start and destination on the map, with suggestions, and see the route preview and distance.
- **Pink Pool search:** riders enter pickup and destination and see routes whose line passes near both points, plus seats left and estimated fare. The AI match stays as an extra option.
- **Admin:** a new "Fares" tab for the fare settings, and the drivers' live map.
- The landing page and all other features stay unchanged. Real payments stay off and payment is cash only.

## Technical details
- `src/lib/maps/*.functions.ts`: `requireSupabaseAuth` server functions:
  - autocomplete (Places New, `includedRegionCodes:["pk"]`, session token)
  - placeDetails
  - reverseGeocode
  - computeRoute (Routes API `computeRoutes`, DRIVE / TWO_WHEELER)
  - nearbyDrivers
- These call the gateway with LOVABLE_API_KEY and GOOGLE_MAPS_API_KEY. A separate 403 branch returns a clear key-setup message.
- Browser map: Maps JS loaded with `loading=async`, a callback and the tracking channel. Uses `clickableIcons:false` and no Places library. The map only loads in the browser.
- Fare = max(min_fare, base + per_km·km + per_min·min), rounded to Rs 10, then rechecked on the server when the ride is created.
- Realtime is turned on for the driver location and ride booking tables.
- Google Maps can't be tested inside my sandbox. You'll need to check the map yourself in the preview.

## Your decisions
- Approve linking Google Maps (paid per use; managed accounts have a daily request cap).
- Approve the database changes above.
- After that, you or the admin enter the real fares in the Fares tab.
