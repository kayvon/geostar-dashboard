# A simple dashboard for home heating data: Temps, set temps, energy consumption, ground source heat pump loop temp, etc

## For now, this is only data from Waterfurnace/Geostar Symphony

### Why?

I don't like the symphony app's flow:

  - Select Energy Use (the lightning bolt icon in the mobile app)
  - Select the one of two heat pumps in my house
  - Select View Graph
  - Turn the phone sideways to portrait mode; barely be able to see anything
  - Tap the date range, which does not look like it's necessarily an interactive element
  - Select:
    - Frequency (daily or hourly or 15-min)
    - Tap start date, and select on the datepicker
    - Still on the datepicker (I like this, single datepicker for the range) and select end date
      - This only allows up to yesterday, no time availabe today can be viewed
  - Hit apply
  - Scroll down a bit to interact with the graph
  - Temp is on a separate graph
  - No main zone temp in my case because there's no thermostat in my specific installation
  - It does show the entering loop temp but I can't tap to see precise temp, only look at the y-axis and estimate

If I want to see data for the other heat pump? Repeat the above, and I can't view the graphs together 

### Who is this for?

Me, and it might be useful to others.

#### My setup / Why this is useful to me

I have two Geostar Aston heat pumps, 3-ton and 4-ton. These heat a reservoir which feeds 11 fan coils, each with its own thermostat. I want to consolidate all the data: Each heat pump's energy consumption, the incoming loop temp, ideally the reservoir temp, the set temp + actual temp at each fan coil, the outside air temp. And I want to be able to interact more smoothly with the data.

### What's built?

So far, I have the Geostar heat pumps' energy consumption on a single graph. The graph can be viewed up to the most recent 15-min. The date range can be updated with the mouse scroll wheel or dragging and highliting a range. The graph displays each of the two heat pumps, plus the total, and a summary is displayed including the total energy consumption. Can filter by each heat pump.

### What's the roadmap

  - Do the rest
  - Keep making small improvements to the UI interactions

### Architecture

I'm running on cloudflare. My account login info is provided as secrets. 

D1 db tables:
  - auth sessions
  - data, 15-min resolution with energy consumption of each geo unit

The data is pulled from the geostar API, the shape of which was determined by inspecting the symphony web app. Once logged in, there's a session id, there's a user info which includes a unique ids of each heat pump. We can fetch data for a date range up to something like 30 or 45 days.

There are two workers:

  - The data ingestion worker, runs as cron job every 15-min to update the db; this also has a backfill command, and can be set to override or not if bad or incomplete data is suspected (it happens)
  - The web app served by hono with a basic template engine

> There's a simple backfill bash script to page the backfill requests
