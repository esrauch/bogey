// ── Canvas rendering ────────────────────────────────────────

import { Card, Suit, rankLabel, suitSymbol, suitColor } from './card.js';
import { GameState, MAX_COLUMNS, getWinRating, getValidColumns, canBogeyPlay } from './game.js';

// ── Layout constants (in logical pixels, scaled to canvas) ──

const CARD_W = 70;
const CARD_H = 100;
const CARD_RADIUS = 8;
const CARD_GAP = 8;
const ROW_OFFSET_X = 38; // horizontal overlap within a row
const ROW_GAP = 4; // vertical gap between rows
const HAND_Y_OFFSET = 70; // spacing from bottom of canvas (room for buttons below hand)

// ── Colors ──────────────────────────────────────────────────

const TABLE_COLOR_TOP = '#1a472a';
const TABLE_COLOR_BOT = '#0d2818';
const CARD_BG = '#fdf6e3';
const CARD_BACK_1 = '#2c5f8a';
const CARD_BACK_2 = '#1e3f5a';
const ACCENT_GOLD = '#d4a847';
const VALID_GLOW = 'rgba(100, 220, 120, 0.5)';
const SELECTED_GLOW = 'rgba(212, 168, 71, 0.7)';
const BOGEY_GLOW = 'rgba(220, 80, 80, 0.6)';

// ── Cached layout ───────────────────────────────────────────

export interface Layout {
  scale: number;
  logicalW: number;
  logicalH: number;
  columnsStartX: number;
  columnsStartY: number;
  handStartY: number;
  deckX: number;
  deckY: number;
  discardX: number;
  discardY: number;
}

export interface ButtonRect {
  x: number; y: number; w: number; h: number; label: string; id: string;
  color?: string;
}

export interface CardHitArea {
  x: number; y: number; w: number; h: number;
  type: 'hand' | 'column' | 'new_column';
  index: number; // hand index or column index
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  layout!: Layout;
  buttons: ButtonRect[] = [];
  cardHitAreas: CardHitArea[] = [];
  discardPileArea: { x: number; y: number; w: number; h: number } | null = null;
  private noisePattern: CanvasPattern | null = null;
  private frameCount = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.updateLayout();
    this.createNoisePattern();
  }

  updateLayout(): void {
    const dpr = window.devicePixelRatio || 1;
    const container = this.canvas.parentElement!;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.layout = {
      scale: 1,
      logicalW: w,
      logicalH: h,
      columnsStartX: 30,
      columnsStartY: 60,
      handStartY: h - CARD_H - HAND_Y_OFFSET,
      deckX: 10,
      deckY: h - CARD_H - HAND_Y_OFFSET,
      discardX: 10,
      discardY: h - CARD_H - HAND_Y_OFFSET + CARD_W + 6,
    };
  }

  private createNoisePattern(): void {
    const size = 128;
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const octx = offscreen.getContext('2d')!;
    const imgData = octx.createImageData(size, size);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 20;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 15;
    }
    octx.putImageData(imgData, 0, 0);
    this.noisePattern = this.ctx.createPattern(offscreen, 'repeat');
  }

  // ── Drawing primitives ──────────────────────────────────────

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  drawTable(): void {
    const ctx = this.ctx;
    const { logicalW, logicalH } = this.layout;

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, logicalH);
    grad.addColorStop(0, TABLE_COLOR_TOP);
    grad.addColorStop(1, TABLE_COLOR_BOT);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, logicalW, logicalH);

    // Noise texture overlay
    if (this.noisePattern) {
      ctx.fillStyle = this.noisePattern;
      ctx.fillRect(0, 0, logicalW, logicalH);
    }

    // Subtle radial vignette
    const vignette = ctx.createRadialGradient(
      logicalW / 2, logicalH / 2, logicalH * 0.3,
      logicalW / 2, logicalH / 2, logicalH * 0.9
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, logicalW, logicalH);
  }

  drawCardFace(x: number, y: number, card: Card, opts?: {
    selected?: boolean;
    validTarget?: boolean;
    bogeyCard?: boolean;
    compact?: boolean;
    scale?: number;
    alpha?: number;
  }): void {
    const ctx = this.ctx;
    const scale = opts?.scale ?? 1;
    const alpha = opts?.alpha ?? 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    const compact = opts?.compact ?? false;
    const baseW = compact ? CARD_W : CARD_W;
    const baseH = compact ? CARD_W : CARD_H; // square when compact
    const sw = baseW * scale;
    const sh = baseH * scale;
    const sx = x;
    const sy = y;

    // Cheap shadow: dark rect behind card (no blur)
    this.roundRect(sx + 2, sy + 3, sw, sh, CARD_RADIUS * scale);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();

    // Card body
    this.roundRect(sx, sy, sw, sh, CARD_RADIUS * scale);
    ctx.fillStyle = CARD_BG;
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Glow effects (colored borders, no shadowBlur)
    if (opts?.selected) {
      this.roundRect(sx - 2, sy - 2, sw + 4, sh + 4, (CARD_RADIUS + 2) * scale);
      ctx.strokeStyle = SELECTED_GLOW;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (opts?.bogeyCard) {
      this.roundRect(sx - 2, sy - 2, sw + 4, sh + 4, (CARD_RADIUS + 2) * scale);
      ctx.strokeStyle = BOGEY_GLOW;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (opts?.validTarget) {
      this.roundRect(sx - 2, sy - 2, sw + 4, sh + 4, (CARD_RADIUS + 2) * scale);
      ctx.strokeStyle = VALID_GLOW;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Card content
    const color = suitColor(card.suit);
    const rank = rankLabel(card.rank);
    const suit = suitSymbol(card.suit);

    if (opts?.compact) {
      // Compact mode: bold "K♠" filling the square
      ctx.fillStyle = color;
      ctx.font = `bold ${sw * 0.38}px 'Inter', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${rank}${suit}`, sx + sw / 2, sy + sh / 2);
    } else {
      // Full card: top-left rank + suit
      ctx.fillStyle = color;
      ctx.font = `bold ${14 * scale}px 'Inter', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(rank, sx + 5 * scale, sy + 5 * scale);
      ctx.font = `${12 * scale}px sans-serif`;
      ctx.fillText(suit, sx + 5 * scale, sy + 20 * scale);

      // Center suit symbol (large)
      ctx.font = `${28 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(suit, sx + sw / 2, sy + sh / 2);

      // Bottom-right rank + suit (inverted)
      ctx.save();
      ctx.translate(sx + sw - 5 * scale, sy + sh - 5 * scale);
      ctx.rotate(Math.PI);
      ctx.font = `bold ${14 * scale}px 'Inter', sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(rank, 0, 0);
      ctx.font = `${12 * scale}px sans-serif`;
      ctx.fillText(suit, 0, 15 * scale);
      ctx.restore();
    }

    ctx.restore();
  }

  drawCardBack(x: number, y: number, scale: number = 1, square: boolean = false): void {
    const ctx = this.ctx;
    const sw = CARD_W * scale;
    const sh = (square ? CARD_W : CARD_H) * scale;
    const sx = x;
    const sy = y;

    ctx.save();

    // Cheap shadow: dark rect behind card (no blur)
    this.roundRect(sx + 2, sy + 3, sw, sh, CARD_RADIUS * scale);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();

    this.roundRect(sx, sy, sw, sh, CARD_RADIUS * scale);
    const grad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    grad.addColorStop(0, CARD_BACK_1);
    grad.addColorStop(1, CARD_BACK_2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Diamond pattern on back
    const inset = 6 * scale;
    this.roundRect(sx + inset, sy + inset, sw - inset * 2, sh - inset * 2, (CARD_RADIUS - 2) * scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner pattern — small diamonds
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    const step = 10 * scale;
    for (let px = sx + inset; px < sx + sw - inset; px += step) {
      for (let py = sy + inset; py < sy + sh - inset; py += step) {
        ctx.beginPath();
        ctx.moveTo(px + step / 2, py);
        ctx.lineTo(px + step, py + step / 2);
        ctx.lineTo(px + step / 2, py + step);
        ctx.lineTo(px, py + step / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawEmptySlot(x: number, y: number, label: string, highlight: boolean = false, square: boolean = false): void {
    const ctx = this.ctx;
    const slotW = CARD_W;
    const slotH = square ? CARD_W : CARD_H;
    ctx.save();

    this.roundRect(x, y, slotW, slotH, CARD_RADIUS);
    ctx.strokeStyle = highlight ? 'rgba(100, 220, 120, 0.6)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = highlight ? 2 : 1;
    ctx.setLineDash(highlight ? [] : [4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (highlight) {
      this.roundRect(x, y, slotW, slotH, CARD_RADIUS);
      ctx.fillStyle = 'rgba(100, 220, 120, 0.08)';
      ctx.fill();
    }

    ctx.fillStyle = highlight ? 'rgba(100, 220, 120, 0.7)' : 'rgba(255,255,255,0.25)';
    ctx.font = "12px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + slotW / 2, y + slotH / 2);

    ctx.restore();
  }

  // ── High-level scene drawing ──────────────────────────────

  drawButton(btn: ButtonRect): void {
    const ctx = this.ctx;
    ctx.save();

    const baseColor = btn.color ?? ACCENT_GOLD;

    this.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
    ctx.fillStyle = baseColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = btn.color === '#c0392b' ? '#fff' : '#1a1a2e';
    ctx.font = "600 13px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);

    ctx.restore();
  }

  renderMenu(): void {
    const ctx = this.ctx;
    const { logicalW, logicalH } = this.layout;

    this.drawTable();

    // Title
    ctx.fillStyle = ACCENT_GOLD;
    ctx.font = "bold 48px 'Playfair Display', Georgia, serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('The Bogey', logicalW / 2, logicalH * 0.25);

    // Subtitle
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = "16px 'Inter', sans-serif";
    // Difficulty buttons
    const btnW = 200;
    const btnH = 50;
    const btnX = logicalW / 2 - btnW / 2;

    this.buttons = [
      {
        x: btnX, y: logicalH * 0.40, w: btnW, h: btnH,
        label: '? Tutorial', id: 'tutorial',
        color: '#5a7d8a',
      },
      {
        x: btnX, y: logicalH * 0.40 + btnH + 15, w: btnW, h: btnH,
        label: '♠  Play', id: 'normal',
      },
    ];

    for (const btn of this.buttons) {
      this.drawButton(btn);
    }
  }

  renderGame(state: GameState, selectedHandIndex: number | null, placingHandIndex: number | null): void {
    const ctx = this.ctx;
    const { logicalW, logicalH } = this.layout;

    this.drawTable();
    this.buttons = [];
    this.cardHitAreas = [];

    // ── Top bar (two rows) ────────────────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, logicalW, 30);

    // Row 1: Title
    ctx.fillStyle = ACCENT_GOLD;
    ctx.font = "bold 14px 'Inter', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('The Bogey', 10, 16);

    // ── Columns (rendered as horizontal rows) ─────────────────
    const startX = this.layout.columnsStartX;
    const startY = this.layout.columnsStartY;

    // Determine which card we're placing (for highlighting)
    const activeHandIndex = placingHandIndex ?? selectedHandIndex;
    const placingCard = activeHandIndex !== null ? state.hand[activeHandIndex] : state.bogeyCard;
    const isPlacingPhase = activeHandIndex !== null || state.phase === 'bogey_place';
    const validCols = placingCard ? getValidColumns(placingCard, state.columns) : [];

    // Compute row dimensions to fit available vertical space
    const handY = this.layout.handStartY;
    const availableH = handY - startY - 20; // leave some padding above hand
    const totalRows = Math.max(state.columns.length + 1, 1);
    // Compact cards are square (CARD_W x CARD_W)
    const maxRowH = CARD_W + ROW_GAP;
    const rowH = Math.min(maxRowH, availableH / totalRows);
    const cardScale = Math.min(1, (rowH - ROW_GAP) / CARD_W);
    const scaledCardSize = CARD_W * cardScale; // square: same width and height
    const labelW = 10; // space for row number label
    const rowStartX = startX + labelW;

    for (let colIdx = 0; colIdx < state.columns.length; colIdx++) {
      const col = state.columns[colIdx];
      const ry = startY + colIdx * rowH;
      const isValid = isPlacingPhase && validCols.includes(colIdx);

      // Row label
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = `${20 * cardScale}px 'Inter', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${colIdx + 1}`, rowStartX - 10, ry + scaledCardSize / 2);

      if (col.length === 0) {
        this.drawEmptySlot(rowStartX, ry, 'empty', isValid, true);
        this.cardHitAreas.push({ x: rowStartX, y: ry, w: scaledCardSize, h: scaledCardSize, type: 'column', index: colIdx });
      } else {
        for (let ci = 0; ci < col.length; ci++) {
          const cx = rowStartX + ci * ROW_OFFSET_X * cardScale;
          const isLastCard = ci === col.length - 1;
          this.drawCardFace(cx, ry, col[ci], {
            validTarget: isValid && isLastCard,
            compact: true,
            scale: cardScale,
          });
          if (isLastCard) {
            this.cardHitAreas.push({
              x: cx, y: ry, w: scaledCardSize, h: scaledCardSize,
              type: 'column', index: colIdx,
            });
          }
        }
      }
    }

    // New row slot
    if (state.columns.length < MAX_COLUMNS) {
      const ry = startY + state.columns.length * rowH;
      const isValid = isPlacingPhase && validCols.includes(state.columns.length);
      this.drawEmptySlot(rowStartX, ry, '+', isValid, true);
      this.cardHitAreas.push({
        x: rowStartX, y: ry, w: scaledCardSize, h: scaledCardSize,
        type: 'new_column', index: state.columns.length,
      });
    }

    // ── Deck & discard (compact squares, stacked vertically) ──
    const deckX = 10;
    const deckY = handY;
    const discardY = deckY + CARD_W + 16;

    // Deck
    if (state.deck.length > 0) {
      this.drawCardBack(deckX, deckY, 1, true);
      // Count overlay inside
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = "bold 14px 'Inter', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(state.deck.length), deckX + CARD_W / 2, deckY + CARD_W / 2);
    } else {
      this.drawEmptySlot(deckX, deckY, 'Deck', false, true);
    }
    // Deck label
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = "9px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('Deck', deckX + CARD_W / 2, deckY - 5);

    // Discard (clickable to discard selected card)
    const canDiscardCard = selectedHandIndex !== null && placingHandIndex === null && state.phase === 'player_turn';
    if (state.discardPile.length > 0) {
      this.drawCardFace(deckX, discardY, state.discardPile[state.discardPile.length - 1], { compact: true, validTarget: canDiscardCard });
    } else {
      this.drawEmptySlot(deckX, discardY, 'Empty', canDiscardCard, true);
    }
    // Discard label
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = "9px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('Discard', deckX + CARD_W / 2, discardY - 5);
    // Store discard pile bounds for click detection
    this.discardPileArea = { x: deckX, y: discardY, w: CARD_W, h: CARD_H };

    // ── Hand area (to the right of deck/discard) ──────────────
    const handAreaX = deckX + CARD_W + 15;
    const handSpacing = Math.min(CARD_W + 12, (logicalW - handAreaX - 20) / Math.max(state.hand.length, 1));

    // Hand label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = "11px 'Inter', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(`Hand (${state.hand.length}/${state.handSize})`, handAreaX, handY - 8);

    for (let i = 0; i < state.hand.length; i++) {
      const hx = handAreaX + i * handSpacing;
      const isSelected = selectedHandIndex === i;
      const isPlacing = placingHandIndex === i;
      this.drawCardFace(hx, handY, state.hand[i], {
        selected: isSelected || isPlacing,
      });
      this.cardHitAreas.push({
        x: hx, y: handY, w: CARD_W, h: CARD_H,
        type: 'hand', index: i,
      });
    }

    // ── Bogey's card (floating, during bogey_place or bogey_loss) ───────────
    if ((state.phase === 'bogey_place' || state.phase === 'bogey_loss') && state.bogeyCard) {
      const bx = logicalW / 2 - CARD_W / 2;
      const by = handY - CARD_W - 20;
      ctx.textAlign = 'center';
      if (state.phase === 'bogey_place') {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = "12px 'Inter', sans-serif";
        ctx.fillText("Bogey's card — tap a row", logicalW / 2, by - 8);
      } else {
        ctx.fillStyle = '#e74c3c';
        ctx.font = "bold 13px 'Inter', sans-serif";
        ctx.fillText("No moves for Bogey! Tap to continue...", logicalW / 2, by - 8);
      }
      this.drawCardFace(bx, by, state.bogeyCard, { bogeyCard: true, compact: true });
    }

    // ── Action buttons ────────────────────────────────────────
    const btnY = handY + CARD_H + 12;
    let btnX = handAreaX;

    if (state.phase === 'player_turn') {
      this.buttons.push({
        x: logicalW - 130, y: btnY, w: 110, h: 32,
        label: '⏭ End Turn', id: 'end_turn',
      });
    }

    // Resign button (in top bar, visible during play)
    if (state.phase === 'player_turn' || state.phase === 'bogey_place') {
      this.buttons.push({
        x: logicalW - 80, y: 2, w: 70, h: 26,
        label: 'Resign', id: 'resign', color: '#8b3a3a',
      });
    }

    // Undo button
    if (state.phase === 'player_turn' && !state.hasDrawnThisTurn && state.undoStack.length > 0) {
      this.buttons.push({
        x: logicalW - 215, y: btnY, w: 75, h: 32,
        label: '↩ Undo', id: 'undo',
      });
    }

    for (const btn of this.buttons) {
      this.drawButton(btn);
    }

    // ── Message flash ─────────────────────────────────────────
    if (state.message && state.messageTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.messageTimer / 30);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const tw = ctx.measureText(state.message).width + 40;
      this.roundRect(logicalW / 2 - tw / 2, logicalH / 4 - 20, tw, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = "14px 'Inter', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(state.message, logicalW / 2, logicalH / 4);
      ctx.restore();
    }

    this.frameCount++;
  }

  renderEndScreen(state: GameState): void {
    const ctx = this.ctx;
    const { logicalW, logicalH } = this.layout;

    this.drawTable();
    this.buttons = [];

    const isWin = state.phase === 'game_won';
    const centerY = logicalH * 0.35;

    // Title
    ctx.fillStyle = isWin ? ACCENT_GOLD : '#e74c3c';
    ctx.font = "bold 42px 'Playfair Display', Georgia, serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isWin ? 'Victory!' : 'Game Over', logicalW / 2, centerY);

    if (isWin) {
      const rating = getWinRating(state.columns.length);
      ctx.fillStyle = '#fff';
      ctx.font = "24px 'Inter', sans-serif";
      ctx.fillText(rating, logicalW / 2, centerY + 50);
    }

    // Stats
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = "15px 'Inter', sans-serif";
    const stats = [
      `Columns used: ${state.columns.length}`,
      `Turns played: ${state.turnNumber}`,
      `Cards played: ${state.cardsPlayed}`,
      `Cards discarded: ${state.cardsDiscarded}`,
    ];
    if (!isWin && state.message) {
      stats.push(state.message);
    }
    stats.forEach((s, i) => {
      ctx.fillText(s, logicalW / 2, centerY + (isWin ? 100 : 60) + i * 28);
    });

    // Play again button
    const btnW = 180;
    const btnH = 50;
    this.buttons = [{
      x: logicalW / 2 - btnW / 2,
      y: logicalH * 0.78,
      w: btnW, h: btnH,
      label: '♠ Play Again', id: 'restart',
    }];
    for (const btn of this.buttons) {
      this.drawButton(btn);
    }
  }

  hitTestButton(x: number, y: number): ButtonRect | null {
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        return btn;
      }
    }
    return null;
  }

  hitTestCard(x: number, y: number): CardHitArea | null {
    // Check in reverse order so topmost cards are hit first
    for (let i = this.cardHitAreas.length - 1; i >= 0; i--) {
      const area = this.cardHitAreas[i];
      if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
        return area;
      }
    }
    return null;
  }

  renderTutorialOverlay(state: GameState, tutorialStep: number): void {
    const ctx = this.ctx;
    const { logicalW, logicalH } = this.layout;

    // Darken the background slightly
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, logicalW, logicalH);

    // Context-aware tutorial panel
    const panelW = 380;
    const panelH = 200;
    const panelX = logicalW - panelW - 20;
    const panelY = 350;

    // Panel background
    this.roundRect(panelX, panelY, panelW, panelH, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fill();

    // Tutorial content based on step
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = "13px 'Inter', sans-serif";
    ctx.textAlign = 'left';

    let title = '';
    let text = '';
    switch (tutorialStep) {
      case 0:
        title = 'Welcome to The Bogey!';
        text = 'Click anywhere to begin the interactive tutorial.';
        break;
      case 1:
        title = 'Objective of the game';
        text = 'Your goal is to place all 52 cards into piles.\n\n' +
          'Each pile may contain only one suit.\n\n' +
          'Piles must be in descending order (K-Q-..-3-2-A).\n\n' +
          'You may have at most 12 piles.';
        break;
      case 2:
        title = 'Your turn';
        text = 'At the start of each turn, your hand refills\n\n' +
          'You may play a card into a pile or discard it.\n\n' +
          'You may keep cards to use in a later turn.';
        break;
      case 3:
        title = 'The Bogey';
        text = 'After your turn, the Bogey will force you to play\nthe top card of the deck.\n\n' +
          'If the Bogey card cannot be placed, it\'s game over!';
        break;
      case 4:
        title = 'Step 1: Play the Queen';
        text = 'Click the Queen of Spades to select it.\n\n' +
          'Then click the empty area below the table to\n' +
          'start a new pile. (Click the "+" area.)';
        break;
      case 5:
        title = 'Step 2: Stack the Jack';
        text = 'Now click the Jack of Spades.\n\n' +
          'Then click on the Queen pile below it.\n\n' +
          'Cards must be same suit and lower rank.';
        break;
      case 6:
        title = 'Step 3: Your Options';
        text = 'You can now:\n\n' +
          '• Play remaining cards to piles\n' +
          '• Discard cards to the pile on the left\n' +
          '• Click End Turn to proceed';
        break;
      case 7:
        title = 'The Bogey\'s Turn';
        text = 'The Bogey now draws a card and plays it.\n\n' +
          'It will force a play, so choose wisely\n' +
          'where to place its card!\n\n' +
          'If it can\'t play — Game Over.';
        break;
      default:
        title = 'You\'ve Learned the Basics!';
        text = 'Perfect! You now understand the game.\n\n' +
          'Continue playing strategically.\n\n' +
          'Good luck beating the Bogey!';
    }

    const lines = text.split('\n');
    ctx.fillStyle = ACCENT_GOLD;
    ctx.font = "bold 16px 'Inter', sans-serif";
    ctx.fillText(title, panelX + 20, panelY + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = "13px 'Inter', sans-serif";
    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      ctx.fillText(line, panelX + 20, panelY + 60 + i * 20);
    });
  }
}
