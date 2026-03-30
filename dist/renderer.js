// ── Canvas rendering ────────────────────────────────────────
import { rankLabel, suitSymbol, suitColor } from './card.js';
import { MAX_PILES, getWinRating, getValidPiles } from './game.js';
// ── Layout constants (in logical pixels, scaled to canvas) ──
const CARD_W = 70;
const CARD_H = 100;
const CARD_RADIUS = 8;
const CARD_GAP = 8;
const ROW_OFFSET_X = 38; // horizontal overlap within a row
const ROW_GAP = 4; // vertical gap between rows
const HAND_Y_OFFSET = 70; // spacing from bottom of canvas (room for buttons below hand)
// ── Colors ──────────────────────────────────────────────────
const TABLE_COLOR_TOP = '#37505c'; // soft dusty blue-green
const TABLE_COLOR_BOT = '#202f36'; // dark slate
const CARD_BG = '#fcf8f2'; // warm creamy white
const CARD_BACK_1 = '#7c98a1'; // pastel blue-grey
const CARD_BACK_2 = '#54727b'; // deeper pastel blue-grey
const ACCENT_GOLD = '#d4b483'; // soft gold
const VALID_GLOW = 'rgba(155, 209, 169, 0.6)'; // soft green glow
const SELECTED_GLOW = 'rgba(212, 180, 131, 0.8)'; // soft gold glow
const BOGEY_GLOW = 'rgba(217, 136, 128, 0.7)'; // soft coral glow
export class Renderer {
    constructor(canvas) {
        this.buttons = [];
        this.cardHitAreas = [];
        this.discardPileArea = null;
        this.flyingCards = [];
        this.noisePattern = null;
        this.frameCount = 0;
        this.shareDialogVisible = false;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.updateLayout();
        this.createNoisePattern();
    }
    updateLayout() {
        const dpr = window.devicePixelRatio || 1;
        const container = this.canvas.parentElement;
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
            pilesStartX: 30,
            pilesStartY: 60,
            handStartY: h - CARD_H - HAND_Y_OFFSET,
            deckX: 10,
            deckY: h - CARD_H - HAND_Y_OFFSET,
            discardX: 10,
            discardY: h - CARD_H - HAND_Y_OFFSET + CARD_W + 6,
        };
    }
    createNoisePattern() {
        const size = 128;
        const offscreen = document.createElement('canvas');
        offscreen.width = size;
        offscreen.height = size;
        const octx = offscreen.getContext('2d');
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
    showShareDialog(state) {
        this.shareDialogVisible = true;
        const isWin = state.phase === 'game_won';
        const rating = isWin ? getWinRating(state.piles.length) : 'Failed';
        const shareText = `I just played The Bogey and ${isWin ? 'won' : 'lost'}!\n\n` +
            `Rating: ${rating}\n\n` +
            `Piles used: ${state.piles.length}\n` +
            `Turns played: ${state.turnNumber}\n` +
            `Cards played: ${state.cardsPlayed}\n` +
            `Cards discarded: ${state.cardsDiscarded}\n` +
            `Play at: https://esrauch.github.io/bogey/`;
        // Create modal
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '1000';
        const dialog = document.createElement('div');
        dialog.style.backgroundColor = '#fff';
        dialog.style.padding = '20px';
        dialog.style.borderRadius = '8px';
        dialog.style.maxWidth = '400px';
        dialog.style.width = '90%';
        dialog.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
        const title = document.createElement('h3');
        title.textContent = 'Share Your Score';
        title.style.margin = '0 0 15px 0';
        title.style.fontFamily = "'Inter', sans-serif";
        title.style.color = '#333';
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.width = '100%';
        textarea.style.height = '120px';
        textarea.style.padding = '10px';
        textarea.style.border = '1px solid #ccc';
        textarea.style.borderRadius = '4px';
        textarea.style.fontFamily = "'Inter', sans-serif";
        textarea.style.resize = 'vertical';
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '15px';
        buttonContainer.style.justifyContent = 'flex-end';
        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy';
        copyButton.style.padding = '8px 16px';
        copyButton.style.backgroundColor = '#4a7c59';
        copyButton.style.color = '#fff';
        copyButton.style.border = 'none';
        copyButton.style.borderRadius = '4px';
        copyButton.style.cursor = 'pointer';
        copyButton.style.fontFamily = "'Inter', sans-serif";
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.padding = '8px 16px';
        closeButton.style.backgroundColor = '#ccc';
        closeButton.style.color = '#333';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontFamily = "'Inter', sans-serif";
        copyButton.onclick = async () => {
            try {
                await navigator.clipboard.writeText(textarea.value);
                copyButton.textContent = 'Copied!';
                setTimeout(() => copyButton.textContent = 'Copy', 2000);
            }
            catch (err) {
                // Fallback for older browsers
                textarea.select();
                document.execCommand('copy');
                copyButton.textContent = 'Copied!';
                setTimeout(() => copyButton.textContent = 'Copy', 2000);
            }
        };
        closeButton.onclick = () => {
            document.body.removeChild(modal);
            this.shareDialogVisible = false;
        };
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                this.shareDialogVisible = false;
            }
        };
        buttonContainer.appendChild(copyButton);
        buttonContainer.appendChild(closeButton);
        dialog.appendChild(title);
        dialog.appendChild(textarea);
        dialog.appendChild(buttonContainer);
        modal.appendChild(dialog);
        document.body.appendChild(modal);
    }
    // ── Drawing primitives ──────────────────────────────────────
    roundRect(x, y, w, h, r) {
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
    drawTable() {
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
        const vignette = ctx.createRadialGradient(logicalW / 2, logicalH / 2, logicalH * 0.3, logicalW / 2, logicalH / 2, logicalH * 0.9);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, logicalW, logicalH);
    }
    drawCardFace(x, y, card, opts) {
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
        }
        else if (opts?.bogeyCard) {
            this.roundRect(sx - 2, sy - 2, sw + 4, sh + 4, (CARD_RADIUS + 2) * scale);
            ctx.strokeStyle = BOGEY_GLOW;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        else if (opts?.validTarget) {
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
        }
        else {
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
    drawCardBack(x, y, scale = 1, square = false) {
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
    drawEmptySlot(x, y, label, highlight = false, square = false, scale = 1) {
        const ctx = this.ctx;
        const slotW = CARD_W * scale;
        const slotH = (square ? CARD_W : CARD_H) * scale;
        ctx.save();
        this.roundRect(x, y, slotW, slotH, CARD_RADIUS * scale);
        ctx.strokeStyle = highlight ? 'rgba(100, 220, 120, 0.6)' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = highlight ? 2 : 1;
        ctx.setLineDash(highlight ? [] : [4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        if (highlight) {
            this.roundRect(x, y, slotW, slotH, CARD_RADIUS * scale);
            ctx.fillStyle = 'rgba(100, 220, 120, 0.08)';
            ctx.fill();
        }
        ctx.fillStyle = highlight ? 'rgba(100, 220, 120, 0.7)' : 'rgba(255,255,255,0.25)';
        ctx.font = `${12 * scale}px 'Inter', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + slotW / 2, y + slotH / 2);
        ctx.restore();
    }
    // ── High-level scene drawing ──────────────────────────────
    drawButton(btn) {
        const ctx = this.ctx;
        ctx.save();
        const baseColor = btn.color ?? ACCENT_GOLD;
        this.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
        ctx.fillStyle = baseColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = btn.color ? '#fff' : '#2d3e50';
        ctx.font = "600 13px 'Inter', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
        ctx.restore();
    }
    renderMenu() {
        const ctx = this.ctx;
        const { logicalW, logicalH } = this.layout;
        this.drawTable();
        // Title
        ctx.fillStyle = ACCENT_GOLD;
        ctx.font = "bold 52px 'MedievalSharp', cursive";
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
    renderGame(state, selectedHandIndex, dealAnimating = false) {
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
        ctx.font = "bold 18px 'MedievalSharp', cursive";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('The Bogey', 10, 16);
        // ── Piles (rendered as horizontal rows) ─────────────────
        const startX = this.layout.pilesStartX;
        const startY = this.layout.pilesStartY;
        // Determine which card we're placing (for highlighting)
        const activeHandIndex = selectedHandIndex;
        const placingCard = activeHandIndex !== null ? state.hand[activeHandIndex] : state.bogeyCard;
        const isPlacingPhase = activeHandIndex !== null || state.phase === 'bogey_place';
        const validCols = placingCard ? getValidPiles(placingCard, state.piles) : [];
        // Compute row dimensions to fit available vertical space
        const handY = this.layout.handStartY;
        const availableH = handY - startY - 20; // leave some padding above hand
        const totalRows = Math.max(state.piles.length + 1, 1);
        // Compact cards are square (CARD_W x CARD_W)
        const maxRowH = CARD_W + ROW_GAP;
        const rowH = Math.min(maxRowH, availableH / totalRows);
        const cardScale = Math.min(1, (rowH - ROW_GAP) / CARD_W);
        const scaledCardSize = CARD_W * cardScale; // square: same width and height
        const labelW = 10; // space for row number label
        const rowStartX = startX + labelW;
        for (let pileIdx = 0; pileIdx < state.piles.length; pileIdx++) {
            const pile = state.piles[pileIdx];
            const ry = startY + pileIdx * rowH;
            const isValid = isPlacingPhase && validCols.includes(pileIdx);
            // Row label
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = `${20 * cardScale}px 'Inter', sans-serif`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${pileIdx + 1}`, rowStartX - 10, ry + scaledCardSize / 2);
            if (pile.length === 0) {
                this.drawEmptySlot(rowStartX, ry, 'empty', isValid, true, cardScale);
                this.cardHitAreas.push({ x: rowStartX, y: ry, w: scaledCardSize, h: scaledCardSize, type: 'pile', index: pileIdx });
            }
            else {
                for (let ci = 0; ci < pile.length; ci++) {
                    const card = pile[ci];
                    if (this.isCardInTransit(card.id)) {
                        continue; // card is currently flying to this pile, avoid duplicate rendering
                    }
                    const cx = rowStartX + ci * ROW_OFFSET_X * cardScale;
                    const isLastCard = ci === pile.length - 1;
                    this.drawCardFace(cx, ry, card, {
                        validTarget: isValid && isLastCard,
                        compact: true,
                        scale: cardScale,
                    });
                    if (isLastCard) {
                        this.cardHitAreas.push({
                            x: cx, y: ry, w: scaledCardSize, h: scaledCardSize,
                            type: 'pile', index: pileIdx,
                        });
                    }
                }
            }
        }
        // New row slot
        if (state.piles.length < MAX_PILES) {
            const ry = startY + state.piles.length * rowH;
            const isValid = isPlacingPhase && validCols.includes(state.piles.length);
            this.drawEmptySlot(rowStartX, ry, '+', isValid, true, cardScale);
            this.cardHitAreas.push({
                x: rowStartX, y: ry, w: scaledCardSize, h: scaledCardSize,
                type: 'new_pile', index: state.piles.length,
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
        }
        else {
            this.drawEmptySlot(deckX, deckY, 'Deck', false, true);
        }
        // Deck label
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = "9px 'Inter', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('Deck', deckX + CARD_W / 2, deckY - 5);
        // Discard (clickable to discard selected card)
        const canDiscardCard = selectedHandIndex !== null && state.phase === 'player_turn';
        if (state.discardPile.length > 0) {
            const topDiscard = state.discardPile[state.discardPile.length - 1];
            if (!this.isCardInTransit(topDiscard.id)) {
                this.drawCardFace(deckX, discardY, topDiscard, { compact: true, validTarget: canDiscardCard });
            }
            else {
                this.drawEmptySlot(deckX, discardY, 'Empty', canDiscardCard, true);
            }
        }
        else {
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
        // Draw hand cards. If dealing animation is active, skip cards still in flight to avoid duplicates,
        // but render cards already landed in hand so they don't disappear at final animation frame.
        const flyingCardIds = new Set(this.flyingCards.map(fc => fc.card.id));
        for (let i = 0; i < state.hand.length; i++) {
            const card = state.hand[i];
            if (dealAnimating && flyingCardIds.has(card.id)) {
                continue;
            }
            const hx = handAreaX + i * handSpacing;
            const isSelected = selectedHandIndex === i;
            const isPlacing = false;
            this.drawCardFace(hx, handY, card, {
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
            }
            else {
                ctx.fillStyle = '#d97e74';
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
                label: 'Resign', id: 'resign', color: '#c06b6b',
            });
        }
        // Undo button
        if (state.phase === 'player_turn' && state.undoStack.length > 0) {
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
    addFlyingCard(card, startX, startY, endX, endY, opts) {
        this.flyingCards.push({
            card, startX, startY, endX, endY,
            currentX: startX, currentY: startY,
            startTime: performance.now(),
            duration: opts?.duration ?? 250,
            compact: opts?.compact ?? false,
            scale: opts?.scale ?? 1,
            faceDown: opts?.faceDown ?? false,
        });
    }
    updateFlyingCards() {
        const now = performance.now();
        this.flyingCards = this.flyingCards.filter(fc => {
            const elapsed = now - fc.startTime;
            const t = Math.min(elapsed / fc.duration, 1);
            // easeOutCubic
            const e = 1 - Math.pow(1 - t, 3);
            fc.currentX = fc.startX + (fc.endX - fc.startX) * e;
            fc.currentY = fc.startY + (fc.endY - fc.startY) * e;
            return t < 1;
        });
    }
    isCardInTransit(cardId) {
        return this.flyingCards.some(fc => fc.card.id === cardId);
    }
    drawFlyingCards() {
        for (const fc of this.flyingCards) {
            if (fc.faceDown) {
                this.drawCardBack(fc.currentX, fc.currentY, fc.scale, fc.compact);
            }
            else {
                this.drawCardFace(fc.currentX, fc.currentY, fc.card, {
                    compact: fc.compact,
                    scale: fc.scale,
                });
            }
        }
    }
    hasFlyingCards() {
        return this.flyingCards.length > 0;
    }
    /** Get screen position of a hand card by index */
    getHandCardPos(handIndex, handLength) {
        const deckX = 10;
        const handAreaX = deckX + CARD_W + 15;
        const { logicalW } = this.layout;
        const handSpacing = Math.min(CARD_W + 12, (logicalW - handAreaX - 20) / Math.max(handLength, 1));
        return { x: handAreaX + handIndex * handSpacing, y: this.layout.handStartY };
    }
    /** Get screen position for placing a card at the end of a pile row */
    getPilePos(pileIndex, cardCountInPile, totalPiles) {
        const startX = this.layout.pilesStartX;
        const startY = this.layout.pilesStartY;
        const handY = this.layout.handStartY;
        const availableH = handY - startY - 20;
        const totalRows = Math.max(totalPiles + 1, 1);
        const maxRowH = CARD_W + ROW_GAP;
        const rowH = Math.min(maxRowH, availableH / totalRows);
        const cardScale = Math.min(1, (rowH - ROW_GAP) / CARD_W);
        const labelW = 10;
        const rowStartX = startX + labelW;
        const ry = startY + pileIndex * rowH;
        const cx = rowStartX + cardCountInPile * ROW_OFFSET_X * cardScale;
        return { x: cx, y: ry };
    }
    /** Get screen position of the deck */
    getDeckPos() {
        return { x: 10, y: this.layout.handStartY };
    }
    /** Get screen position of the discard pile */
    getDiscardPos() {
        return { x: 10, y: this.layout.handStartY + CARD_W + 16 };
    }
    renderEndScreen(state) {
        const ctx = this.ctx;
        const { logicalW, logicalH } = this.layout;
        this.drawTable();
        this.buttons = [];
        const isWin = state.phase === 'game_won';
        const centerY = logicalH * 0.35;
        ctx.fillStyle = isWin ? '#7dc28c' : '#d97e74';
        ctx.font = "bold 46px 'MedievalSharp', cursive";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isWin ? 'Victory!' : 'Game Over', logicalW / 2, centerY);
        if (isWin) {
            const rating = getWinRating(state.piles.length);
            ctx.fillStyle = '#fff';
            ctx.font = "24px 'Inter', sans-serif";
            ctx.fillText(rating, logicalW / 2, centerY + 50);
        }
        // Stats
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = "15px 'Inter', sans-serif";
        const stats = [
            `Piles used: ${state.piles.length}`,
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
        // Buttons
        const btnW = 140;
        const btnH = 50;
        const btnSpacing = 20;
        const totalBtnW = btnW * 2 + btnSpacing;
        this.buttons = [
            {
                x: logicalW / 2 - totalBtnW / 2,
                y: logicalH * 0.78,
                w: btnW, h: btnH,
                label: '📤 Share', id: 'share',
            },
            {
                x: logicalW / 2 - totalBtnW / 2 + btnW + btnSpacing,
                y: logicalH * 0.78,
                w: btnW, h: btnH,
                label: 'Main menu', id: 'restart',
            },
        ];
        for (const btn of this.buttons) {
            this.drawButton(btn);
        }
    }
    hitTestButton(x, y) {
        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                return btn;
            }
        }
        return null;
    }
    hitTestCard(x, y) {
        // Check in reverse order so topmost cards are hit first
        for (let i = this.cardHitAreas.length - 1; i >= 0; i--) {
            const area = this.cardHitAreas[i];
            if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
                return area;
            }
        }
        return null;
    }
    renderTutorialOverlay(state, tutorialStep) {
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
                text = 'Click anywhere to begin the tutorial.';
                break;
            case 1:
                title = 'Objective of the game';
                text = 'Your goal is to place all 52 cards into piles.\n\n' +
                    '• You may have at most 13 piles.\n' +
                    '• Each pile may contain only one suit.\n' +
                    '• Piles must be in descending order (A-K-Q-...-3-2-A).\n' +
                    '• Aces can be high or low.\n' +
                    '• A pile doesn\'t need to be consecutive.';
                break;
            case 2:
                title = 'Your turn';
                text = 'At the start of each turn, your hand refills.\n' +
                    'The discard pile is reshuffled into the deck when needed.\n\n' +
                    'For every card in your hand, you have three options:\n' +
                    '• You may play it into a pile.\n' +
                    '• You may discard it.\n' +
                    '• You may keep it for a later turn.';
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
                    'Then click on the Queen to pile below it.\n\n' +
                    'Cards must be same suit and can be any lower rank.';
                break;
            case 6:
                title = 'Step 3: Your Options';
                text = 'Select the other cards and tap the discard pile in\nthe bottom left to discard.\n\n' +
                    'You can also choose to keep them for later turns.\n\n' +
                    'Click End Turn to proceed';
                break;
            case 7:
                title = 'The Bogey Card';
                text = 'The Bogey forces you to play the top card of the deck.\n\n' +
                    'If it can\'t play ... Game Over!';
                break;
            default:
                title = 'That\'s the Basics!';
                text =
                    'Continue playing strategically.\n\n' +
                        'Good luck beating the Bogey!';
        }
        const lines = text.split('\n');
        ctx.fillStyle = ACCENT_GOLD;
        ctx.font = "bold 18px 'MedievalSharp', cursive";
        ctx.fillText(title, panelX + 20, panelY + 30);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = "13px 'Inter', sans-serif";
        ctx.textAlign = 'left';
        lines.forEach((line, i) => {
            ctx.fillText(line, panelX + 20, panelY + 60 + i * 20);
        });
    }
}
//# sourceMappingURL=renderer.js.map