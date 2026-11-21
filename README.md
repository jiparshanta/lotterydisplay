# Texas Scratch-Off Display

A display for a 74-slot scratch-off ticket case. Enter a game number for a slot and that game's ticket image shows on the display screen. It's plain HTML and JavaScript, with no build step and no server code.

| Page | Purpose |
|---|---|
| `index.html` | The display. Fits 74 ticket slots on any screen size and picks the column and row count that makes the tickets as big as possible. |
| `control.html` | The control panel. Set a game number (and an optional price or "sold out") for each slot, enter many slots at once, upload ticket images, change settings, and back up the layout. |

## Running it

Serve the folder with any static web server, for example:

```bash
python3 -m http.server 8080
```

Then open:

- **Display:** `http://localhost:8080/index.html`. Put it on the display monitor and press **F** for fullscreen. Press **K**, or add `?kiosk` to the URL, to hide the buttons and the mouse cursor.
- **Control:** `http://localhost:8080/control.html`. Open it in another window or tab on the same computer.

The display updates as soon as you save in the control panel. Both pages must use the same browser and the same address.

## Setting tickets

- **Quick set (control panel):** type the slot number, press Tab, type the game number, then press Enter. The slot number moves to the next slot so you can load tickets one after another.
- **On the display:** press **Enter** or click a slot to set it directly.
- **Bulk entry:** paste one game number per line in slot order, or use `slot, game, price` lines.
- Leave the game number blank to clear a slot.

## Ticket images

For each game number, images are tried in this order:

1. An image uploaded in the control panel. The file name must contain the game number, for example `2551.png`. Uploaded images are stored in the browser.
2. `tickets/{game}.jpg`, then `tickets/{game}.png`. Put your own image files in the `tickets/` folder.
3. The Texas Lottery website URL pattern. You can change this, and the order of all sources, under **Display settings → Image sources**.

If no image is found, the slot shows the game number with "no image".

> The default Texas Lottery URL pattern has not been checked against the live site. If those images don't load, use the `tickets/` folder or upload images, or change the pattern in settings.
