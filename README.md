# Yuan

An online, browser-based adaptation of the board game *Yuan*, with a 3D board rendered with three.js and a small Node server for multiplayer rooms.

> **Unofficial fan project.** This project is not affiliated with, endorsed by, or sponsored by OKA LUDA or the game's author, Charlie Sigogneau. *Yuan* and all related names are the property of their respective owners. If you enjoy the game, please buy the physical edition.

## Requirements

- Node.js 24+ (the server runs TypeScript directly and uses `node:sqlite`)

## Development

```sh
npm install
npm run dev
```

The Vite dev server also serves the game API. Game rooms are stored in `data/yuan.sqlite`.

## Production

```sh
npm run build
npm run server
```

The server listens on `PORT` (default `8787`) and stores rooms in `YUAN_DB` (default `data/yuan.sqlite`). Set `YUAN_TRUST_PROXY=1` when running behind a reverse proxy that sets `X-Forwarded-For`.

### Docker

```sh
docker compose up --build
```

`deploy/` contains an example setup with Caddy as a TLS reverse proxy.

## Tests

```sh
npm test
```

## Credits

- `public/environment/background.exr` is licensed under CC0.

## License

The source code is released under the [MIT License](LICENSE). This license covers the code in this repository only, not the *Yuan* game, its rules, name, or artwork.
