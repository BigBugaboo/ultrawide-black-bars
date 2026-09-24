# Ultrawide Black Bars

Remove the side black bars that appear when 16:9 web video plays on a 21:9 or 32:9 screen.

When the player is wider than the picture, switch among four modes:

- **Original**: keep the video’s own aspect ratio
- **Ambient**: fill the bars with a blurred sample of the frame edges
- **Music**: fill the bars from the stereo mix — level bars, raindrops, or a soft color wash
- **Fill**: crop a little from the opposite edges so the picture spans the player

Scroll to zoom inside the player and drag to pan. Mode, zoom, and pan are remembered per site. Preferences stay in local extension storage. The only permission is `storage`.

**Alt+Shift+U** cycles the modes. The toolbar popup switches the mode and its options (ambient blur, or the music look). Settings covers language, the cycle shortcut, and theme. A welcome page opens on first install.

## Sites

The extension runs only on these watch pages:

- Bilibili (video, bangumi, and playlists)
- YouTube watch pages and Shorts
- Twitch VODs (`/videos/<id>`)
- Netflix
- Prime Video
- Disney+
- Max

## Install

1. Open `chrome://extensions` in Chrome or Edge.
2. Turn on Developer mode.
3. Choose “Load unpacked” and select this repository.
4. Open a supported watch page. On an ultrawide display, or whenever the player is wider than the picture, the extension applies the current mode.
