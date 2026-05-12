import { PlayerColor, PieceType } from './types';

export const BOARD_SIZE = 14;

export const PLAYER_COLORS: PlayerColor[] = ['green', 'blue', 'red', 'yellow'];

export const COLOR_CONFIG = {
  green: {
    primary: '#22c55e',
    secondary: '#166534',
    name: 'Green (Bottom)',
    direction: { r: -1, c: 0 },
    promotionRank: 0,
    startRows: [12, 13],
    startCols: [3, 4, 5, 6, 7, 8, 9, 10],
  },
  blue: {
    primary: '#3b82f6',
    secondary: '#1e40af',
    name: 'Blue (Left)',
    direction: { r: 0, c: 1 },
    promotionRank: 13,
    startRows: [3, 4, 5, 6, 7, 8, 9, 10],
    startCols: [0, 1],
  },
  red: {
    primary: '#ef4444',
    secondary: '#991b1b',
    name: 'Red (Top)',
    direction: { r: 1, c: 0 },
    promotionRank: 13,
    startRows: [0, 1],
    startCols: [3, 4, 5, 6, 7, 8, 9, 10],
  },
  yellow: {
    primary: '#eab308',
    secondary: '#854d0e',
    name: 'Yellow (Right)',
    direction: { r: 0, c: -1 },
    promotionRank: 0,
    startRows: [3, 4, 5, 6, 7, 8, 9, 10],
    startCols: [12, 13],
  },
};

export const INITIAL_PIECE_ORDER: PieceType[] = [
  'rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'
];
