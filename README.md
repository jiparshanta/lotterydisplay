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

Two images are saved for every current Texas Lottery scratch-off game (78 games):

- **Display card** (the default): the official square card with the price, game number and name, in `tickets/cards/{game}.gif`.
- **Full ticket:** the whole front of the ticket, in `tickets/{game}.gif`.

To switch between them, use **Display settings → Image style** in the control panel. `games.json` lists each game's name, price and top prize. Prices fill in automatically on the display. You can still type a price yourself to override it.

For full tickets, images for each game number are tried in this order. Display cards work the same way using `tickets/cards/` and the live `{game}_200X200.gif` image:

1. An image uploaded in the control panel (stored in the browser).
2. `tickets/{game}.gif`, `.jpg` or `.png` in this repo.
3. The live Texas Lottery image at `https://www.texaslottery.com/export/sites/lottery/Images/scratchoffs/{game}_img1.gif`. This covers games released after the last update.

You can change this order under **Display settings → Image sources**.

### Updating for new games

```bash
python3 tools/update_tickets.py   # add --force to re-download every image
git add tickets games.json && git commit -m "Update tickets" && git push
```

The script reads the [all scratch-offs list](https://www.texaslottery.com/export/sites/lottery/Games/Scratch_Offs/all.html), saves any missing ticket images and rewrites `games.json`.

## Default layout

`layout.js` holds the default slot assignments, as `window.TXSO_DEFAULT_LAYOUT`. Each entry is either a game number or a `{"game", "price", "soldOut"}` object, and its position in the list is the slot number:

```json
{ "slots": ["2764", "2780", "2430"] }
```

A browser that has never saved any slots, or has only empty ones, starts from this layout, so a new computer or a cleared browser shows the right tickets straight away. To go back to it after making changes, click **Reset to default layout** in the control panel's Bulk entry section.
