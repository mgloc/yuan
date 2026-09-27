import "./ui/screen.css";
import { MAX_PLAYERS } from "./game/default_map.ts";
import { GameScreen } from "./game_screen.ts";
import { MapMakerScreen } from "./map_maker_screen.ts";
import { parseCustomMap, summariseMap } from "./game/custom_map.ts";
import { SetupScreen } from "./setup_screen.ts";
import { createRoom, joinRoom } from "./net/api.ts";
import { GameClient } from "./net/game_client.ts";
import { forgetSession, loadName, loadSession, saveName, saveSession } from "./net/session.ts";
import { MapMode, MIN_PLAYERS, type PlayerView, type Session } from "./protocol.ts";
import { clanCssColor, seatCssColor } from "./rendering/clan_colors.ts";
import { CLAN_ORDER } from "./game/setup/setup.ts";
import type { Clan } from "./game_types.ts";
import { Landing } from "./ui/landing.ts";
import { Lobby } from "./ui/lobby.ts";
import { Toast } from "./ui/toast.ts";
import { readableOnDark } from "./ui/color.ts";

const container = document.body;
const toast = new Toast(container);

let client: GameClient | null = null;
let landing: Landing | null = null;
let lobby: Lobby | null = null;
let game: GameScreen | null = null;
let setup: SetupScreen | null = null;
let maker: MapMakerScreen | null = null;

function clear() {
  client?.close();
  client = null;
  landing?.dispose();
  landing = null;
  lobby?.dispose();
  lobby = null;
  game?.dispose();
  game = null;
  setup?.dispose();
  setup = null;
  maker?.dispose();
  maker = null;
}

function showLanding(code: string, error: string) {
  clear();
  history.replaceState(null, "", code === "" ? location.pathname : `?game=${code}`);
  const screen = new Landing(
    container,
    {
      onCreate: (name, debug) => request(screen, name, () => createRoom({ name, debug })),
      onJoin: (name, code) =>
        code === "" ? screen.showError("Enter a game code") : request(screen, name, () => joinRoom(code, { name })),
      onMapMaker: () => showMapMaker(),
    },
    { name: loadName(), code, error },
  );
  landing = screen;
}

function showMapMaker() {
  clear();
  history.replaceState(null, "", "?maker");
  maker = new MapMakerScreen(container, toast, () => showLanding("", ""));
}

async function request(screen: Landing, name: string, send: () => Promise<Session>) {
  saveName(name.trim());
  screen.setBusy(true);
  try {
    enter(await send());
  } catch (error) {
    screen.showError((error as Error).message);
    screen.setBusy(false);
  }
}

function enter(session: Session) {
  clear();
  saveSession(session);
  history.replaceState(null, "", `?game=${session.code}`);
  const current = new GameClient(session, {
    onGone: (reason) => {
      forgetSession(session.code);
      if (reason === "closed") {
        showLanding("", "The host closed the game");
      } else {
        showLanding(session.code, "This game is no longer available");
      }
    },
    onError: (message) => toast.show(message),
  });
  current.view.onChange((view) => view !== null && client === current && route(current, view));
  client = current;
}

async function exit(current: GameClient) {
  const view = current.view.get();
  if (view === null) {
    return;
  }
  const host = current.isHost;
  const inLobby = view.match === null && view.setup === null;
  const started = view.setup !== null || (view.match !== null && !view.match.finished);
  const question = host
    ? `Delete this ${inLobby ? "lobby" : "game"} for everyone?`
    : started
      ? "Leave the game? Your Clan will pass every remaining turn."
      : "Leave the lobby?";
  if (!confirm(question)) {
    return;
  }
  try {
    await (host ? current.deleteGame() : current.leave());
  } catch (error) {
    toast.show((error as Error).message);
    return;
  }
  forgetSession(current.session.code);
  showLanding("", "");
}

async function loadMap(current: GameClient, file: File) {
  let map: ReturnType<typeof parseCustomMap>;
  try {
    map = parseCustomMap(JSON.parse(await file.text()));
  } catch {
    map = "This file is not valid JSON";
  }
  if (typeof map === "string") {
    toast.show(`Could not load the map: ${map}`);
    return;
  }
  current.setOptions({ map: MapMode.Imported, customMap: map });
}

function route(current: GameClient, view: PlayerView) {
  if (view.setup !== null) {
    lobby?.dispose();
    lobby = null;
    game?.dispose();
    game = null;
    setup ??= new SetupScreen(container, current, view, () => exit(current));
    setup.update(view);
    return;
  }
  setup?.dispose();
  setup = null;
  if (view.match === null) {
    game?.dispose();
    game = null;
    lobby ??= new Lobby(container, {
      onClanPowers: (clanPowers) => current.setOptions({ clanPowers }),
      onMap: (map) => current.setOptions({ map }),
      onLoadMap: (file) => loadMap(current, file),
      onBidding: (bidding) => current.setOptions({ bidding }),
      onToggleClan: (clan) => {
        const chosen = current.view.get()?.options.clans ?? [];
        const next = chosen.includes(clan as Clan) ? chosen.filter((other) => other !== clan) : [...chosen, clan as Clan];
        current.setOptions({ clans: next });
      },
      onLaunch: () => current.start(),
      onAddPlayer: () => current.addPlayer(),
      onCopyLink: () => navigator.clipboard?.writeText(`${location.origin}${location.pathname}?game=${view.code}`),
      onExit: () => exit(current),
    });
    lobby.update({
      code: view.code,
      seats: view.seats.map((seat) => ({
        name: seat.name,
        color: seatCssColor(seat.clan),
        host: seat.id === view.host,
        you: seat.id === view.self,
        placeholder: seat.placeholder,
      })),
      maxPlayers: MAX_PLAYERS,
      minPlayers: MIN_PLAYERS,
      isHost: current.isHost,
      debug: view.debug,
      clanPowers: view.options.clanPowers,
      map: view.options.map,
      customMap: view.options.customMap === null ? null : summariseMap(view.options.customMap),
      bidding: view.options.bidding,
      clans: CLAN_ORDER.map((clan) => ({ clan, color: readableOnDark(clanCssColor(clan)), selected: view.options.clans.includes(clan) })),
    });
    return;
  }
  lobby?.dispose();
  lobby = null;
  if (game === null) {
    game = new GameScreen(container, current, view, () => exit(current));
  } else {
    game.update(view);
  }
}

const params = new URLSearchParams(location.search);
const code = params.get("game")?.trim().toUpperCase() ?? "";
const session = code === "" ? null : loadSession(code);
if (params.has("maker")) {
  showMapMaker();
} else if (session === null) {
  showLanding(code, "");
} else {
  enter(session);
}
