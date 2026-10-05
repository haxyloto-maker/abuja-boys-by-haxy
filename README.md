# Abuja Boys by Haxy — v0.3 3D Multiplayer

## Added
- Playable 3D city rendered with Three.js in the browser
- WASD / arrow-key movement
- Real player avatars with username labels
- Real-time player movement through WebSockets
- Abuja-style roads, buildings, trees, plaza and cars
- Login/register and persistent account system
- ₦1,000,000 starting virtual cash
- Server-controlled jobs
- Real-time global chat
- Abuja real-world clock (`Africa/Lagos`)
- Day/night lighting/fog
- Travel locations

## Run
1. Install Node.js 20+
2. `npm install`
3. Set `JWT_SECRET` to a long random secret
4. `npm start`
5. Open `http://localhost:3000`

The Three.js client loads from jsDelivr, so an internet connection is required for the 3D engine.

## Important
This is a strong playable foundation, not yet a commercial-scale MMO. Before public launch, add a managed production database, HTTPS/WSS, rate limits, email verification, moderation/reporting, server-authoritative collision/gameplay, persistence for inventory/properties/cars, and production-grade 3D art/audio.

## New in this update
- Interactive Abuja Map overlay with district travel pins
- Share Game button with copy-link and native share support
- Invite URL uses `?join=abuja-boys` so shared links open the game landing page
- Added Area 1 and Airport as travel locations
