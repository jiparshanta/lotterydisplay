#!/usr/bin/env python3
"""Download every current Texas Lottery scratch-off ticket image + game list.

Usage (from the repo root):  python3 tools/update_tickets.py
  - writes tickets/{game}.gif  (front of ticket)
  - writes games.json          (game number, name, price, top prize, start date)
Existing images are kept; pass --force to re-download them.
Uses only the Python standard library.
"""
import html
import json
import os
import re
import sys
import urllib.request

BASE = 'https://www.texaslottery.com/export/sites/lottery'
LIST_URL = BASE + '/Games/Scratch_Offs/all.html'
IMG_URL = BASE + '/Images/scratchoffs/{game}_img1.gif'
UA = {'User-Agent': 'Mozilla/5.0 (scratch-off display updater)'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


def parse_games(page):
    games = []
    for row in re.findall(r'<tr>(.*?)</tr>', page, re.S):
        m = re.search(r'Game Number (\d+)', row)
        if not m:
            continue
        tds = [html.unescape(re.sub(r'<[^>]+>', '', c)).strip()
               for c in re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)]
        if len(tds) < 6:
            continue
        games.append({'game': m.group(1), 'name': tds[4], 'price': tds[2].lstrip('$'),
                      'topPrize': tds[5], 'start': tds[1]})
    return games


def main():
    force = '--force' in sys.argv
    games = parse_games(get(LIST_URL).decode('utf-8', 'replace'))
    if not games:
        sys.exit('No games found - the Texas Lottery page layout may have changed.')
    os.makedirs(os.path.join(ROOT, 'tickets'), exist_ok=True)
    new = failed = 0
    for g in games:
        path = os.path.join(ROOT, 'tickets', g['game'] + '.gif')
        if os.path.exists(path) and not force:
            continue
        try:
            data = get(IMG_URL.format(game=g['game']))
            if not data.startswith(b'GIF'):
                raise ValueError('not a GIF')
            with open(path, 'wb') as f:
                f.write(data)
            new += 1
        except Exception as e:  # keep going on a single bad image
            failed += 1
            print('  failed', g['game'], e)
    games.sort(key=lambda g: int(g['game']))
    with open(os.path.join(ROOT, 'games.json'), 'w') as f:
        json.dump(games, f, indent=1)
    print(f'{len(games)} games listed, {new} images downloaded, {failed} failed.')


if __name__ == '__main__':
    main()
