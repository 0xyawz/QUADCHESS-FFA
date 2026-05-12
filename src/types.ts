
export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';

export type PlayerColor = 'green' | 'blue' | 'red' | 'yellow';

export interface Position {
  r: number;
  c: number;
}

export interface Piece {
  id: string;
  type: PieceType;
  player: PlayerColor;
  position: Position;
  hasMoved: boolean;
}

export interface Square {
  r: number;
  c: number;
  piece: Piece | null;
  isValid: boolean; // Whether it's a playable square (not in corner voids)
}

export type GameType = 'Blitz' | 'Bullet';

export interface GameSettings {
  type: GameType;
  duration: string;
}

export interface PlayerProfile {
  name: string;
  elo: number;
  isBot: boolean;
  color: PlayerColor;
}

export interface GameState {
  board: (Piece | null)[][];
  currentPlayer: PlayerColor;
  eliminatedPlayers: PlayerColor[];
  winner: PlayerColor | null;
  history: string[];
  lastMove: { from: Position; to: Position } | null;
  players: Record<PlayerColor, PlayerProfile>;
  settings: GameSettings;
  timers: Record<PlayerColor, number>;
}
