import "./ui/screen.css";
import { MAX_PLAYERS } from "./game/default_map.ts";
import { GameScreen } from "./game_screen.ts";
import { SetupScreen } from "./setup_screen.ts";
import { createRoom, joinRoom } from "./net/api.ts";
import { GameClient } from "./net/game_client.ts";
import { forgetSession, loadName, loadSession, saveName, saveSession } from "./net/session.ts";
import { MIN_PLAYERS, type PlayerView, type Session } from "./protocol.ts";
import { clanCssColor } from "./rendering/clan_colors.ts";
import { Landing } from "./ui/landing.ts";
import { Lobby } from "./ui/lobby.ts";
import { Toast } from "./ui/toast.ts";

const container = document.body;
const toast = new Toast(container);

let client: GameClient | null = null;
let landing: Landing | null = null;
let lobby: Lobby | null = null;
let game: GameScreen | null = null;
let setup: SetupScreen | null = null;

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
    },
    { name: loadName(), code, error },
  );
  landing = screen;
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
      onLaunch: () => current.start(),
      onAddPlayer: () => current.addPlayer(),
      onCopyLink: () => navigator.clipboard?.writeText(`${location.origin}${location.pathname}?game=${view.code}`),
      onExit: () => exit(current),
    });
    lobby.update({
      code: view.code,
      seats: view.seats.map((seat) => ({
        name: seat.name,
        clan: seat.clan,
        color: clanCssColor(seat.clan),
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

const code = new URLSearchParams(location.search).get("game")?.trim().toUpperCase() ?? "";
const session = code === "" ? null : loadSession(code);
if (session === null) {
  showLanding(code, "");
} else {
  enter(session);
}
