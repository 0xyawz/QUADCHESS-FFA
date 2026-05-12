/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useMemo, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Crown, 
  RotateCcw, 
  Trophy, 
  Users, 
  History, 
  AlertCircle,
  Play,
  Pause,
  ChevronRight,
  Shield,
  Zap,
  Target
} from "lucide-react";
import { Piece, Position, GameState, PlayerColor, PieceType, PlayerProfile, GameType, GameSettings } from "./types";
import { BOARD_SIZE, PLAYER_COLORS, COLOR_CONFIG, INITIAL_PIECE_ORDER } from "./constants";

// --- Components ---

const PieceIcon = ({ type, color }: { type: PieceType; color: string }): ReactNode => {
  // Classic Chess SVG Paths
  const paths: Record<PieceType, ReactNode> = {
    pawn: (
      <path d="M12 5a3 3 0 0 0-3 3 3 3 0 0 0 .5 1.7L7.7 15.5a2 2 0 0 0 1.9 2.5h4.8a2 2 0 0 0 1.9-2.5l-1.8-5.8A3 3 0 0 0 15 8a3 3 0 0 0-3-3zM9 20h6v1H9v-1z" />
    ),
    rook: (
      <path d="M5 20h14v-2H5v2zm2-3h10v-5h-2v1h-2v-1h-2v1H9v-1H7v5zM5 11h2V7H5v4zm4 0h2V7H9v4zm4 0h2V7h-2v4zm4 0h2V7h-2v4zM5 6V4h3v1h2V4h4v1h2V4h3v2H5z" />
    ),
    knight: (
      <path d="M15 3a3 3 0 0 0-3 3v1h1l3 3v2h-1v2h2v-2l1-4V6a3 3 0 0 0-3-3zm-6 4c-3 0-4 2-4 5v2h2v4h6v-2h1c2 0 3-1 3-3V6l-3-3l-5 4z" />
    ),
    bishop: (
      <path d="M12 2a3 3 0 0 0-3 3c0 .8.3 1.5.8 2.2L7 14h10l-2.8-6.8c.5-.7.8-1.4.8-2.2a3 3 0 0 0-3-3zm-3 15h6v1H9v-1zm1 3h4v1h-4v-1z" />
    ),
    queen: (
      <path d="M12 2l-2 3H7L8 8l-3 1l1 3l-3 4h18l-3-4l1-3l-3-1l1-3h-3l-2-3zM9 19h6v1H9v-1zm1 2h4v1h-4v-1z" />
    ),
    king: (
      <path d="M12 2v2M9 3v2m6-2v2M5 8l2 2l-2 7h14l-2-7l2-2H5zm4 11h6v1H9v-1zm1 2h4v1h-4v-1z" />
    ),
  };

  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      stroke="black" 
      strokeWidth="1.5" 
      className="w-full h-full drop-shadow-md"
      style={{ color }}
    >
      {paths[type]}
    </svg>
  );
};

// --- Helpers ---

const parseDuration = (duration: string) => {
  const [mins, inc] = duration.split('|').map(Number);
  return { seconds: mins * 60, increment: inc };
};

const formatTime = (seconds: number) => {
  if (seconds <= 0) return "00:00.0";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  if (seconds < 20) {
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const isPlayable = (r: number, c: number) => {
  return (r >= 3 && r <= 10) || (c >= 3 && c <= 10);
};

const isSquareAttacked = (pos: Position, defenderColor: PlayerColor, board: (Piece | null)[][]): boolean => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.player !== defenderColor) {
        const dr = pos.r - r;
        const dc = pos.c - c;
        const absDr = Math.abs(dr);
        const absDc = Math.abs(dc);

        switch (piece.type) {
          case 'pawn': {
            const config = COLOR_CONFIG[piece.player];
            const { r: pdr, c: pdc } = config.direction;
            if (pdr !== 0) {
              if (dr === pdr && (dc === 1 || dc === -1)) return true;
            } else {
              if (dc === pdc && (dr === 1 || dr === -1)) return true;
            }
            break;
          }
          case 'knight': {
            if ((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2)) return true;
            break;
          }
          case 'king': {
            if (absDr <= 1 && absDc <= 1) return true;
            break;
          }
          case 'rook':
          case 'queen': {
            if (dr === 0 || dc === 0) {
              const stepR = dr === 0 ? 0 : dr / absDr;
              const stepC = dc === 0 ? 0 : dc / absDc;
              let checkR = r + stepR;
              let checkC = c + stepC;
              let blocked = false;
              while (checkR !== pos.r || checkC !== pos.c) {
                if (board[checkR][checkC]) {
                  blocked = true;
                  break;
                }
                checkR += stepR;
                checkC += stepC;
              }
              if (!blocked) return true;
            }
            if (piece.type === 'rook') break;
            /* Fallthrough for queen diagonal */
          }
          case 'bishop': {
            if (absDr === absDc) {
              const stepR = dr / absDr;
              const stepC = dc / absDc;
              let checkR = r + stepR;
              let checkC = c + stepC;
              let blocked = false;
              while (checkR !== pos.r || checkC !== pos.c) {
                if (board[checkR][checkC]) {
                  blocked = true;
                  break;
                }
                checkR += stepR;
                checkC += stepC;
              }
              if (!blocked) return true;
            }
            break;
          }
        }
      }
    }
  }
  return false;
};

const getKingPosition = (player: PlayerColor, board: (Piece | null)[][]): Position | null => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const piece = board[r][c];
      if (piece && piece.player === player && piece.type === 'king') {
        return { r, c };
      }
    }
  }
  return null;
};

const getInitialBoard = (): (Piece | null)[][] => {
  const board: (Piece | null)[][] = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));

  PLAYER_COLORS.forEach(color => {
    const config = COLOR_CONFIG[color];
    const { startRows, startCols, direction } = config;

    // Pawns
    const pawnRow = color === 'green' ? 12 : color === 'red' ? 1 : -1;
    const pawnCol = color === 'blue' ? 1 : color === 'yellow' ? 12 : -1;

    if (color === 'green' || color === 'red') {
      const pRow = color === 'green' ? 12 : 1;
      const bRow = color === 'green' ? 13 : 0;
      startCols.forEach((c, idx) => {
        board[pRow][c] = { id: `${color}-pawn-${idx}`, type: 'pawn', player: color, position: { r: pRow, c }, hasMoved: false };
        board[bRow][c] = { id: `${color}-back-${idx}`, type: INITIAL_PIECE_ORDER[idx], player: color, position: { r: bRow, c }, hasMoved: false };
      });
    } else {
      const pCol = color === 'blue' ? 1 : 12;
      const bCol = color === 'blue' ? 0 : 13;
      startRows.forEach((r, idx) => {
        board[r][pCol] = { id: `${color}-pawn-${idx}`, type: 'pawn', player: color, position: { r, c: pCol }, hasMoved: false };
        board[r][bCol] = { id: `${color}-back-${idx}`, type: INITIAL_PIECE_ORDER[idx], player: color, position: { r, c: bCol }, hasMoved: false };
      });
    }
  });

  return board;
};

// --- App ---

const GAME_DURATIONS: Record<GameType, string[]> = {
  Blitz: ['3|0', '3|2', '5|0', '5|1'],
  Bullet: ['1|0', '1|1', '2|1']
};

export default function App() {
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: "Player_1", elo: 1200 });
  const [lobbySettings, setLobbySettings] = useState<GameSettings>({
    type: 'Blitz',
    duration: '5|0'
  });
  
  const [gameState, setGameState] = useState<GameState>({
    board: getInitialBoard(),
    currentPlayer: 'green',
    eliminatedPlayers: [],
    winner: null,
    history: [],
    lastMove: null,
    players: {
      green: { name: "Player", elo: 1200, isBot: false, color: 'green' },
      blue: { name: "Bot_Alpha", elo: 1200, isBot: true, color: 'blue' },
      red: { name: "Bot_Beta", elo: 1200, isBot: true, color: 'red' },
      yellow: { name: "Bot_Gamma", elo: 1200, isBot: true, color: 'yellow' },
    },
    settings: { type: 'Blitz', duration: '5|0' },
    timers: { green: 300, blue: 300, red: 300, yellow: 300 }
  });

  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [premove, setPremove] = useState<{ from: Position; to: Position } | null>(null);

  // Start Game Handler
  const handleStartGame = () => {
    const { seconds } = parseDuration(lobbySettings.duration);
    const initialTimers: Record<PlayerColor, number> = {
      green: seconds,
      blue: seconds,
      red: seconds,
      yellow: seconds
    };

    const newPlayers: Record<PlayerColor, PlayerProfile> = {
      green: { ...userProfile, isBot: false, color: 'green' },
      blue: { name: "Bot_Alpha", elo: userProfile.elo + (Math.floor(Math.random() * 600) - 300), isBot: true, color: 'blue' },
      red: { name: "Bot_Beta", elo: userProfile.elo + (Math.floor(Math.random() * 600) - 300), isBot: true, color: 'red' },
      yellow: { name: "Bot_Gamma", elo: userProfile.elo + (Math.floor(Math.random() * 600) - 300), isBot: true, color: 'yellow' },
    };

    setGameState({
      board: getInitialBoard(),
      currentPlayer: 'green',
      eliminatedPlayers: [],
      winner: null,
      history: [],
      lastMove: null,
      players: newPlayers,
      settings: lobbySettings,
      timers: initialTimers
    });
    setIsGameStarted(true);
    setPremove(null);
  };

  // Calculate valid moves
  const getMoves = useCallback((pos: Position, board: (Piece | null)[][], checkSafety = true): Position[] => {
    const piece = board[pos.r][pos.c];
    if (!piece) return [];

    const moves: Position[] = [];

    const addMove = (r: number, c: number) => {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE || !isPlayable(r, c)) return false;
      const target = board[r][c];
      if (!target) {
        moves.push({ r, c });
        return true; // Can continue for slides
      } else {
        if (target.player !== piece.player) {
          moves.push({ r, c });
        }
        return false; // Blocked
      }
    };

    const config = COLOR_CONFIG[piece.player];

    switch (piece.type) {
      case 'pawn': {
        const { r: dr, c: dc } = config.direction;
        const forward1 = { r: pos.r + dr, c: pos.c + dc };
        if (forward1.r >= 0 && forward1.r < BOARD_SIZE && forward1.c >= 0 && forward1.c < BOARD_SIZE && !board[forward1.r][forward1.c]) {
          moves.push(forward1);
          if (!piece.hasMoved) {
            const forward2 = { r: pos.r + 2 * dr, c: pos.c + 2 * dc };
            if (!board[forward2.r][forward2.c]) moves.push(forward2);
          }
        }
        // Captures
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([rr, cc]) => {
          const caps = dr !== 0 ? [{ r: pos.r + dr, c: pos.c - 1 }, { r: pos.r + dr, c: pos.c + 1 }] 
                              : [{ r: pos.r - 1, c: pos.c + dc }, { r: pos.r + 1, c: pos.c + dc }];
          
          caps.forEach(cap => {
            if (cap.r >= 0 && cap.r < BOARD_SIZE && cap.c >= 0 && cap.c < BOARD_SIZE) {
              const target = board[cap.r][cap.c];
              if (target && target.player !== piece.player) moves.push(cap);
            }
          });
        });
        break;
      }
      case 'rook':
      case 'queen': {
        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
          for (let i = 1; i < BOARD_SIZE; i++) {
            if (!addMove(pos.r + dr * i, pos.c + dc * i)) break;
          }
        });
        if (piece.type === 'rook') break;
      }
      case 'bishop': {
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
          for (let i = 1; i < BOARD_SIZE; i++) {
            if (!addMove(pos.r + dr * i, pos.c + dc * i)) break;
          }
        });
        break;
      }
      case 'knight': {
        [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([dr, dc]) => {
          addMove(pos.r + dr, pos.c + dc);
        });
        break;
      }
      case 'king': {
        [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].forEach(([dr, dc]) => {
          addMove(pos.r + dr, pos.c + dc);
        });

        // Castling
        if (checkSafety && !piece.hasMoved) {
          const inCheck = isSquareAttacked(pos, piece.player, board);
          if (!inCheck) {
            // Check rooks
            const rooks: { col: number; dir: number }[] = [];
            if (piece.player === 'green' || piece.player === 'red') {
              rooks.push({ col: 10, dir: 1 }); // Kingside
              rooks.push({ col: 3, dir: -1 }); // Queenside
            } else {
              rooks.push({ col: 10, dir: 1 }); // Bottom
              rooks.push({ col: 3, dir: -1 }); // Top
            }

            rooks.forEach(rookConfig => {
              const r = piece.player === 'green' ? 13 : piece.player === 'red' ? 0 : rookConfig.col;
              const c = piece.player === 'green' || piece.player === 'red' ? rookConfig.col : (piece.player === 'blue' ? 0 : 13);
              const rook = board[r][c];
              if (rook && rook.type === 'rook' && rook.player === piece.player && !rook.hasMoved) {
                // Check path
                let pathClear = true;
                const dist = Math.abs(rookConfig.col - (piece.player === 'green' || piece.player === 'red' ? pos.c : pos.r));
                for (let i = 1; i < dist; i++) {
                  const checkR = piece.player === 'green' || piece.player === 'red' ? pos.r : pos.r + rookConfig.dir * i;
                  const checkC = piece.player === 'green' || piece.player === 'red' ? pos.c + rookConfig.dir * i : pos.c;
                  if (board[checkR][checkC] || isSquareAttacked({ r: checkR, c: checkC }, piece.player, board)) {
                    pathClear = false;
                    break;
                  }
                }
                if (pathClear) {
                  const targetR = piece.player === 'green' || piece.player === 'red' ? pos.r : pos.r + rookConfig.dir * 2;
                  const targetC = piece.player === 'green' || piece.player === 'red' ? pos.c + rookConfig.dir * 2 : pos.c;
                  moves.push({ r: targetR, c: targetC });
                }
              }
            });
          }
        }
        break;
      }
    }

    // Filter out moves that leave king in check
    if (checkSafety) {
      return moves.filter(m => {
        const testBoard = JSON.parse(JSON.stringify(board));
        testBoard[m.r][m.c] = testBoard[pos.r][pos.c];
        testBoard[pos.r][pos.c] = null;
        const kingPos = piece.type === 'king' ? m : getKingPosition(piece.player, testBoard);
        if (!kingPos) return true;
        return !isSquareAttacked(kingPos, piece.player, testBoard);
      });
    }

    return moves;
  }, []);

  const resetGame = () => {
    setIsGameStarted(false);
    setSelectedPos(null);
    setValidMoves([]);
  };

  // Timer Effect
  useEffect(() => {
    if (!isGameStarted || gameState.winner) return;

    const interval = setInterval(() => {
      setGameState(prev => {
        if (prev.winner) return prev;
        const currentTimer = prev.timers[prev.currentPlayer];
        
        if (currentTimer <= 0 && !prev.eliminatedPlayers.includes(prev.currentPlayer)) {
          // Eliminate player on timeout
          const newEliminated = [...prev.eliminatedPlayers, prev.currentPlayer];
          
          let nextPlayerIndex = (PLAYER_COLORS.indexOf(prev.currentPlayer) + 1) % 4;
          let nextPlayer = PLAYER_COLORS[nextPlayerIndex];
          while (newEliminated.includes(nextPlayer) && newEliminated.length < 3) {
            nextPlayerIndex = (nextPlayerIndex + 1) % 4;
            nextPlayer = PLAYER_COLORS[nextPlayerIndex];
          }

          const remaining = PLAYER_COLORS.filter(p => !newEliminated.includes(p));
          const winner = remaining.length === 1 ? remaining[0] : null;

          return {
            ...prev,
            eliminatedPlayers: newEliminated,
            currentPlayer: nextPlayer,
            winner,
            timers: { ...prev.timers, [prev.currentPlayer]: 0 }
          };
        }

        return {
          ...prev,
          timers: {
            ...prev.timers,
            [prev.currentPlayer]: Math.max(0, currentTimer - 0.1)
          }
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isGameStarted, gameState.winner]);

  // Premove Execution Effect
  useEffect(() => {
    if (!isGameStarted || gameState.winner || gameState.currentPlayer !== 'green') return;
    if (premove) {
      const { from, to } = premove;
      const piece = gameState.board[from.r][from.c];
      if (piece && piece.player === 'green') {
        const moves = getMoves(from, gameState.board);
        if (moves.some(m => m.r === to.r && m.c === to.c)) {
          executeMove(from, to);
        }
      }
      setPremove(null);
    }
  }, [gameState.currentPlayer, isGameStarted, gameState.winner]);

  // Bot Logic Effect
  useEffect(() => {
    if (!isGameStarted || gameState.winner) return;

    const currentPlayerProfile = gameState.players[gameState.currentPlayer];
    if (currentPlayerProfile.isBot) {
      const timer = setTimeout(() => {
        // Collect all pieces for the bot
        const botPieces: Position[] = [];
        gameState.board.forEach((row, r) => {
          row.forEach((piece, c) => {
            if (piece && piece.player === gameState.currentPlayer) {
              botPieces.push({ r, c });
            }
          });
        });

        // Find all possible moves
        const allPossibleMoves: { from: Position; to: Position }[] = [];
        botPieces.forEach(pos => {
          const moves = getMoves(pos, gameState.board);
          moves.forEach(m => allPossibleMoves.push({ from: pos, to: m }));
        });

        if (allPossibleMoves.length > 0) {
          // Simple heuristic: prioritze captures
          const captures = allPossibleMoves.filter(m => gameState.board[m.to.r][m.to.c] !== null);
          const chosenMove = captures.length > 0 
            ? captures[Math.floor(Math.random() * captures.length)]
            : allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
          
          // Actually we need to call the handleSquareClick logic but it's bound to local state
          // Let's refactor the move execution logic or just trigger it.
          // Since handleSquareClick depends on selectedPos, we'll manually execute it here
          executeMove(chosenMove.from, chosenMove.to);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isGameStarted, gameState.currentPlayer, gameState.winner, gameState.board]);

  const executeMove = (from: Position, to: Position) => {
    const newBoard = JSON.parse(JSON.stringify(gameState.board)) as (Piece | null)[][];
    const piece = newBoard[from.r][from.c]!;
    
    // Check if capture king
    const target = newBoard[to.r][to.c];
    let newEliminated = [...gameState.eliminatedPlayers];
    if (target?.type === 'king' && !newEliminated.includes(target.player)) {
      newEliminated.push(target.player);
    }

    // Handle Castling
    if (piece.type === 'king' && Math.abs(to.r - from.r) === 2 || Math.abs(to.c - from.c) === 2) {
      // King moved 2 squares - castling
      const isHorizontal = to.r === from.r;
      const rookFromC = to.c > from.c ? 10 : 3;
      const rookFromR = to.r > from.r ? 10 : 3;
      
      const rookToC = isHorizontal ? (to.c > from.c ? to.c - 1 : to.c + 1) : from.c;
      const rookToR = isHorizontal ? from.r : (to.r > from.r ? to.r - 1 : to.r + 1);
      
      const rookR = isHorizontal ? from.r : rookFromR;
      const rookC = isHorizontal ? rookFromC : from.c;
      
      const rook = newBoard[rookR][rookC];
      if (rook) {
        rook.position = { r: rookToR, c: rookToC };
        rook.hasMoved = true;
        newBoard[rookToR][rookToC] = rook;
        newBoard[rookR][rookC] = null;
      }
    }

    piece.position = to;
    piece.hasMoved = true;

    // Pawn Promotion
    if (piece.type === 'pawn') {
      const isFarEdge = (piece.player === 'green' && to.r === 0) ||
                       (piece.player === 'red' && to.r === BOARD_SIZE - 1) ||
                       (piece.player === 'blue' && to.c === BOARD_SIZE - 1) ||
                       (piece.player === 'yellow' && to.c === 0);
      if (isFarEdge) piece.type = 'queen';
    }

    newBoard[to.r][to.c] = piece;
    newBoard[from.r][from.c] = null;

    // Next turn
    const { increment } = parseDuration(gameState.settings.duration);
    const newTimers = { ...gameState.timers };
    newTimers[gameState.currentPlayer] += increment;

    let nextPlayerIndex = (PLAYER_COLORS.indexOf(gameState.currentPlayer) + 1) % 4;
    let nextPlayer = PLAYER_COLORS[nextPlayerIndex];
    while (newEliminated.includes(nextPlayer) && newEliminated.length < 3) {
      nextPlayerIndex = (nextPlayerIndex + 1) % 4;
      nextPlayer = PLAYER_COLORS[nextPlayerIndex];
    }

    // Check for winner
    const remaining = PLAYER_COLORS.filter(p => !newEliminated.includes(p));
    const winner = remaining.length === 1 ? remaining[0] : null;

    setGameState(prev => ({
      ...prev,
      board: newBoard,
      currentPlayer: nextPlayer,
      eliminatedPlayers: newEliminated,
      winner,
      lastMove: { from, to },
      history: [...prev.history, `${piece.player}: ${from.r},${from.c} -> ${to.r},${to.c}`],
      timers: newTimers
    }));
    setSelectedPos(null);
    setValidMoves([]);
  }

  const handleSquareClick = (r: number, c: number) => {
    if (gameState.winner) return;

    const isOurTurn = gameState.currentPlayer === 'green';
    const clickedPiece = gameState.board[r][c];

    // Handle normal move
    if (isOurTurn) {
      if (selectedPos) {
        if (validMoves.some(m => m.r === r && m.c === c)) {
          executeMove(selectedPos, { r, c });
          return;
        }
      }

      if (clickedPiece && clickedPiece.player === 'green') {
        setSelectedPos({ r, c });
        setValidMoves(getMoves({ r, c }, gameState.board));
        // Clear premove if selecting for normal move
        setPremove(null);
      } else {
        setSelectedPos(null);
        setValidMoves([]);
      }
      return;
    }

    // Handle premove
    if (selectedPos) {
      if (clickedPiece && clickedPiece.player === 'green') {
        // Swap selection
        setSelectedPos({ r, c });
        setValidMoves(getMoves({ r, c }, gameState.board, false));
        return;
      }
      
      // Piece already selected, now selecting target for premove
      if (selectedPos.r === r && selectedPos.c === c) {
        // Deselect
        setSelectedPos(null);
        setValidMoves([]);
        setPremove(null);
      } else {
        setPremove({ from: selectedPos, to: { r, c } });
        setSelectedPos(null);
        setValidMoves([]);
      }
    } else {
      // Selecting piece for premove
      if (clickedPiece && clickedPiece.player === 'green' && !gameState.eliminatedPlayers.includes('green')) {
        setSelectedPos({ r, c });
        // Use checkSafety=false for premove visualization? 
        // Usually premoves show "ghost" moves that might be invalid.
        // We'll show standard moves for consistency but with different color.
        setValidMoves(getMoves({ r, c }, gameState.board, false));
      }
    }
  };

  return (
    <div className="h-screen bg-[#161512] text-[#bababa] font-sans flex flex-col overflow-hidden select-none">
      <AnimatePresence mode="wait">
        {!isGameStarted ? (
          <motion.div 
            key="lobby"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-[#1c1b18] relative overflow-hidden"
          >
            {/* Background Decorations */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
               <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(127,166,80,0.1)_0%,transparent_70%)]" />
            </div>

            <div className="w-full max-w-lg z-10">
              <div className="text-center mb-12">
                <motion.div 
                  initial={{ y: -20 }}
                  animate={{ y: 0 }}
                  className="inline-flex items-center gap-3 px-4 py-2 bg-[#262421] border border-[#3c3934] rounded-full mb-6"
                >
                  <Shield className="w-4 h-4 text-[#7fa650]" />
                  <span className="text-[10px] font-black tracking-[0.3em] text-[#9c9a97] uppercase">Tactical Arena v1.0</span>
                </motion.div>
                <h1 className="text-6xl font-black text-white italic tracking-tighter mb-4 uppercase">QUADCHESS</h1>
                <p className="text-sm text-[#9c9a97] uppercase tracking-widest font-bold">Declare your identity before the siege</p>
              </div>

              <div className="bg-[#262421] border-2 border-[#3c3934] p-8 rounded-sm shadow-2xl">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-[#9c9a97] uppercase tracking-widest mb-2 block">Grandmaster Alias</label>
                    <input 
                      type="text" 
                      value={userProfile.name}
                      onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-[#1c1b18] border border-[#3c3934] rounded-sm px-4 py-3 text-white font-mono focus:border-[#7fa650] outline-none transition-colors"
                      placeholder="Enter username..."
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-[10px] font-bold text-[#9c9a97] uppercase tracking-widest block">Experience Level (ELO)</label>
                       <span className="text-xs font-mono text-[#7fa650] font-bold">{userProfile.elo}</span>
                    </div>
                    <input 
                      type="range" 
                      min="400" 
                      max="3000" 
                      step="50"
                      value={userProfile.elo}
                      onChange={(e) => setUserProfile(prev => ({ ...prev, elo: parseInt(e.target.value) }))}
                      className="w-full accent-[#7fa650] h-1.5 bg-[#1c1b18] rounded-full appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-2 px-1">
                      <span className="text-[9px] text-[#9c9a97] font-bold">NOVICE</span>
                      <span className="text-[9px] text-[#9c9a97] font-bold">MAGUS</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#3c3934] space-y-4">
                    <h3 className="text-[10px] font-bold text-[#9c9a97] uppercase tracking-widest flex items-center gap-2">
                       <Shield className="w-3 h-3" />
                       Game Configuration
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] font-bold text-[#9c9a97] uppercase tracking-[0.1em] mb-2 block">Variant</label>
                        <div className="flex gap-2">
                          {(['Blitz', 'Bullet'] as GameType[]).map((type) => (
                            <button
                              key={type}
                              onClick={() => {
                                setLobbySettings(prev => ({ 
                                  type, 
                                  duration: GAME_DURATIONS[type][0] 
                                }));
                              }}
                              className={`flex-1 py-2 text-[10px] font-black tracking-widest rounded-sm border transition-all ${
                                lobbySettings.type === type 
                                  ? 'bg-[#7fa650] border-[#7fa650] text-white shadow-lg shadow-[#7fa650]/20' 
                                  : 'bg-[#1c1b18] border-[#3c3934] text-[#9c9a97] hover:border-[#4a4742]'
                              }`}
                            >
                              {type.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[#9c9a97] uppercase tracking-[0.1em] mb-2 block">Duration</label>
                        <div className="grid grid-cols-2 gap-2">
                          {GAME_DURATIONS[lobbySettings.type].map((dur) => (
                            <button
                              key={dur}
                              onClick={() => setLobbySettings(prev => ({ ...prev, duration: dur }))}
                              className={`py-2 text-[10px] font-mono font-bold rounded-sm border transition-all ${
                                lobbySettings.duration === dur 
                                  ? 'bg-[#7fa650] border-[#7fa650] text-white' 
                                  : 'bg-[#1c1b18] border-[#3c3934] text-[#9c9a97] hover:border-[#4a4742]'
                              }`}
                            >
                              {dur}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#3c3934]">
                    <h3 className="text-[10px] font-bold text-[#9c9a97] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Users className="w-3 h-3" />
                      Opponent Matchmaking
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="bg-[#1c1b18] p-3 border border-[#3c3934] rounded-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Zap className="w-3 h-3 text-blue-500" />
                          <span className="text-xs font-bold text-white/80">3 Randomized Bots</span>
                        </div>
                        <span className="text-[10px] font-mono text-white/40">ELO {userProfile.elo} ± 300</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleStartGame}
                    className="w-full bg-[#7fa650] hover:bg-[#8bb45a] text-white font-black py-4 rounded-sm transition-all active:scale-[0.98] mt-6 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                  >
                    DEPLOY TO FIELD
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="mt-8 flex justify-center gap-8">
                <div className="flex flex-col items-center">
                  <Target className="w-5 h-5 text-red-500 mb-1" />
                  <span className="text-[9px] font-bold font-mono opacity-40 uppercase tracking-widest">FFA MODE</span>
                </div>
                <div className="flex flex-col items-center">
                  <Zap className="w-5 h-5 text-yellow-500 mb-1" />
                  <span className="text-[9px] font-bold font-mono opacity-40 uppercase tracking-widest">{lobbySettings.type} {lobbySettings.duration}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <header className="h-12 bg-[#262421] border-b border-[#3c3934] flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#7fa650] rounded flex items-center justify-center font-bold text-white text-xs">4</div>
                  <h1 className="text-lg font-bold text-white tracking-tight italic uppercase">QUADCHESS</h1>
                </div>
                <div className="h-6 w-px bg-[#3c3934]"></div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 
                    Live Arena
                  </span>
                  <span className="opacity-40">|</span>
                  <span className="font-mono text-[10px] tracking-widest uppercase text-white/40">Grandmaster Series</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={resetGame}
                  className="px-3 py-1 bg-[#3c3934] hover:bg-[#4a4742] text-white text-[10px] font-bold rounded uppercase tracking-wider transition-colors border border-white/5"
                >
                  Return to Lobby
                </button>
              </div>
            </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Game Area */}
        <div className="flex-1 relative flex items-center justify-center bg-[#1c1b18] p-4 lg:p-8">
          
                {/* Player Indicators */}
                {PLAYER_COLORS.map(color => {
                  const profile = gameState.players[color];
                  const isCurrent = gameState.currentPlayer === color;
                  const isEliminated = gameState.eliminatedPlayers.includes(color);
                  const config = COLOR_CONFIG[color];
                  
                  let posClass = "";
                  if (color === 'red') posClass = "absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#262421] p-2 rounded-lg border border-[#3c3934] w-48 shadow-xl z-20";
                  if (color === 'green') posClass = "absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#262421] p-2 rounded-lg border-2 w-48 shadow-xl z-20 transition-all";
                  if (color === 'blue') posClass = "absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-[#262421] p-2 rounded-lg border border-[#3c3934] w-36 shadow-xl z-20 text-center";
                  if (color === 'yellow') posClass = "absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-[#262421] p-2 rounded-lg border border-[#3c3934] w-36 shadow-xl z-20 text-center";

                  return (
                    <div 
                      key={color}
                      className={posClass}
                      style={{ 
                        borderColor: isCurrent ? config.primary : '#3c3934',
                        opacity: isEliminated ? 0.3 : 1,
                        background: (() => {
                          if (!isCurrent) return '';
                          const kPos = getKingPosition(color, gameState.board);
                          if (kPos && isSquareAttacked(kPos, color, gameState.board)) return 'rgba(239, 68, 68, 0.1)';
                          return '';
                        })()
                      }}
                    >
                      <div 
                        className="w-10 h-10 rounded bg-[#333] border flex items-center justify-center text-xl shrink-0"
                        style={{ borderColor: isEliminated ? '#555' : config.primary }}
                      >
                        <PieceIcon type={isEliminated ? 'pawn' : 'king'} color={config.primary} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] font-bold text-white truncate uppercase tracking-tighter">
                            {profile.name}
                          </span>
                          {color === 'green' && premove && (
                            <span className="ml-2 text-[8px] bg-red-900/40 text-red-400 px-1 rounded animate-pulse font-black">PREMOVE</span>
                          )}
                          <span className="text-[8px] font-mono text-[#7fa650] px-1 bg-[#1c1b18] border border-[#3c3934] rounded">
                            {profile.elo}
                          </span>
                        </div>
                        <div className={`text-xl font-mono leading-none ${isCurrent ? 'text-[#7fa650]' : 'text-white/20'}`}>
                          {formatTime(gameState.timers[color])}
                        </div>
                        {isCurrent && (
                          <div className="w-full h-0.5 bg-white/5 mt-1 overflow-hidden">
                            <motion.div 
                              initial={{ width: '100%'}} 
                              animate={{ width: `${Math.min(100, (gameState.timers[color] / parseDuration(gameState.settings.duration).seconds) * 100)}%` }} 
                              transition={{ duration: 0.1, ease: "linear" }}
                              className="h-full bg-[#7fa650]" 
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

          {/* Chess Board */}
          <div 
            className="relative p-1 bg-[#3c3934] rounded shadow-2xl flex items-center justify-center aspect-square"
            style={{ 
              width: 'min(70vh, 70vw)',
            }}
          >
            <div 
              className="grid w-full h-full"
              style={{ 
                gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, 1fr)`,
              }}
            >
              {gameState.board.map((row, r) => 
                row.map((piece, c) => {
                  const playable = isPlayable(r, c);
                  const isOurTurn = gameState.currentPlayer === 'green';
                  const isSelected = selectedPos?.r === r && selectedPos?.c === c;
                  const isValidMove = validMoves.some(m => m.r === r && m.c === c);
                  const isLastMove = gameState.lastMove && (
                    (gameState.lastMove.from.r === r && gameState.lastMove.from.c === c) ||
                    (gameState.lastMove.to.r === r && gameState.lastMove.to.c === c)
                  );
                  const isPremove = premove && (
                    (premove.from.r === r && premove.from.c === c) ||
                    (premove.to.r === r && premove.to.c === c)
                  );
                  
                  // Classic Lichess colors
                  const isDark = (r + c) % 2 === 1;

                  const kingPos = getKingPosition(gameState.currentPlayer, gameState.board);
                  const isInCheck = kingPos && kingPos.r === r && kingPos.c === c && isSquareAttacked(kingPos, gameState.currentPlayer, gameState.board);

                  if (!playable) return <div key={`${r}-${c}`} className="bg-transparent" />;

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleSquareClick(r, c)}
                      className={`
                        relative flex items-center justify-center cursor-pointer
                        ${isDark ? 'bg-[#769656]' : 'bg-[#eeeed2]'}
                        ${isLastMove ? 'after:content-[""] after:absolute after:inset-0 after:bg-yellow-400/30' : ''}
                        ${isPremove ? 'after:content-[""] after:absolute after:inset-0 after:bg-red-400/40 after:mix-blend-overlay' : ''}
                        ${isInCheck ? 'shadow-[inset_0_0_20px_rgba(239,68,68,0.8)]' : ''}
                        hover:after:content-[""] hover:after:absolute hover:after:inset-0 hover:after:bg-black/10
                      `}
                    >
                      {/* Highlight Circle for valid moves */}
                      <AnimatePresence>
                        {isValidMove && (
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className={`absolute z-10 rounded-full ${piece ? 'w-full h-full border-4 border-black/15' : 'w-3 h-3 bg-black/15'} ${!isOurTurn ? 'border-red-400/30 bg-red-400/10' : ''}`} 
                          />
                        )}
                      </AnimatePresence>

                      {/* Selected Overlay */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-yellow-400/40 z-10" />
                      )}

                      {/* Piece */}
                      <AnimatePresence mode="popLayout">
                        {piece && (
                          <motion.div
                            key={piece.id}
                            initial={{ scale: 0.8, opacity: 0, y: -5 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="w-[85%] h-[85%] z-20 flex items-center justify-center pointer-events-none drop-shadow-lg"
                          >
                            <PieceIcon type={piece.type} color={COLOR_CONFIG[piece.player].primary} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Aside / Sidebar */}
        <aside className="w-80 bg-[#262421] flex flex-col shrink-0 border-l border-[#3c3934] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#3c3934]">
            <button className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest text-[#7fa650] border-b-2 border-[#7fa650]">Move History</button>
            <button className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest text-[#9c9a97] hover:text-white transition-colors">Analyis</button>
          </div>

          {/* History Log */}
          <div className="flex-1 overflow-hidden flex flex-col bg-[#1c1b18]">
            <div className="bg-[#262421] text-[10px] font-bold uppercase tracking-tighter grid grid-cols-4 px-4 py-2 border-b border-[#3c3934] text-[#9c9a97]">
              <span>#</span>
              <span>NAME</span>
              <span>COORD</span>
              <span>TIME</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
              {gameState.history.length === 0 ? (
                <div className="p-8 text-center opacity-20 flex flex-col items-center gap-3">
                  <History className="w-8 h-8" />
                  <p className="text-[10px] font-mono tracking-widest">AWAITING FIRST BLOOD</p>
                </div>
              ) : (
                [...gameState.history].reverse().map((entry, idx) => {
                  const parts = entry.split(': ');
                  const player = parts[0] as PlayerColor;
                  const move = parts[1];
                  return (
                    <div 
                      key={idx} 
                      className="grid grid-cols-4 px-3 py-1.5 text-[11px] font-mono border-b border-white/5 hover:bg-white/5 transition-colors group"
                    >
                      <span className="text-white/20 group-hover:text-white/40">{gameState.history.length - idx}</span>
                      <span style={{ color: COLOR_CONFIG[player].primary }} className="font-bold truncate pr-1">
                        {gameState.players[player].name.substring(0, 8)}
                      </span>
                      <span className="text-white/80">{move.split(' -> ')[1]}</span>
                      <span className="text-[#9c9a97] text-[9px]">+0.5s</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Game Chat area like theme */}
          <div className="h-56 bg-[#262421] border-t border-[#3c3934] p-3 flex flex-col gap-2">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#9c9a97] flex items-center gap-2">
              <Users className="w-3 h-3" />
              Arena Chat
            </h2>
            <div className="flex-1 bg-[#1c1b18] border border-[#3c3934] rounded p-2 text-[10px] flex flex-col gap-1.5 overflow-y-auto custom-scrollbar">
              <div className="text-blue-400">
                <span className="font-bold">System:</span> Tournament started. Better luck next time!
              </div>
              <div className="text-white/40 italic">
                Magnus joined the arena.
              </div>
              <div className="text-[#7fa650]">
                <span className="font-bold">Green:</span> Good luck all!
              </div>
              {gameState.eliminatedPlayers.map(p => (
                <div key={`chat-eliminated-${p}`} className="text-red-400">
                  <span className="font-bold">{p.toUpperCase()}:</span> GG, well played.
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Press Enter to chat..."
                className="flex-1 bg-[#1c1b18] border border-[#3c3934] rounded px-3 py-1.5 text-[10px] text-white outline-none focus:border-[#7fa650] transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.value = '')}
              />
              <button className="bg-[#3c3934] hover:bg-[#4a4742] text-white text-[10px] font-bold px-3 rounded transition-colors uppercase">Send</button>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="h-8 bg-[#1f1e1b] border-t border-[#3c3934] flex items-center justify-between px-4 text-[9px] text-[#9c9a97] font-mono tracking-wider">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> ENGINE ONLINE</span>
          <span className="opacity-30">|</span>
          <span>LATENCY: 12ms</span>
          <span className="opacity-30">|</span>
          <span>VARIANT: QUAD CHESS FFA</span>
        </div>
        <div className="flex items-center gap-4">
          <span>PIECES ACTIVE: {gameState.board.flat().filter(p => p !== null).length}</span>
          <span className="opacity-30">|</span>
          <span className="uppercase">{gameState.settings.type} {gameState.settings.duration}</span>
        </div>
      </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Victory Overlay - Redesigned for High Density */}
      <AnimatePresence>
        {gameState.winner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#262421] border border-[#3c3934] rounded-sm p-1 gap-1 flex flex-col max-w-sm w-full shadow-2xl overflow-hidden shadow-[#7fa650]/10"
            >
              <div className="bg-[#1c1b18] p-10 flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <Trophy className="w-20 h-20 text-[#7fa650] drop-shadow-[0_0_20px_rgba(127,166,80,0.4)]" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-4 border border-dashed border-[#7fa650]/20 rounded-full"
                  />
                </div>
                <h2 className="text-4xl font-black text-white italic tracking-tighter mb-2">VICTORY</h2>
                <div className="h-px w-16 bg-[#7fa650] mb-4"></div>
                <p className="text-xs text-[#9c9a97] uppercase tracking-widest mb-10 leading-relaxed">
                  The <span className="text-white font-bold" style={{ color: COLOR_CONFIG[gameState.winner].primary }}>{COLOR_CONFIG[gameState.winner].name.split(' ')[0]}</span> Grandmaster<br/> dominated the battlefield.
                </p>
                <button 
                  onClick={resetGame}
                  className="w-full py-4 bg-[#7fa650] hover:bg-[#8bb45a] text-white font-black text-xs rounded-sm transition-all active:scale-[0.98] uppercase tracking-[0.2em] shadow-lg shadow-[#7fa650]/20"
                >
                  Return to Lobby
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1c1b18;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3c3934;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4a4742;
        }
      `}</style>
    </div>
  );
}
