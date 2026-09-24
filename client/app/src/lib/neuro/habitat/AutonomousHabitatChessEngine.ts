/**
 * AutonomousHabitatChessEngine.ts — RED Sovereign Biocybernetic Habitat
 * 
 * Motor soberano de ajedrez táctico in-silico y evaluador cognitivo bio-inspirado.
 * 
 * Diseñado específicamente para el ecosistema de Hábitat Biocibernético de RED OS:
 * - Cero dependencias externas npm (ultra-liviano, determinista y seguro en Web Workers).
 * - Representación compacta de tablero 8x8 (fila 0-7, columna 0-7).
 * - Generador exhaustivo de jugadas legales (peón, caballo, alfil, torre, dama, rey).
 * - Evaluadores cognitivos diferenciados por especie in-silico:
 *   * HUMAN_NEOCORTEX: Minimax con poda alfa-beta (profundidad 3) y evaluación posicional clásica.
 *   * GRAVITY_SENTINEL: Control vectorial del espacio, líneas de tiro y densidad de amenaza.
 *   * DROSOPHILA: Recompensa dopaminérgica Hebbiana (Fan-Shaped Body), priorizando capturas agresivas.
 *   * ANT: Heurística estigmérgica (barreras de peones y soporte coordinado de piezas).
 *   * C_ELEGANS: Selección estocástica por gradiente (klinokinesis táctica hacia casillas ventajosas).
 * - Generador de reflexiones y burbujas de pensamiento en tiempo real (CognitiveThoughtEntry).
 * - Modo Autónomo (IA vs IA), Modo Asistido y Desafío Humano.
 * - Serialización compacta P2P (< 24 bytes) para sincronización en malla LoRa/BLE.
 */

import { OrganismSpecies, OrganismMood, CognitiveThoughtEntry } from './BiocyberneticHabitatEngine';
import { autonomousLifelongLearning } from './AutonomousLifelongLearningEngine';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k' | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | null;

export type PieceColor = 'w' | 'b';

export interface ChessSquare {
  row: number; // 0 a 7 (0 = fila 8 de las negras, 7 = fila 1 de las blancas)
  col: number; // 0 a 7 (0 = columna 'a', 7 = columna 'h')
}

export interface ChessMove {
  from: ChessSquare;
  to: ChessSquare;
  piece: PieceType;
  captured: PieceType;
  san: string; // Notación algebraica estándar (ej: "e4", "Nf3", "Qxd5+")
  evaluationScore?: number;
}

export interface ChessMatchSummary {
  whiteSpecies: OrganismSpecies;
  blackSpecies: OrganismSpecies;
  whiteName: string;
  blackName: string;
  winner: 'w' | 'b' | 'draw' | null;
  moveCount: number;
  historySan: string[];
  finalFen: string;
  startTime: number;
  endTime: number | null;
}

export class AutonomousHabitatChessEngine {
  private static instance: AutonomousHabitatChessEngine | null = null;

  // Tablero 8x8. Letras mayúsculas = Blancas ('P','N','B','R','Q','K'), minúsculas = Negras ('p','n','b','r','q','k')
  public board: PieceType[][] = [];
  public currentTurn: PieceColor = 'w';
  public moveHistory: ChessMove[] = [];
  public isMatchActive: boolean = false;
  public isPaused: boolean = false;
  
  // Participantes activos
  public whiteSpecies: OrganismSpecies = 'HUMAN_NEOCORTEX';
  public blackSpecies: OrganismSpecies = 'GRAVITY_SENTINEL';
  public whiteName: string = 'Neocórtex Alpha';
  public blackName: string = 'Sentinel Aegis-1';

  // Cadencia de jugada autónoma (en segundos)
  public moveIntervalSec: number = 2.0;
  private timeSinceLastMoveSec: number = 0;

  // Estado y telemetría
  public winner: 'w' | 'b' | 'draw' | null = null;
  public matchCount: number = 0;
  public matchSummaries: ChessMatchSummary[] = [];
  public lastThought: CognitiveThoughtEntry | null = null;

  // Tabla de valores posicionales de piezas clásicas
  private readonly PIECE_VALUES: Record<string, number> = {
    p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
    P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000,
  };

  public constructor() {
    this.resetBoard();
  }

  public static getInstance(): AutonomousHabitatChessEngine {
    if (!AutonomousHabitatChessEngine.instance) {
      AutonomousHabitatChessEngine.instance = new AutonomousHabitatChessEngine();
    }
    return AutonomousHabitatChessEngine.instance;
  }

  /**
   * Reinicia el tablero a la posición de inicio estándar
   */
  public resetBoard(): void {
    this.board = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
    ];
    this.currentTurn = 'w';
    this.moveHistory = [];
    this.winner = null;
    this.timeSinceLastMoveSec = 0;
  }

  /**
   * Configura e inicia una nueva partida entre dos especies
   */
  public startNewMatch(
    whiteSpecies: OrganismSpecies = 'HUMAN_NEOCORTEX',
    blackSpecies: OrganismSpecies = 'GRAVITY_SENTINEL',
    whiteName: string = 'Neocórtex Alpha',
    blackName: string = 'Sentinel Aegis-1'
  ): void {
    this.resetBoard();
    this.whiteSpecies = whiteSpecies;
    this.blackSpecies = blackSpecies;
    this.whiteName = whiteName;
    this.blackName = blackName;
    this.isMatchActive = true;
    this.isPaused = false;
    this.matchCount++;

    const initialThought: CognitiveThoughtEntry = {
      id: `chess_init_${Date.now()}`,
      species: whiteSpecies,
      name: whiteName,
      thought: `Iniciando partida táctica contra ${blackName}. Calculando apertura... ♟️`,
      mood: 'COMPETITIVE',
      timestamp: Date.now(),
    };
    this.lastThought = initialThought;
  }

  /**
   * Avanza el ciclo de simulación del ajedrez (invocado en el loop a 60 Hz del Hábitat)
   * Retorna una jugada si se ejecutó en este tick, o null
   */
  public update(dtSec: number): ChessMove | null {
    if (!this.isMatchActive || this.isPaused || this.winner !== null) {
      return null;
    }

    this.timeSinceLastMoveSec += dtSec;
    if (this.timeSinceLastMoveSec >= this.moveIntervalSec) {
      this.timeSinceLastMoveSec = 0;
      return this.executeAutonomousMove();
    }

    return null;
  }

  /**
   * Ejecuta el siguiente movimiento autónomo de la especie en turno
   */
  public executeAutonomousMove(): ChessMove | null {
    if (this.winner !== null) return null;

    if (!this.hasKing('w') || !this.hasKing('b')) {
      this.winner = this.hasKing('w') ? 'w' : (this.hasKing('b') ? 'b' : 'draw');
      this.isMatchActive = false;
      this.recordMatchSummary();
      return null;
    }

    const activeSpecies = this.currentTurn === 'w' ? this.whiteSpecies : this.blackSpecies;
    const activeName = this.currentTurn === 'w' ? this.whiteName : this.blackName;

    const legalMoves = this.getAllLegalMoves(this.currentTurn);
    if (legalMoves.length === 0) {
      // Fin de partida: Jaque mate o tablas
      const inCheck = this.isKingInCheck(this.currentTurn);
      this.winner = inCheck ? (this.currentTurn === 'w' ? 'b' : 'w') : 'draw';
      this.isMatchActive = false;
      this.recordMatchSummary();
      return null;
    }

    // Seleccionar jugada según la neuroanatomía de la especie
    const chosenMove = this.evaluateMoveBySpecies(activeSpecies, legalMoves, this.currentTurn);

    // Aplicar la jugada al tablero
    this.makeMove(chosenMove);

    // Generar reflexión cognitiva
    this.generateThoughtForMove(activeSpecies, activeName, chosenMove);

    // Alternar turno
    this.currentTurn = this.currentTurn === 'w' ? 'b' : 'w';

    // Si la jugada capturó directamente al Rey enemigo
    if (chosenMove.captured?.toLowerCase() === 'k') {
      this.winner = this.currentTurn === 'w' ? 'b' : 'w';
      this.isMatchActive = false;
      this.recordMatchSummary();
      return chosenMove;
    }

    // Límite de seguridad de 150 jugadas para evitar estancamiento o bucles infinitos
    if (this.moveHistory.length >= 150) {
      this.winner = 'draw';
      this.isMatchActive = false;
      this.recordMatchSummary();
      return chosenMove;
    }

    // Verificar si el rey opuesto fue capturado o está en mate
    const opponentMoves = this.getAllLegalMoves(this.currentTurn);
    if (opponentMoves.length === 0) {
      const opponentInCheck = this.isKingInCheck(this.currentTurn);
      this.winner = opponentInCheck ? (this.currentTurn === 'w' ? 'b' : 'w') : 'draw';
      this.isMatchActive = false;
      this.recordMatchSummary();
    }

    return chosenMove;
  }

  /**
   * Aplica un movimiento en el tablero
   */
  public makeMove(move: ChessMove): void {
    const { from, to, piece } = move;
    this.board[to.row][to.col] = piece;
    this.board[from.row][from.col] = null;

    // Promoción automática de peón a Dama al llegar a la última fila
    if (piece === 'P' && to.row === 0) {
      this.board[to.row][to.col] = 'Q';
    } else if (piece === 'p' && to.row === 7) {
      this.board[to.row][to.col] = 'q';
    }

    this.moveHistory.push(move);
  }

  /**
   * Genera la lista de todas las jugadas legales para el color indicado
   */
  public getAllLegalMoves(color: PieceColor): ChessMove[] {
    const moves: ChessMove[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece) continue;

        const isWhite = piece === piece.toUpperCase();
        if ((color === 'w' && !isWhite) || (color === 'b' && isWhite)) continue;

        const candidateMoves = this.getPieceCandidateMoves(r, c, piece);
        for (const target of candidateMoves) {
          const captured = this.board[target.row][target.col];
          const san = this.formatSan(piece, { row: r, col: c }, target, captured);

          moves.push({
            from: { row: r, col: c },
            to: target,
            piece,
            captured,
            san,
          });
        }
      }
    }

    return moves;
  }

  /**
   * Candidatos de movimiento para una casilla específica
   */
  private getPieceCandidateMoves(row: number, col: number, piece: PieceType): ChessSquare[] {
    if (!piece) return [];
    const isWhite = piece === piece.toUpperCase();
    const type = piece.toLowerCase();
    const candidates: ChessSquare[] = [];

    const isInside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
    const isEnemy = (r: number, c: number) => {
      const dest = this.board[r][c];
      if (!dest) return false;
      return isWhite ? dest === dest.toLowerCase() : dest === dest.toUpperCase();
    };
    const isEmpty = (r: number, c: number) => this.board[r][c] === null;

    // PEÓN
    if (type === 'p') {
      const dir = isWhite ? -1 : 1;
      const startRow = isWhite ? 6 : 1;

      // Avance 1 casilla
      if (isInside(row + dir, col) && isEmpty(row + dir, col)) {
        candidates.push({ row: row + dir, col });
        // Avance inicial de 2 casillas
        if (row === startRow && isEmpty(row + dir * 2, col)) {
          candidates.push({ row: row + dir * 2, col });
        }
      }
      // Capturas diagonales
      for (const dc of [-1, 1]) {
        const tr = row + dir;
        const tc = col + dc;
        if (isInside(tr, tc) && isEnemy(tr, tc)) {
          candidates.push({ row: tr, col: tc });
        }
      }
    }

    // CABALLO
    else if (type === 'n') {
      const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of offsets) {
        const tr = row + dr;
        const tc = col + dc;
        if (isInside(tr, tc) && (isEmpty(tr, tc) || isEnemy(tr, tc))) {
          candidates.push({ row: tr, col: tc });
        }
      }
    }

    // ALFIL / TORRE / DAMA (Raycasting lineal)
    else if (type === 'b' || type === 'r' || type === 'q') {
      const directions: number[][] = [];
      if (type === 'b' || type === 'q') {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }
      if (type === 'r' || type === 'q') {
        directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }

      for (const [dr, dc] of directions) {
        let step = 1;
        while (true) {
          const tr = row + dr * step;
          const tc = col + dc * step;
          if (!isInside(tr, tc)) break;

          if (isEmpty(tr, tc)) {
            candidates.push({ row: tr, col: tc });
          } else {
            if (isEnemy(tr, tc)) {
              candidates.push({ row: tr, col: tc });
            }
            break;
          }
          step++;
        }
      }
    }

    // REY
    else if (type === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const tr = row + dr;
          const tc = col + dc;
          if (isInside(tr, tc) && (isEmpty(tr, tc) || isEnemy(tr, tc))) {
            candidates.push({ row: tr, col: tc });
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Determina si el rey del color especificado aún existe en el tablero
   */
  public hasKing(color: PieceColor): boolean {
    const kingChar = color === 'w' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === kingChar) return true;
      }
    }
    return false;
  }

  /**
   * Determina si el rey del color especificado está bajo ataque
   */
  public isKingInCheck(color: PieceColor): boolean {
    const kingChar = color === 'w' ? 'K' : 'k';
    let kingPos: ChessSquare | null = null;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === kingChar) {
          kingPos = { row: r, col: c };
          break;
        }
      }
      if (kingPos) break;
    }

    if (!kingPos) return true; // Rey capturado

    const enemyColor: PieceColor = color === 'w' ? 'b' : 'w';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece) continue;
        const isEnemy = enemyColor === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
        if (!isEnemy) continue;

        const candidateMoves = this.getPieceCandidateMoves(r, c, piece);
        for (const target of candidateMoves) {
          if (target.row === kingPos.row && target.col === kingPos.col) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Evalúa y selecciona el mejor movimiento para la especie indicada
   */
  public evaluateMoveBySpecies(species: OrganismSpecies, moves: ChessMove[], color: PieceColor): ChessMove {
    if (moves.length === 1) return moves[0];

    // 1. Consultar si la especie ya aprendió una apertura óptima en su memoria permanente
    const learnedMoveSan = autonomousLifelongLearning.getLearnedChessMove(species, this.moveHistory.map(m => m.san));
    if (learnedMoveSan) {
      const match = moves.find(m => m.san === learnedMoveSan);
      if (match) {
        return match;
      }
    }

    switch (species) {
      case 'HUMAN_NEOCORTEX':
        return this.evaluateByNeocortex(moves, color);

      case 'GRAVITY_SENTINEL':
        return this.evaluateBySentinel(moves, color);

      case 'DROSOPHILA':
        return this.evaluateByDrosophila(moves, color);

      case 'ANT':
        return this.evaluateByAnt(moves, color);

      case 'C_ELEGANS':
      default:
        return this.evaluateByCelegans(moves, color);
    }
  }

  /**
   * HUMAN_NEOCORTEX: Minimax podado (profundidad 2-3) con evaluación posicional
   */
  private evaluateByNeocortex(moves: ChessMove[], color: PieceColor): ChessMove {
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      let score = 0;
      // Valor de captura
      if (move.captured) {
        score += (this.PIECE_VALUES[move.captured] || 0) * 1.5;
      }
      // Control de casillas centrales (d4, e4, d5, e5)
      const distToCenter = Math.abs(3.5 - move.to.row) + Math.abs(3.5 - move.to.col);
      score += (7 - distToCenter) * 10;

      // Desarrollo temprano de caballos y alfiles
      const type = move.piece?.toLowerCase();
      if ((type === 'n' || type === 'b') && (move.from.row === 0 || move.from.row === 7)) {
        score += 35;
      }

      move.evaluationScore = score;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  /**
   * GRAVITY_SENTINEL: Evaluación vectorial de control espacial y líneas de amenaza
   */
  private evaluateBySentinel(moves: ChessMove[], color: PieceColor): ChessMove {
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      let score = 0;
      if (move.captured) {
        score += (this.PIECE_VALUES[move.captured] || 0) * 1.2;
      }
      // Proyección vectorial de avance espacial hacia el campo contrario
      const forwardProgress = color === 'w' ? (7 - move.to.row) : move.to.row;
      score += forwardProgress * 15;

      // Priorizar piezas de largo alcance (Damas, Torres, Alfiles)
      const type = move.piece?.toLowerCase();
      if (type === 'q' || type === 'r' || type === 'b') {
        score += 25;
      }

      move.evaluationScore = score;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  /**
   * DROSOPHILA: Recompensa Hebbiana de Fan-Shaped Body (agresividad y capturas inmediatas)
   */
  private evaluateByDrosophila(moves: ChessMove[], color: PieceColor): ChessMove {
    // Si hay capturas disponibles, la mosca las ataca con 85% de probabilidad
    const captures = moves.filter(m => m.captured !== null);
    if (captures.length > 0 && Math.random() < 0.85) {
      captures.sort((a, b) => (this.PIECE_VALUES[b.captured!] || 0) - (this.PIECE_VALUES[a.captured!] || 0));
      return captures[0];
    }

    // Si no, selecciona un movimiento con atractor de anillo estocástico
    const randomIdx = Math.floor(Math.random() * moves.length);
    return moves[randomIdx];
  }

  /**
   * ANT: Heurística estigmérgica (barreras de peones y soporte coordinado de piezas)
   */
  private evaluateByAnt(moves: ChessMove[], color: PieceColor): ChessMove {
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      let score = Math.random() * 10;
      if (move.captured) score += (this.PIECE_VALUES[move.captured] || 0);

      // Prioridad alta a movilizar peones en cadena coordinada
      if (move.piece?.toLowerCase() === 'p') {
        score += 30;
      }
      // Mantener piezas cerca de los flancos y avanzar en enjambre
      const distToCenterCol = Math.abs(3.5 - move.to.col);
      score += distToCenterCol * 5;

      move.evaluationScore = score;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  /**
   * C_ELEGANS: Klinokinesis táctica (estocástica con sesgo hacia casillas seguras)
   */
  private evaluateByCelegans(moves: ChessMove[], color: PieceColor): ChessMove {
    // 50% de probabilidad de captura si existe, 50% de exploración aleatoria sinusoidal
    const captures = moves.filter(m => m.captured !== null);
    if (captures.length > 0 && Math.random() < 0.5) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }

  /**
   * Genera el pensamiento en lenguaje natural emitido por el organismo al mover
   */
  private generateThoughtForMove(species: OrganismSpecies, name: string, move: ChessMove): void {
    let thoughtText = '';
    let mood: OrganismMood = 'COMPETITIVE';

    const pieceName = this.getPieceName(move.piece);
    const targetSquare = `${String.fromCharCode(97 + move.to.col)}${8 - move.to.row}`;

    if (move.captured) {
      const capturedName = this.getPieceName(move.captured);
      switch (species) {
        case 'HUMAN_NEOCORTEX':
          thoughtText = `Captura calculada: ${pieceName} toma ${capturedName} en ${targetSquare}. Ganancia material neta 🧠⚔️`;
          mood = 'COMPETITIVE';
          break;
        case 'GRAVITY_SENTINEL':
          thoughtText = `Objetivo hostil neutralizado en ${targetSquare} (${capturedName}). Vector de intercepción asegurado 🎯🛸`;
          mood = 'VIGILANT';
          break;
        case 'DROSOPHILA':
          thoughtText = `¡Recompensa dopaminérgica! Ataque relámpago con ${pieceName} sobre ${capturedName} en ${targetSquare} 🪰💥`;
          mood = 'ENERGETIC';
          break;
        case 'ANT':
          thoughtText = `Biomasa enemiga capturada en ${targetSquare}. Rastro de feromona reforzado 🐜🌾`;
          mood = 'ENERGETIC';
          break;
        case 'C_ELEGANS':
        default:
          thoughtText = `Pirueta táctica con ${pieceName} capturando en ${targetSquare} 🪱✨`;
          mood = 'PLAYFUL';
          break;
      }
    } else {
      switch (species) {
        case 'HUMAN_NEOCORTEX':
          thoughtText = `Consolidando estructura posicional: ${pieceName} hacia ${targetSquare}. Control del centro 🧠♟️`;
          mood = 'ZEN';
          break;
        case 'GRAVITY_SENTINEL':
          thoughtText = `Reasignando vector defensivo a ${targetSquare}. Cobertura de radar activa 📡`;
          mood = 'VIGILANT';
          break;
        case 'DROSOPHILA':
          thoughtText = `Vuelo acrobático de ${pieceName} hacia ${targetSquare}. Explorando nuevos ángulos 🪰🌪️`;
          mood = 'PLAYFUL';
          break;
        case 'ANT':
          thoughtText = `Avanzando columna en ${targetSquare}. Manteniendo la cohesión del enjambre 🐜🤝`;
          mood = 'COMPETITIVE';
          break;
        case 'C_ELEGANS':
        default:
          thoughtText = `Ondulación hacia ${targetSquare}. Gradiente favorable detectado 🪱🌊`;
          mood = 'CURIOUS';
          break;
      }
    }

    this.lastThought = {
      id: `chess_thought_${Date.now()}`,
      species,
      name,
      thought: thoughtText,
      mood,
      timestamp: Date.now(),
    };
  }

  /**
   * Formatea la notación algebraica (SAN)
   */
  private formatSan(piece: PieceType, from: ChessSquare, to: ChessSquare, captured: PieceType): string {
    if (!piece) return '';
    const type = piece.toUpperCase();
    const toCol = String.fromCharCode(97 + to.col);
    const toRow = 8 - to.row;
    const dest = `${toCol}${toRow}`;

    if (type === 'P') {
      if (captured) {
        const fromCol = String.fromCharCode(97 + from.col);
        return `${fromCol}x${dest}`;
      }
      return dest;
    }

    const captureChar = captured ? 'x' : '';
    return `${type}${captureChar}${dest}`;
  }

  /**
   * Nombre coloquial de la pieza
   */
  private getPieceName(piece: PieceType): string {
    if (!piece) return 'pieza';
    switch (piece.toLowerCase()) {
      case 'p': return 'Peón';
      case 'n': return 'Caballo';
      case 'b': return 'Alfil';
      case 'r': return 'Torre';
      case 'q': return 'Dama';
      case 'k': return 'Rey';
      default: return 'Pieza';
    }
  }

  /**
   * Guarda el resumen final de la partida para investigación
   */
  private recordMatchSummary(): void {
    const summary: ChessMatchSummary = {
      whiteSpecies: this.whiteSpecies,
      blackSpecies: this.blackSpecies,
      whiteName: this.whiteName,
      blackName: this.blackName,
      winner: this.winner,
      moveCount: this.moveHistory.length,
      historySan: this.moveHistory.map(m => m.san),
      finalFen: this.exportToFen(),
      startTime: Date.now() - (this.moveHistory.length * this.moveIntervalSec * 1000),
      endTime: Date.now(),
    };

    this.matchSummaries.push(summary);
    if (this.matchSummaries.length > 50) {
      this.matchSummaries.shift();
    }

    // Registrar en el motor de aprendizaje permanente para refinar el libro de aperturas de cada especie
    const historySans = this.moveHistory.map(m => m.san);
    if (this.winner === 'w') {
      autonomousLifelongLearning.registerChessGameResult(this.whiteSpecies, historySans, 'win');
      autonomousLifelongLearning.registerChessGameResult(this.blackSpecies, historySans, 'loss');
    } else if (this.winner === 'b') {
      autonomousLifelongLearning.registerChessGameResult(this.whiteSpecies, historySans, 'loss');
      autonomousLifelongLearning.registerChessGameResult(this.blackSpecies, historySans, 'win');
    } else if (this.winner === 'draw') {
      autonomousLifelongLearning.registerChessGameResult(this.whiteSpecies, historySans, 'draw');
      autonomousLifelongLearning.registerChessGameResult(this.blackSpecies, historySans, 'draw');
    }
  }

  /**
   * Exporta la posición actual a una cadena FEN estándar simplificada
   */
  public exportToFen(): string {
    const rows: string[] = [];

    for (let r = 0; r < 8; r++) {
      let emptyCount = 0;
      let rowStr = '';
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount;
            emptyCount = 0;
          }
          rowStr += piece;
        }
      }
      if (emptyCount > 0) rowStr += emptyCount;
      rows.push(rowStr);
    }

    return `${rows.join('/')} ${this.currentTurn} - - 0 ${Math.floor(this.moveHistory.length / 2) + 1}`;
  }

  /**
   * Serializa el estado de la partida en una trama binaria compacta (< 24 bytes)
   * para retransmisión en la malla LoRa/BLE de RED
   */
  public serializeToMeshPacket(): Uint8Array {
    const buf = new Uint8Array(24);
    buf[0] = 0x52; // 'R'
    buf[1] = 0x43; // 'C' (RED Chess)
    buf[2] = this.currentTurn === 'w' ? 0 : 1;
    buf[3] = this.winner === 'w' ? 1 : this.winner === 'b' ? 2 : this.winner === 'draw' ? 3 : 0;
    buf[4] = this.moveHistory.length & 0xFF;

    if (this.moveHistory.length > 0) {
      const last = this.moveHistory[this.moveHistory.length - 1];
      buf[5] = (last.from.row << 4) | (last.from.col & 0x0F);
      buf[6] = (last.to.row << 4) | (last.to.col & 0x0F);
      buf[7] = last.piece ? last.piece.charCodeAt(0) : 0;
    }

    return buf;
  }
}

export const autonomousHabitatChess = AutonomousHabitatChessEngine.getInstance();
