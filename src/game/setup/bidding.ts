import { STARTING_CHAO_WITH_BIDDING, type Clan, type PlayerId } from "../../game_types.ts";
import { SetupStage, shuffle, type SetupState } from "./setup.ts";

export function startClans(setup: SetupState, players: number, active: readonly PlayerId[], random: () => number) {
  setup.stage = SetupStage.Clans;
  setup.agreed = [];
  if (!setup.withBidding) {
    assignRemaining(setup, players, random);
    return;
  }
  setup.bidding = {
    chao: Array.from({ length: players }, () => STARTING_CHAO_WITH_BIDDING),
    contenders: [],
    bids: {},
    chooser: null,
    tieBreak: false,
    history: [],
  };
  nextRound(setup, players, active, random);
}

export function clansAssigned(setup: SetupState): boolean {
  return setup.stage === SetupStage.Clans && setup.owners.every((owner) => owner !== null);
}

export function clanOfPlayer(setup: SetupState, player: PlayerId): Clan | null {
  const index = setup.owners.indexOf(player);
  return index < 0 ? null : setup.clans[index];
}

export function placeBid(setup: SetupState, player: PlayerId, amount: number, random: () => number): string | null {
  const bidding = setup.bidding;
  if (setup.stage !== SetupStage.Clans || bidding === null) {
    return "Nobody is bidding";
  }
  if (bidding.chooser !== null) {
    return "The winner is choosing a Clan";
  }
  if (!bidding.contenders.includes(player)) {
    return "You are not bidding this round";
  }
  if (bidding.bids[player] !== undefined) {
    return "You already placed your bid";
  }
  if (!Number.isInteger(amount) || amount < 0 || amount > bidding.chao[player]) {
    return `Bid between 0 and ${bidding.chao[player]} Chão`;
  }
  bidding.bids[player] = amount;
  if (bidding.contenders.every((contender) => bidding.bids[contender] !== undefined)) {
    resolveRound(setup, random);
  }
  return null;
}

export function chooseClan(setup: SetupState, player: PlayerId, clan: Clan, players: number, active: readonly PlayerId[], random: () => number): string | null {
  const bidding = setup.bidding;
  if (setup.stage !== SetupStage.Clans || bidding === null || bidding.chooser !== player) {
    return "It is not your turn to choose a Clan";
  }
  const index = setup.clans.indexOf(clan);
  if (index < 0 || setup.owners[index] !== null) {
    return "This Clan is not available";
  }
  setup.owners[index] = player;
  const round = bidding.history.at(-1);
  if (round) {
    round.clan = clan;
  }
  bidding.chooser = null;
  nextRound(setup, players, active, random);
  return null;
}

export function leaveBidding(setup: SetupState, player: PlayerId, players: number, active: readonly PlayerId[], random: () => number) {
  const bidding = setup.bidding;
  if (setup.stage !== SetupStage.Clans || bidding === null) {
    return;
  }
  if (bidding.chooser === player) {
    const free = setup.owners.flatMap((owner, index) => (owner === null ? [index] : []));
    setup.owners[free[Math.floor(random() * free.length)]] = player;
    bidding.chooser = null;
    nextRound(setup, players, active, random);
    return;
  }
  if (!bidding.contenders.includes(player)) {
    return;
  }
  bidding.contenders = bidding.contenders.filter((id) => id !== player);
  delete bidding.bids[player];
  if (bidding.contenders.length <= 1 && bidding.tieBreak) {
    const [winner] = bidding.contenders;
    const amount = bidding.history.at(-1)?.bids.find((bid) => bid.player === winner)?.amount ?? 0;
    win(setup, winner, amount);
  } else if (bidding.contenders.length === 0) {
    nextRound(setup, players, active, random);
  } else if (bidding.contenders.every((contender) => bidding.bids[contender] !== undefined)) {
    resolveRound(setup, random);
  }
}

function resolveRound(setup: SetupState, random: () => number) {
  const bidding = setup.bidding!;
  const bids = bidding.contenders.map((player) => ({ player, amount: bidding.bids[player] }));
  const highest = Math.max(...bids.map(({ amount }) => amount));
  const top = bids.filter(({ amount }) => amount === highest).map(({ player }) => player);
  bidding.bids = {};
  if (top.length === 1) {
    bidding.history.push({ bids, winner: top[0], clan: null, random: false });
    win(setup, top[0], highest);
    return;
  }
  if (bidding.tieBreak && top.every((player) => bidding.chao[player] === highest)) {
    const winner = top[Math.floor(random() * top.length)];
    bidding.history.push({ bids, winner, clan: null, random: true });
    win(setup, winner, highest);
    return;
  }
  bidding.history.push({ bids, winner: null, clan: null, random: false });
  bidding.contenders = top;
  bidding.tieBreak = true;
}

function win(setup: SetupState, player: PlayerId, amount: number) {
  const bidding = setup.bidding!;
  bidding.chao[player] -= amount;
  bidding.contenders = [];
  bidding.tieBreak = false;
  bidding.chooser = player;
}

function nextRound(setup: SetupState, players: number, active: readonly PlayerId[], random: () => number) {
  const bidding = setup.bidding!;
  const unassigned = Array.from({ length: players }, (_, player) => player).filter((player) => !setup.owners.includes(player));
  const bidders = unassigned.filter((player) => active.includes(player));
  if (bidders.length <= 1) {
    bidding.contenders = [];
    bidding.chooser = null;
    assignRemaining(setup, players, random);
    return;
  }
  bidding.contenders = bidders;
  bidding.bids = {};
  bidding.tieBreak = false;
}

function assignRemaining(setup: SetupState, players: number, random: () => number) {
  const unassigned = Array.from({ length: players }, (_, player) => player).filter((player) => !setup.owners.includes(player));
  const free = shuffle(
    setup.owners.flatMap((owner, index) => (owner === null ? [index] : [])),
    random,
  );
  unassigned.forEach((player, i) => {
    if (i < free.length) {
      setup.owners[free[i]] = player;
    }
  });
}
