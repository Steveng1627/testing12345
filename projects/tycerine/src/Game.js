import { ThemeManager } from './ThemeManager.js';
import { SoundManager } from './SoundManager.js';

class TycerineGame {
    constructor() {
        this.board = Array(9).fill().map(() => Array(7).fill(null));
        this.currentPlayer = 'X';
        this.moveHistory = [];
        this.PIECE_TYPES = {
            PAWN: { name: 'Pawn', ap: 1, dp: 1 },
            DEFENDER: { name: 'Defender', ap: 1, dp: 3 },
            HOPPER: { name: 'Hopper', ap: 5, dp: 3 },
            FORTRESS_X: { name: 'Fortress_X', ap: 3, dp: 3 },
            FORTRESS_O: { name: 'Fortress_O', ap: 3, dp: 3 }
        };
        this.fusionMode = false;
        this.selectedPiece = null;
        this.selectedHopper = null;
        this.hopperMoving = false;
        this.isAIEnabled = false;
        this.aiPlayer = 'O';
        this.aiDifficulty = 'normal';
        
        this.themeManager = new ThemeManager();
        this.soundManager = new SoundManager();
        
        // 检查是否需要显示教程
        if (!localStorage.getItem('tutorialCompleted')) {
            this.showTutorial();
        }
        
        this.initialize();
        
        this.gameStats = {
            defenderCount: 0,
            hopperCount: 0,
            battleWins: 0,
            turnCount: 0
        };
        
        // 设置欢迎界面
        const welcomeScreen = document.getElementById('welcome-screen');
        const startButton = document.getElementById('start-game');
        
        if (startButton) {
            startButton.addEventListener('click', () => {
                welcomeScreen.classList.add('hide');
                // 开始播放背景音乐
                SoundManager.sounds.bgm.play().catch(console.error);
            });
        }
    }

    initialize() {
        this.createBoard();
        this.setupInitialEventListeners();
        this.setInitialState();
    }

    createBoard() {
        const boardElement = document.getElementById('board');
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 7; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row + 1;
                cell.dataset.col = String.fromCharCode(65 + col);
                boardElement.appendChild(cell);
            }
        }
    }

    setInitialState() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('active');
            cell.innerHTML = '';
        });
        
        this.placePiece(9, 'D', 'X', 'FORTRESS_X');
        this.placePiece(1, 'D', 'O', 'FORTRESS_O');
        
        this.updateValidPlacementCells();
    }

    getValidPlacementCells() {
        const validCells = new Set();
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 7; col++) {
                const piece = this.board[row][col];
                if (piece?.player === this.currentPlayer) {
                    this.addMarchCells(row + 1, col, validCells);
                    this.addFortifyCells(row + 1, col, validCells);
                }
            }
        }
        
        return validCells;
    }

    addMarchCells(row, col, validCells) {
        const direction = this.currentPlayer === 'X' ? -1 : 1;
        const targetRow = row + direction;
        
        if (targetRow >= 1 && targetRow <= 9) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (c >= 0 && c < 7 && !this.board[targetRow-1][c]) {
                    validCells.add(`${targetRow},${String.fromCharCode(65 + c)}`);
                }
            }
        }
    }

    addFortifyCells(row, col, validCells) {
        const direction = this.currentPlayer === 'X' ? 1 : -1;
        const targetRow = row + direction;
        
        if (targetRow >= 1 && targetRow <= 9) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (c >= 0 && c < 7 && !this.board[targetRow-1][c]) {
                    validCells.add(`${targetRow},${String.fromCharCode(65 + c)}`);
                }
            }
        }
        
        [-1, 1].forEach(offset => {
            const newCol = col + offset;
            if (newCol >= 0 && newCol < 7 && !this.board[row-1][newCol]) {
                validCells.add(`${row},${String.fromCharCode(65 + newCol)}`);
            }
        });
    }

    updateValidPlacementCells() {
        const validCells = this.getValidPlacementCells();
        document.querySelectorAll('.cell').forEach(cell => {
            const key = `${cell.dataset.row},${cell.dataset.col}`;
            cell.classList.remove('active', 'player-x', 'player-o');
            if (validCells.has(key)) {
                cell.classList.add('active', `player-${this.currentPlayer.toLowerCase()}`);
            }
        });
    }

    handlePlacement(cell) {
        const row = parseInt(cell.dataset.row);
        const col = cell.dataset.col;
        
        if (cell.classList.contains('active')) {
            SoundManager.play('place');
            this.moveHistory.push({
                board: this.board.map(row => [...row]),
                player: this.currentPlayer
            });
            
            this.placePiece(row, col, this.currentPlayer, 'PAWN');
            this.addLog(`${this.currentPlayer}方在${col}${row}放置了一个Pawn`, 'place');
            
            // 先检查是否发生战斗
            if (this.checkForBattle(row, col)) {
                return; // 如果发生战斗，战斗系统会处理玩家切换
            }
            
            // 如果没有战斗，检查是否可以合成
            if (this.checkDefenderFusion(row, col)) {
                if (confirm('可以合成 Defender，是否立即合成？')) {
                    this.fuseToDefender(row, col);
                    // 合成后检查战斗
                    if (this.checkForBattle(row, col)) {
                        return;
                    }
                }
            } else if (this.checkHopperFusion(row, col)) {
                if (confirm('可以合成 Hopper，是否立即合成？')) {
                    this.fuseToHopper(row, col);
                    // 合成后检查战斗
                    if (this.checkForBattle(row, col)) {
                        return;
                    }
                }
            }
            
            // 如果没有战斗和合成，切换玩家
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
            this.updateValidPlacementCells();

            // 检查 AI 移动
            if (this.isAIEnabled && this.currentPlayer === this.aiPlayer) {
                this.makeAIMove();
            }
        }
        this.updateStats('turnCount');
        this.updateGameStatus();
    }

    // 检查 Defender 合成
    checkDefenderFusion(row, col) {
        const colIndex = col.charCodeAt(0) - 65;
        
        // 检查当前位置是否为 Pawn
        const currentPiece = this.getPieceAt(row, col);
        if (!currentPiece || currentPiece.type !== 'PAWN' || currentPiece.player !== this.currentPlayer) {
            return false;
        }

        // 检查十字形状
        const crossPositions = [
            [0, 0],   // 中心
            [-1, 0],  // 上
            [1, 0],   // 下
            [0, -1],  // 左
            [0, 1]    // 右
        ];

        // 检查每个位置是否都是己方的 Pawn
        for (const [dr, dc] of crossPositions) {
            const checkRow = row + dr;
            const checkCol = colIndex + dc;

            // 检查边界
            if (checkRow < 1 || checkRow > 9 || checkCol < 0 || checkCol >= 7) {
                return false;
            }

            const piece = this.getPieceAt(checkRow, String.fromCharCode(65 + checkCol));
            if (!piece || piece.type !== 'PAWN' || piece.player !== this.currentPlayer) {
                return false;
            }
        }

        // 录合成中心点
        this.fusionCenter = { row, col };
        return true;
    }

    // 检查 Hopper 合成
    checkHopperFusion(row, col) {
        // 检查中心是否为 Defender
        const centerPiece = this.getPieceAt(row, col);
        if (!centerPiece || centerPiece.type !== 'DEFENDER' || centerPiece.player !== this.currentPlayer) {
            return false;
        }

        // 检查周围8个位置
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue; // 跳过中心

                const checkRow = row + dr;
                const checkCol = col.charCodeAt(0) - 65 + dc;

                // 检查边界
                if (checkRow < 1 || checkRow > 9 || checkCol < 0 || checkCol >= 7) {
                    return false;
                }

                const piece = this.getPieceAt(checkRow, String.fromCharCode(65 + checkCol));
                if (!piece || piece.type !== 'PAWN' || piece.player !== this.currentPlayer) {
                    return false;
                }
            }
        }

        return true;
    }

    // 执行 Defender 合成
    fuseToDefender(row, col) {
        SoundManager.play('fusion');
        const positions = this.getPawnPositionsAroundPawn(row, col);
        positions.push({row, col: col.charCodeAt(0) - 65}); // 添加中心点

        // 移除所有参与合成的 Pawn
        positions.forEach(pos => {
            this.board[pos.row-1][pos.col] = null;
            const cell = document.querySelector(
                `.cell[data-row="${pos.row}"][data-col="${String.fromCharCode(65 + pos.col)}"]`
            );
            if (cell) cell.innerHTML = '';
        });

        // 放置 Defender
        this.placePiece(row, String.fromCharCode(65 + (col.charCodeAt(0) - 65)), 
                       this.currentPlayer, 'DEFENDER');
        this.addLog(`${this.currentPlayer}方在${col}${row}执行了Defender合成`, 'fusion');
        this.updateStats('defenderCount');
    }

    // 执行 Hopper 合成
    fuseToHopper(row, col) {
        SoundManager.play('fusion');
        const positions = this.getPawnPositionsAroundDefender(row, col);
        
        // 移除所有参与合成的棋子（包括中心的 Defender）
        positions.forEach(pos => {
            this.board[pos.row-1][pos.col] = null;
            const cell = document.querySelector(
                `.cell[data-row="${pos.row}"][data-col="${String.fromCharCode(65 + pos.col)}"]`
            );
            if (cell) cell.innerHTML = '';
        });
        
        // 移除中心的 Defender
        this.board[row-1][col.charCodeAt(0) - 65] = null;
        const centerCell = document.querySelector(
            `.cell[data-row="${row}"][data-col="${col}"]`
        );
        if (centerCell) centerCell.innerHTML = '';

        // 放置 Hopper
        this.placePiece(row, String.fromCharCode(65 + (col.charCodeAt(0) - 65)), 
                       this.currentPlayer, 'HOPPER');
        this.addLog(`${this.currentPlayer}方在${col}${row}执行了Hopper合成`, 'fusion');
        this.updateStats('hopperCount');
    }

    // 获取指定位置的棋子
    getPieceAt(row, col) {
        const colIndex = col.charCodeAt(0) - 65;
        return this.board[row-1][colIndex];
    }

    // 放置棋子
    placePiece(row, colLetter, player, type = 'PAWN') {
        const cell = document.querySelector(
            `.cell[data-row="${row}"][data-col="${colLetter}"]`
        );
        if (cell) {
            cell.innerHTML = '';
            const piece = document.createElement('div');
            
            if (type.includes('FORTRESS')) {
                piece.className = `piece fortress player-${player.toLowerCase()}`;
            } else {
                piece.className = `piece ${type.toLowerCase()} player-${player.toLowerCase()}`;
            }
            
            cell.appendChild(piece);
            
            const colIndex = colLetter.charCodeAt(0) - 65;
            this.board[row-1][colIndex] = {
                player: player,
                type: type
            };
        }
    }

    // 添加日志
    addLog(message, type = 'place') {
        const logEntries = document.getElementById('logEntries');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        let icon = '';
        switch(type) {
            case 'place':
                icon = '<i class="fas fa-chess-pawn"></i>';
                break;
            case 'fusion':
                icon = '<i class="fas fa-compress-arrows-alt"></i>';
                break;
            case 'battle':
                icon = '<i class="fas fa-swords"></i>';
                break;
            case 'victory':
                icon = '<i class="fas fa-crown"></i>';
                break;
        }

        entry.innerHTML = `
            <div class="timestamp">${timestamp}</div>
            <div class="log-content">
                <span class="log-icon">${icon}</span>
                <span class="log-message">${message}</span>
            </div>
        `;
        
        // 添加新日志到顶部
        logEntries.insertBefore(entry, logEntries.firstChild);
        
        // 限制显示最新的4条日志
        const entries = logEntries.children;
        if (entries.length > 4) {
            // 给多余的日志添加滑出动画
            for (let i = 4; i < entries.length; i++) {
                entries[i].classList.add('sliding-out');
            }
            // 等动画结束后移除多余的日志
            setTimeout(() => {
                while (entries.length > 4) {
                    logEntries.removeChild(entries[entries.length - 1]);
                }
            }, 300);
        }
    }

    // 将所有事件监听器集中到一个方法中
    setupInitialEventListeners() {
        // 棋盘点击事件
        const board = document.getElementById('board');
        if (board) {
            board.addEventListener('click', (e) => {
                let targetCell;
                if (e.target.classList.contains('piece')) {
                    targetCell = e.target.parentElement;
                } else if (e.target.classList.contains('cell')) {
                    targetCell = e.target;
                }

                if (targetCell) {
                    if (this.fusionMode) {
                        this.handleFusionClick(targetCell);
                    } else if (this.hopperMoving) {
                        if (targetCell.classList.contains('active')) {
                            this.moveHopper(targetCell);
                        }
                    } else if (targetCell.classList.contains('active')) {
                        this.handlePlacement(targetCell);
                    }
                }
            });
        }

        // 游戏控制按钮
        const buttons = {
            'new-game': () => this.resetGame(),
            'undo': () => this.undoMove(),
            'forfeit': () => this.forfeitGame(),
            'fusion': () => this.toggleFusionMode(),
            'toggle-ai': () => this.toggleAI(),
            'show-tutorial': () => this.showTutorial(),
            'toggle-theme': () => this.themeManager.toggleTheme()
        };

        // 为每个按钮添加事件监听器
        Object.entries(buttons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
            }
        });

        // AI 难度选择
        const aiDifficultySelect = document.getElementById('ai-difficulty');
        if (aiDifficultySelect) {
            aiDifficultySelect.addEventListener('change', (e) => {
                this.setAIDifficulty(e.target.value);
            });
        }

        // 键盘控制
        this.setupKeyboardControls();

        // 音效控制
        const soundBtn = document.getElementById('toggle-sound');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                const enabled = !SoundManager.enabled;
                SoundManager.toggle(enabled);
                soundBtn.querySelector('i').className = 
                    enabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
            });
        }
    }

    // 重置游戏
    resetGame() {
        this.board = Array(9).fill().map(() => Array(7).fill(null));
        this.currentPlayer = 'X';
        this.moveHistory = [];
        this.fusionMode = false;
        this.selectedPiece = null;
        this.selectedHopper = null;
        this.hopperMoving = false;
        
        this.setInitialState();
    }

    // 悔棋
    undoMove() {
        if (this.moveHistory.length > 0) {
            const lastMove = this.moveHistory.pop();
            this.board = lastMove.board.map(row => [...row]);
            this.currentPlayer = lastMove.player;
            
            // 更新棋盘显示
            this.updateBoardDisplay();
            this.updateValidPlacementCells();
        }
    }

    // 更新棋盘显示
    updateBoardDisplay() {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 7; col++) {
                const piece = this.board[row][col];
                const cell = document.querySelector(
                    `.cell[data-row="${row + 1}"][data-col="${String.fromCharCode(65 + col)}"]`
                );
                if (cell) {
                    cell.innerHTML = '';
                    if (piece) {
                        this.placePiece(row + 1, String.fromCharCode(65 + col), piece.player, piece.type);
                    }
                }
            }
        }
    }

    // 认输
    forfeitGame() {
        const winner = this.currentPlayer === 'X' ? 'O' : 'X';
        this.endGame(winner);
    }

    // 切换合成模式
    toggleFusionMode() {
        this.fusionMode = !this.fusionMode;
        this.selectedPiece = null; // 重置选择状态
        
        const fusionBtn = document.getElementById('fusion');
        if (fusionBtn) {
            fusionBtn.style.backgroundColor = this.fusionMode ? '#aaf' : '';
        }
        
        if (this.fusionMode) {
            this.highlightFusionCandidates();
        } else {
            this.updateValidPlacementCells();
        }
    }

    // 显示 Hopper 的可移动范围
    showHopperMoves(row, col) {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('active');
        });

        const colIndex = col.charCodeAt(0) - 65;
        // 显示九宫格范围内的所有格子（包括有棋子的格子，因为 Hopper 可以交换位置）
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = colIndex - 1; c <= colIndex + 1; c++) {
                if (r >= 1 && r <= 9 && c >= 0 && c < 7) {
                    const cell = document.querySelector(
                        `.cell[data-row="${r}"][data-col="${String.fromCharCode(65 + c)}"]`
                    );
                    if (cell) {
                        cell.classList.add('active');
                    }
                }
            }
        }
    }

    // 动 Hopper
    moveHopper(targetCell) {
        SoundManager.play('move');
        const targetRow = parseInt(targetCell.dataset.row);
        const targetCol = targetCell.dataset.col;
        const sourceRow = this.selectedHopper.row;
        const sourceCol = this.selectedHopper.col;

        // 保存移动历史
        this.moveHistory.push({
            board: this.board.map(row => [...row]),
            player: this.currentPlayer,
            moveType: 'hopper',
            from: {row: sourceRow, col: sourceCol},
            to: {row: targetRow, col: targetCol}
        });

        // 获取源位置和目标位置的棋子
        const hopperPiece = this.getPieceAt(sourceRow, sourceCol);
        const targetPiece = this.getPieceAt(targetRow, targetCol);

        // 清除源位置的 Hopper
        this.board[sourceRow-1][sourceCol.charCodeAt(0)-65] = null;
        document.querySelector(
            `.cell[data-row="${sourceRow}"][data-col="${sourceCol}"]`
        ).innerHTML = '';

        if (targetPiece) {
            // 如果目标位置有棋子，执行交换
            this.board[targetRow-1][targetCol.charCodeAt(0)-65] = hopperPiece;
            this.board[sourceRow-1][sourceCol.charCodeAt(0)-65] = targetPiece;
            this.placePiece(targetRow, targetCol, this.currentPlayer, 'HOPPER');
            this.placePiece(sourceRow, sourceCol, targetPiece.player, targetPiece.type);
            this.addLog(`${this.currentPlayer}方的Hopper与${targetCol}${targetRow}的${targetPiece.type}交换了位置`, 'place');
        } else {
            // 如果目标位置为空，直接移动
            this.placePiece(targetRow, targetCol, this.currentPlayer, 'HOPPER');
            this.addLog(`${this.currentPlayer}方的Hopper移动到了${targetCol}${targetRow}`, 'place');
        }

        // 重置 Hopper 状态
        this.selectedHopper = null;
        this.hopperMoving = false;

        // 检查战斗
        this.checkForBattle(targetRow, targetCol);
    }

    // 检查战斗
    checkForBattle(row, col) {
        const colIndex = col.charCodeAt(0) - 65;
        const attackerPiece = this.getPieceAt(row, col);
        const defenders = [];
        
        // 检查上下右四个方向
        const directions = [[-1,0], [1,0], [0,-1], [0,1]];
        
        directions.forEach(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = colIndex + dc;
            
            if (newRow >= 1 && newRow <= 9 && newCol >= 0 && newCol < 7) {
                const defenderPiece = this.getPieceAt(newRow, String.fromCharCode(65 + newCol));
                if (defenderPiece && defenderPiece.player !== attackerPiece.player) {
                    defenders.push({
                        row: newRow,
                        col: String.fromCharCode(65 + newCol)
                    });
                }
            }
        });

        if (defenders.length > 0) {
            this.resolveBattle({row, col}, defenders);
            return true;
        }
        return false;
    }

    // 处理战斗结果
    resolveBattle(attacker, defenders) {
        SoundManager.play('battle');
        const attackPower = this.calculateAttackPower(attacker);
        const defensePower = this.calculateDefensePower(defenders);
        
        this.addLog(`战斗发生！`, 'battle');
        this.addLog(`攻击方(${this.currentPlayer}) 在 ${attacker.col}${attacker.row} 发起战斗`, `player-${this.currentPlayer.toLowerCase()}`);
        this.addLog(`攻击方战斗力: ${attackPower}`, `player-${this.currentPlayer.toLowerCase()}`);
        this.addLog(`防守方战斗力: ${defensePower}`, `player-${this.currentPlayer === 'X' ? 'o' : 'x'}`);

        let result = '';
        if (attackPower === defensePower) {
            result = '双方势均力敌，所有相关棋子被移除';
            this.removePiecesInBattle(attacker, defenders, 'both');
        } else if (attackPower > defensePower) {
            result = '攻击方胜利，防守方棋子被移除';
            this.removePiecesInBattle(attacker, defenders, 'defenders');
            this.updateStats('battleWins');
        } else {
            result = '防守方胜利，攻击方棋子被移除';
            this.removePiecesInBattle(attacker, defenders, 'attacker');
        }
        
        this.addLog(result, 'result');
        
        // 切换玩家并检查 AI
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        this.updateValidPlacementCells();

        // 检查是否需要执行 AI 移动
        if (this.isAIEnabled && this.currentPlayer === this.aiPlayer) {
            setTimeout(() => this.makeAIMove(), 500);
        }
    }

    // 检查胜利条件
    checkVictoryCondition() {
        // 检查堡垒是否被摧毁
        let xFortressExists = false;
        let oFortressExists = false;

        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 7; col++) {
                const piece = this.board[row][col];
                if (piece?.type === 'FORTRESS_X') xFortressExists = true;
                if (piece?.type === 'FORTRESS_O') oFortressExists = true;
            }
        }

        if (!xFortressExists) {
            this.endGame('O');
            return true;
        }
        if (!oFortressExists) {
            this.endGame('X');
            return true;
        }

        return false;
    }

    // 结束游戏
    endGame(winner) {
        SoundManager.play(winner === this.aiPlayer ? 'defeat' : 'victory');
        this.showGameStats(winner);
        this.resetGame();
    }

    showGameStats(winner) {
        const panel = document.createElement('div');
        panel.className = 'stats-panel';
        
        panel.innerHTML = `
            <div class="stats-content">
                <h2>游戏结束</h2>
                <div class="winner-announcement">
                    <h3>${winner}方 获胜！</h3>
                </div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-icon"><i class="fas fa-shield-alt"></i></div>
                        <div class="stat-info">
                            <h4>Defender 合成</h4>
                            <p>${this.gameStats.defenderCount} 次</p>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon"><i class="fas fa-bolt"></i></div>
                        <div class="stat-info">
                            <h4>Hopper 合成</h4>
                            <p>${this.gameStats.hopperCount} 次</p>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon"><i class="fas fa-crosshairs"></i></div>
                        <div class="stat-info">
                            <h4>战斗胜利</h4>
                            <p>${this.gameStats.battleWins} 次</p>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon"><i class="fas fa-clock"></i></div>
                        <div class="stat-info">
                            <h4>回合数</h4>
                            <p>${this.gameStats.turnCount} 回合</p>
                        </div>
                    </div>
                </div>
                <button class="new-game-btn">开始新游戏</button>
            </div>
        `;

        document.body.appendChild(panel);
        
        panel.querySelector('.new-game-btn').addEventListener('click', () => {
            panel.remove();
            this.initialize();
        });
    }

    // 更新统计数据
    updateStats(type) {
        if (this.gameStats[type] !== undefined) {
            this.gameStats[type]++;
        }
    }

    // 重置统计数据
    resetStats() {
        this.gameStats = {
            defenderCount: 0,
            hopperCount: 0,
            battleWins: 0,
            turnCount: 0
        };
    }

    // 计算攻击力（不包括中心棋子）
    calculateAttackPower(attacker) {
        let power = 0;
        const row = attacker.row;
        const colIndex = attacker.col.charCodeAt(0) - 65;
        const centerPiece = this.getPieceAt(row, String.fromCharCode(65 + colIndex));

        // 遍历九宫格，但跳过中心点
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = colIndex - 1; c <= colIndex + 1; c++) {
                // 跳过中心点
                if (r === row && c === colIndex) continue;
                
                if (r >= 1 && r <= 9 && c >= 0 && c < 7) {
                    const piece = this.getPieceAt(r, String.fromCharCode(65 + c));
                    if (piece && piece.player === centerPiece.player) {
                        power += this.PIECE_TYPES[piece.type].ap;
                    }
                }
            }
        }
        return power;
    }

    // 计算防御力（不包括中心棋子和其他被碰撞棋子）
    calculateDefensePower(defenders) {
        let power = 0;
        const countedPieces = new Set();
        const excludedPieces = new Set(); // 用于存储被碰撞的棋子位置

        // 收集所有被碰撞棋子的位置信息
        defenders.forEach(defender => {
            excludedPieces.add(`${defender.row},${defender.col.charCodeAt(0) - 65}`);
        });

        defenders.forEach(defender => {
            const row = defender.row;
            const colIndex = defender.col.charCodeAt(0) - 65;
            const centerPiece = this.getPieceAt(row, String.fromCharCode(65 + colIndex));

            // 遍历九宫格，但跳过中心点和已计算的棋子
            for (let r = row - 1; r <= row + 1; r++) {
                for (let c = colIndex - 1; c <= colIndex + 1; c++) {
                    // 跳过中心点（被攻击的棋子）和其他被碰撞棋子
                    if (r === row && c === colIndex) continue;
                    if (excludedPieces.has(`${r},${c}`)) continue; // 排除其他被碰撞棋子
                    
                    if (r >= 1 && r <= 9 && c >= 0 && c < 7) {
                        const pieceKey = `${r},${c}`;
                        if (!countedPieces.has(pieceKey)) {
                            const piece = this.getPieceAt(r, String.fromCharCode(65 + c));
                            // 计算同一方棋子的防御力
                            if (piece && piece.player === centerPiece.player) {
                                power += this.PIECE_TYPES[piece.type].dp;
                                countedPieces.add(pieceKey); // 确保不重复计算
                            }
                        }
                    }
                }
            }
        });
        return power;
    }

    // 移除战斗中的棋子
    removePiecesInBattle(attacker, defenders, removeType) {
        const piecesToRemove = new Set(); // 使用 Set 避免重复移除

        // 获取所有需要检查的九宫格中心点
        const centers = [attacker, ...defenders];
        
        centers.forEach(center => {
            const row = center.row;
            const colIndex = center.col.charCodeAt(0) - 65;

            // 遍历九宫格
            for (let r = row - 1; r <= row + 1; r++) {
                for (let c = colIndex - 1; c <= colIndex + 1; c++) {
                    if (r >= 1 && r <= 9 && c >= 0 && c < 7) {
                        const piece = this.board[r-1][c];
                        if (piece) {
                            const shouldRemove = 
                                (removeType === 'both') ||
                                (removeType === 'attacker' && piece.player === this.currentPlayer) ||
                                (removeType === 'defenders' && piece.player !== this.currentPlayer);

                            if (shouldRemove) {
                                // 检查是否是堡垒
                                if (piece.type.includes('FORTRESS')) {
                                    const winner = piece.player === 'X' ? 'O' : 'X';
                                    this.endGame(winner);
                                    return;
                                }
                                // 将位置添加到待移除集合
                                piecesToRemove.add(`${r-1},${c}`);
                            }
                        }
                    }
                }
            }
        });

        // 移除所有标记的棋子
        piecesToRemove.forEach(pos => {
            const [row, col] = pos.split(',').map(Number);
            this.board[row][col] = null;
            const cell = document.querySelector(
                `.cell[data-row="${row + 1}"][data-col="${String.fromCharCode(65 + col)}"]`
            );
            if (cell) {
                cell.innerHTML = '';
                // 添加战斗效果
                this.addBattleEffect(cell);
            }
        });
    }

    // 添加战斗效果
    addBattleEffect(cell) {
        const effect = document.createElement('div');
        effect.className = 'battle-effect';
        cell.appendChild(effect);
        
        // 移除效果
        setTimeout(() => {
            effect.remove();
        }, 500);
    }

    // 高亮显示可能的合成位置
    highlightFusionCandidates() {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('active');
        });

        // 检查所有可能的合成位置
        for (let row = 1; row <= 9; row++) {
            for (let col = 0; col < 7; col++) {
                const colLetter = String.fromCharCode(65 + col);
                const piece = this.getPieceAt(row, colLetter);
                
                // 检查 Defender 合成
                if (piece?.type === 'PAWN' && piece.player === this.currentPlayer) {
                    if (this.checkDefenderFusion(row, colLetter)) {
                        this.highlightCell(row, colLetter);
                    }
                }
                
                // 检查 Hopper 合成
                if (piece?.type === 'DEFENDER' && piece.player === this.currentPlayer) {
                    if (this.checkHopperFusion(row, colLetter)) {
                        this.highlightCell(row, colLetter);
                    }
                }
            }
        }
    }

    // 高亮显示单个格子
    highlightCell(row, col) {
        const cell = document.querySelector(
            `.cell[data-row="${row}"][data-col="${col}"]`
        );
        if (cell) {
            cell.classList.add('active');
        }
    }

    // 切换 AI
    toggleAI() {
        this.isAIEnabled = !this.isAIEnabled;
        const aiBtn = document.getElementById('toggle-ai');
        if (aiBtn) {
            aiBtn.textContent = this.isAIEnabled ? 'AI: ON' : 'AI: OFF';
            aiBtn.style.backgroundColor = this.isAIEnabled ? '#aaf' : '';
        }
        
        // 如果开启 AI 且当前是 AI 的回合，则执行 AI 移动
        if (this.isAIEnabled && this.currentPlayer === this.aiPlayer) {
            this.makeAIMove();
        }
    }

    // 设置 AI 难度
    setAIDifficulty(difficulty) {
        this.aiDifficulty = difficulty;
        this.addLog(`AI难度设置为: ${difficulty}`);
    }

    // AI 移动决策
    async makeAIMove() {
        await new Promise(resolve => setTimeout(resolve, 500));

        const move = this.getBestMove();
        if (move) {
            const { row, col, type } = move;
            
            if (type === 'place') {
                // 放置新的 Pawn
                this.placePiece(row, col, this.aiPlayer, 'PAWN');
                this.addLog(`AI在${col}${row}放置了一个Pawn`, 'place');
                
                // 检查是否发生战斗
                if (this.checkForBattle(row, col)) {
                    return; // 如果发生战斗，战斗系统会处理玩家切换
                }
                
                // 检查是否可以合成
                if (this.checkDefenderFusion(row, col)) {
                    this.fuseToDefender(row, col);
                    if (this.checkForBattle(row, col)) {
                        return;
                    }
                } else if (this.checkHopperFusion(row, col)) {
                    this.fuseToHopper(row, col);
                    if (this.checkForBattle(row, col)) {
                        return;
                    }
                }
            } else if (type === 'hopper') {
                // 移动 Hopper
                const targetCell = document.querySelector(
                    `.cell[data-row="${row}"][data-col="${col}"]`
                );
                if (targetCell) {
                    this.selectedHopper = move.from;
                    this.moveHopper(targetCell);
                    return; // moveHopper 会处理战斗和玩家切换
                }
            }

            // 切换玩家
            this.currentPlayer = 'X';
            this.updateValidPlacementCells();
        }
    }

    // 获取最佳移动
    getBestMove() {
        const validMoves = this.getAllValidMoves();
        
        if (validMoves.length === 0) return null;

        switch (this.aiDifficulty) {
            case 'easy':
                // 随机选择一个有效移动
                return validMoves[Math.floor(Math.random() * validMoves.length)];
            
            case 'normal':
                // 优先选择能形成合成的移动
                const fusionMoves = validMoves.filter(move => {
                    return this.checkDefenderFusion(move.row, move.col) || 
                           this.checkHopperFusion(move.row, move.col);
                });
                return fusionMoves.length > 0 ? 
                    fusionMoves[Math.floor(Math.random() * fusionMoves.length)] : 
                    validMoves[Math.floor(Math.random() * validMoves.length)];
            
            case 'hard':
                // 用评估函数选择最佳移动
                return this.evaluateBestMove(validMoves);
            
            default:
                return validMoves[Math.floor(Math.random() * validMoves.length)];
        }
    }

    // 获取所有有效移动
    getAllValidMoves() {
        const moves = [];
        
        // 获取所有可放置位置
        const validCells = this.getValidPlacementCells();
        validCells.forEach(posStr => {
            const [row, col] = posStr.split(',');
            moves.push({
                row: parseInt(row),
                col: col,
                type: 'place'
            });
        });

        // 获取所有 Hopper 可能的移动
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 7; col++) {
                const piece = this.board[row][col];
                if (piece?.type === 'HOPPER' && piece.player === this.aiPlayer) {
                    // 添加九宫格内的所有可能移动
                    for (let r = row - 1; r <= row + 1; r++) {
                        for (let c = col - 1; c <= col + 1; c++) {
                            if (r >= 0 && r < 9 && c >= 0 && c < 7) {
                                moves.push({
                                    row: r + 1,
                                    col: String.fromCharCode(65 + c),
                                    type: 'hopper',
                                    from: {
                                        row: row + 1,
                                        col: String.fromCharCode(65 + col)
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }

        return moves;
    }

    // 评估移动的分数
    evaluateMove(move) {
        let score = 0;
        
        if (move.type === 'place') {
            score += 1;
            
            // 检查合成可能性
            if (this.checkDefenderFusion(move.row, move.col)) {
                score += 5;
                // 如果合成后可以立即发起战斗，增加分数
                if (this.canInitiateBattleAfterFusion(move.row, move.col, 'DEFENDER')) {
                    score += 3;
                }
            } else if (this.checkHopperFusion(move.row, move.col)) {
                score += 8;
                if (this.canInitiateBattleAfterFusion(move.row, move.col, 'HOPPER')) {
                    score += 4;
                }
            }
            
            // 战略位置评估
            score += this.evaluatePosition(move.row, move.col);
            
            // 如果靠近敌方堡垒，增加分数
            const distanceToFortress = this.getDistanceToEnemyFortress(move.row, move.col);
            score += (9 - distanceToFortress) * 0.5;
        } else if (move.type === 'hopper') {
            score += 3;
            
            // 评估 Hopper 移动
            if (this.canInitiateBattle(move.row, move.col)) {
                score += 4;
                // 如果可以发起有利战斗，增加更多分数
                if (this.isAdvantageousBattle(move.row, move.col)) {
                    score += 3;
                }
            }
            
            // 评移动后的位
            score += this.evaluatePosition(move.row, move.col);
        }
        
        return score;
    }

    // 选择最佳移动
    evaluateBestMove(moves) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        moves.forEach(move => {
            const score = this.evaluateMove(move);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        });
        
        return bestMove;
    }

    // 获取到敌方堡垒的距离
    getDistanceToEnemyFortress(row, col) {
        const fortressRow = this.aiPlayer === 'O' ? 9 : 1;
        const fortressCol = 3; // 'D' 列
        return Math.abs(row - fortressRow) + Math.abs(col.charCodeAt(0) - 65 - fortressCol);
    }

    // 检查是否可以发起战斗
    canInitiateBattle(row, col) {
        const colIndex = col.charCodeAt(0) - 65;
        const directions = [[-1,0], [1,0], [0,-1], [0,1]];
        
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = colIndex + dc;
            
            if (newRow >= 1 && newRow <= 9 && newCol >= 0 && newCol < 7) {
                const piece = this.getPieceAt(newRow, String.fromCharCode(65 + newCol));
                if (piece && piece.player !== this.aiPlayer) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // 评估位置的战略价值
    evaluatePosition(row, col) {
        let score = 0;
        
        // 控制中心位置
        const centerRow = 5;
        const centerCol = 3;
        const distanceToCenter = Math.abs(row - centerRow) + Math.abs(col.charCodeAt(0) - 65 - centerCol);
        score += (7 - distanceToCenter) * 0.3;
        
        // 控制关键路线
        if (col.charCodeAt(0) - 65 === 3) { // D 列
            score += 0.5;
        }
        
        // 防守位置
        if (this.aiPlayer === 'O' && row >= 7) {
            score += 0.3;
        } else if (this.aiPlayer === 'X' && row <= 3) {
            score += 0.3;
        }
        
        return score;
    }

    // 检查合成后是否可以发起战斗
    canInitiateBattleAfterFusion(row, col, pieceType) {
        const colIndex = col.charCodeAt(0) - 65;
        const directions = [[-1,0], [1,0], [0,-1], [0,1]];
        
        // 模拟合成后的状态
        const originalPiece = this.board[row-1][colIndex];
        this.board[row-1][colIndex] = {
            player: this.aiPlayer,
            type: pieceType
        };
        
        let canBattle = false;
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = colIndex + dc;
            
            if (newRow >= 1 && newRow <= 9 && newCol >= 0 && newCol < 7) {
                const piece = this.getPieceAt(newRow, String.fromCharCode(65 + newCol));
                if (piece && piece.player !== this.aiPlayer) {
                    canBattle = true;
                    break;
                }
            }
        }
        
        // 恢复原始状态
        this.board[row-1][colIndex] = originalPiece;
        
        return canBattle;
    }

    // 检查战斗是否有利
    isAdvantageousBattle(row, col) {
        const attackPower = this.calculateAttackPower({row, col});
        const defenders = this.getAdjacentEnemyPieces(row, col);
        const defensePower = this.calculateDefensePower(defenders);
        
        return attackPower > defensePower;
    }

    // 获取相邻的敌方棋子
    getAdjacentEnemyPieces(row, col) {
        const colIndex = col.charCodeAt(0) - 65;
        const directions = [[-1,0], [1,0], [0,-1], [0,1]];
        const enemies = [];
        
        directions.forEach(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = colIndex + dc;
            
            if (newRow >= 1 && newRow <= 9 && newCol >= 0 && newCol < 7) {
                const piece = this.getPieceAt(newRow, String.fromCharCode(65 + newCol));
                if (piece && piece.player !== this.aiPlayer) {
                    enemies.push({
                        row: newRow,
                        col: String.fromCharCode(65 + newCol)
                    });
                }
            }
        });
        
        return enemies;
    }

    // 处理合成模式下的点击
    handleFusionClick(cell) {
        if (!this.fusionMode) return;

        const row = parseInt(cell.dataset.row);
        const col = cell.dataset.col;
        const piece = this.getPieceAt(row, col);

        if (!this.selectedPiece) {
            // 第一次点击：选择中心点
            if (piece?.player === this.currentPlayer) {
                if (piece.type === 'PAWN' && this.checkDefenderFusion(row, col)) {
                    // Defender 合成
                    this.selectedPiece = { row, col, type: 'DEFENDER' };
                    this.highlightFusionArea(row, col, 'PAWN');
                    this.addLog(`选择了${col}${row}的Pawn��为Defender合成中心`, 'place');
                } else if (piece.type === 'DEFENDER' && this.checkHopperFusion(row, col)) {
                    // Hopper 合成
                    this.selectedPiece = { row, col, type: 'HOPPER' };
                    this.highlightFusionArea(row, col, 'DEFENDER');
                    this.addLog(`选择了${col}${row}的Defender作为Hopper合成中心`, 'place');
                }
            }
        } else {
            // 第二次点击：执行合成
            if (cell.classList.contains('active')) {
                if (this.selectedPiece.type === 'DEFENDER') {
                    this.fuseToDefender(this.selectedPiece.row, this.selectedPiece.col);
                    // 合成后检查战斗
                    if (this.checkForBattle(this.selectedPiece.row, this.selectedPiece.col)) {
                        this.fusionMode = false;
                        const fusionBtn = document.getElementById('fusion');
                        if (fusionBtn) {
                            fusionBtn.style.backgroundColor = '';
                        }
                        this.selectedPiece = null;
                        return;
                    }
                } else if (this.selectedPiece.type === 'HOPPER') {
                    this.fuseToHopper(this.selectedPiece.row, this.selectedPiece.col);
                    // 合成后检查战斗
                    if (this.checkForBattle(this.selectedPiece.row, this.selectedPiece.col)) {
                        this.fusionMode = false;
                        const fusionBtn = document.getElementById('fusion');
                        if (fusionBtn) {
                            fusionBtn.style.backgroundColor = '';
                        }
                        this.selectedPiece = null;
                        return;
                    }
                }
                
                // 退出合成模式
                this.fusionMode = false;
                const fusionBtn = document.getElementById('fusion');
                if (fusionBtn) {
                    fusionBtn.style.backgroundColor = '';
                }

                // 切换玩家
                this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
                this.updateValidPlacementCells();

                // 检查是否需要执行 AI 移动
                if (this.isAIEnabled && this.currentPlayer === this.aiPlayer) {
                    this.makeAIMove();
                }
            }
            this.selectedPiece = null;
        }
    }

    // 检查是否可以作为 Defender 合成的中心
    canBeDefenderCenter(row, col) {
        const pawnPositions = this.getPawnPositionsAroundPawn(row, col);
        return pawnPositions.length >= 4; // 需要中心点加上四个方向
    }

    // 获取 Pawn 周围的己方 Pawn 位置
    getPawnPositionsAroundPawn(row, col) {
        const positions = [];
        const directions = [[-1,0], [1,0], [0,-1], [0,1]]; // 上下左右
        const colIndex = col.charCodeAt(0) - 65;

        directions.forEach(([dr, dc]) => {
            const newRow = row + dr;
            const newCol = colIndex + dc;
            
            if (newRow >= 1 && newRow <= 9 && newCol >= 0 && newCol < 7) {
                const piece = this.getPieceAt(newRow, String.fromCharCode(65 + newCol));
                if (piece?.type === 'PAWN' && piece.player === this.currentPlayer) {
                    positions.push({row: newRow, col: newCol});
                }
            }
        });

        return positions;
    }

    // 检查是否可以作为 Hopper 合成的中心
    canBeHopperCenter(row, col) {
        const pawnPositions = this.getPawnPositionsAroundDefender(row, col);
        return pawnPositions.length === 8; // 需要周围八个位置都是 Pawn
    }

    // 获取 Defender 周围的己方 Pawn 位置
    getPawnPositionsAroundDefender(row, col) {
        const positions = [];
        const colIndex = col.charCodeAt(0) - 65;

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;

                const newRow = row + dr;
                const newCol = colIndex + dc;

                if (newRow >= 1 && newRow <= 9 && newCol >= 0 && newCol < 7) {
                    const piece = this.getPieceAt(newRow, String.fromCharCode(65 + newCol));
                    if (piece?.type === 'PAWN' && piece.player === this.currentPlayer) {
                        positions.push({row: newRow, col: newCol});
                    }
                }
            }
        }

        return positions;
    }

    // 高亮显示合成区域
    highlightFusionArea(row, col, pieceType) {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('active');
        });

        // 高亮中心点
        this.highlightCell(row, String.fromCharCode(65 + (col.charCodeAt(0) - 65)));

        // 高亮可能的合成位置
        if (pieceType === 'PAWN') {
            // Defender 合成：高亮十字形状
            const positions = this.getPawnPositionsAroundPawn(row, col);
            positions.forEach(pos => {
                this.highlightCell(pos.row, String.fromCharCode(65 + pos.col));
            });
        } else if (pieceType === 'DEFENDER') {
            // Hopper 合成：高亮九宫格
            const positions = this.getPawnPositionsAroundDefender(row, col);
            positions.forEach(pos => {
                this.highlightCell(pos.row, String.fromCharCode(65 + pos.col));
            });
        }
    }

    // 添加统计面板
    showStatsPanel() {
        const panel = document.createElement('div');
        panel.className = 'stats-panel';
        
        const gameStats = this.gameStats;
        const winRate = this.calculateWinRate();
        
        panel.innerHTML = `
            <div class="stats-content">
                <h2>游戏统计</h2>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-icon"><i class="fas fa-shield-alt"></i></div>
                        <div class="stat-info">
                            <h4>Defender 合成</h4>
                            <p>${gameStats.defenderCount} 次</p>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon"><i class="fas fa-bolt"></i></div>
                        <div class="stat-info">
                            <h4>Hopper 合成</h4>
                            <p>${gameStats.hopperCount} 次</p>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon"><i class="fas fa-crosshairs"></i></div>
                        <div class="stat-info">
                            <h4>战斗胜利</h4>
                            <p>${gameStats.battleWins} 次</p>
                        </div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-icon"><i class="fas fa-percentage"></i></div>
                        <div class="stat-info">
                            <h4>胜率</h4>
                            <p>${winRate}%</p>
                        </div>
                    </div>
                </div>
                <div class="stats-chart">
                    ${this.generateStatsChart()}
                </div>
                <button class="close-panel">关闭</button>
            </div>
        `;

        document.body.appendChild(panel);
        panel.querySelector('.close-panel').addEventListener('click', () => {
            panel.remove();
        });
    }

    // 生成统计图表
    generateStatsChart() {
        // 这里可以使用 Chart.js 或其他图表库
        // 暂时返回���单的 HTML 表格
        return `
            <table class="stats-table">
                <tr>
                    <th>类型</th>
                    <th>数量</th>
                    <th>占</th>
                </tr>
                <tr>
                    <td>Defender 合成</td>
                    <td>${this.gameStats.defenderCount}</td>
                    <td>${this.calculatePercentage('defenderCount')}%</td>
                </tr>
                <tr>
                    <td>Hopper 合成</td>
                    <td>${this.gameStats.hopperCount}</td>
                    <td>${this.calculatePercentage('hopperCount')}%</td>
                </tr>
                <tr>
                    <td>战斗胜利</td>
                    <td>${this.gameStats.battleWins}</td>
                    <td>${this.calculatePercentage('battleWins')}%</td>
                </tr>
            </table>
        `;
    }

    calculatePercentage(type) {
        const total = Object.values(this.gameStats).reduce((a, b) => a + b, 0);
        return ((this.gameStats[type] / total) * 100).toFixed(1);
    }

    calculateWinRate() {
        const totalGames = parseInt(localStorage.getItem('totalGames') || '0');
        const wins = parseInt(localStorage.getItem('playerWins') || '0');
        return totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0';
    }

    updateGameStatus() {
        const statusBar = document.querySelector('.game-status');
        if (statusBar) {
            statusBar.innerHTML = `
                <div class="player-indicator player-${this.currentPlayer.toLowerCase()}">
                    <div class="player-dot"></div>
                    <span>${this.currentPlayer}方回合</span>
                </div>
            `;
        }
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (this.selectedCell) {
                const row = parseInt(this.selectedCell.dataset.row);
                const col = this.selectedCell.dataset.col.charCodeAt(0) - 65;
                
                switch(e.key) {
                    case 'ArrowUp':
                        this.selectCell(row - 1, col);
                        break;
                    case 'ArrowDown':
                        this.selectCell(row + 1, col);
                        break;
                    case 'ArrowLeft':
                        this.selectCell(row, col - 1);
                        break;
                    case 'ArrowRight':
                        this.selectCell(row, col + 1);
                        break;
                    case 'Enter':
                    case ' ':
                        if (this.selectedCell.classList.contains('active')) {
                            this.handlePlacement(this.selectedCell);
                        }
                        break;
                    case 'Escape':
                        this.deselectCell();
                        break;
                }
                e.preventDefault();
            }
        });
    }

    selectCell(row, col) {
        if (row < 1 || row > 9 || col < 0 || col >= 7) return;
        
        const cell = document.querySelector(
            `.cell[data-row="${row}"][data-col="${String.fromCharCode(65 + col)}"]`
        );
        
        if (cell) {
            SoundManager.play('select');
            if (this.selectedCell) {
                this.selectedCell.classList.remove('selected');
            }
            this.selectedCell = cell;
            cell.classList.add('selected');
        }
    }

    deselectCell() {
        if (this.selectedCell) {
            this.selectedCell.classList.remove('selected');
            this.selectedCell = null;
        }
    }

    // 添加简单的教程显示方法
    showTutorial() {
        const steps = [
            {
                title: "基础棋子",
                content: "每回合可以在高亮区域放置一个基础棋子(Pawn)",
                icon: "chess-pawn",
                highlight: ".cell.active"
            },
            {
                title: "Defender合成",
                content: "五个Pawn呈十字形可以合成一个更强大的Defender",
                icon: "shield-alt",
                image: "assets/images/tutorial/defender-fusion.png"
            },
            {
                title: "Hopper合成",
                content: "一个Defender周围环绕八个Pawn可以合成最强大的Hopper",
                icon: "bolt",
                image: "assets/images/tutorial/hopper-fusion.png"
            },
            {
                title: "战斗规则",
                content: "周围的友方棋子会提供战斗力支援，攻击力大于防御力时可以消灭对方棋子",
                icon: "swords",
                image: "assets/images/tutorial/battle.png"
            }
        ];

        let currentStep = 0;

        const tutorial = document.createElement('div');
        tutorial.className = 'tutorial-modal';
        
        function updateTutorialContent() {
            const step = steps[currentStep];
            tutorial.innerHTML = `
                <div class="tutorial-content">
                    <div class="tutorial-header">
                        <div class="step-indicator">
                            ${steps.map((_, index) => `
                                <div class="step-dot ${index === currentStep ? 'active' : ''}"></div>
                            `).join('')}
                        </div>
                        <button class="close-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="tutorial-body">
                        <div class="tutorial-icon">
                            <i class="fas fa-${step.icon}"></i>
                        </div>
                        <h3>${step.title}</h3>
                        <p>${step.content}</p>
                        ${step.image ? `<img src="${step.image}" alt="${step.title}">` : ''}
                    </div>
                    
                    <div class="tutorial-footer">
                        <button class="prev-btn" ${currentStep === 0 ? 'disabled' : ''}>
                            <i class="fas fa-arrow-left"></i> 上一步
                        </button>
                        <button class="next-btn">
                            ${currentStep === steps.length - 1 ? '开始游戏' : '下一步 <i class="fas fa-arrow-right"></i>'}
                        </button>
                    </div>
                </div>
            `;

            // 添加事件监听器
            tutorial.querySelector('.close-btn').addEventListener('click', closeTutorial);
            tutorial.querySelector('.prev-btn').addEventListener('click', showPrevStep);
            tutorial.querySelector('.next-btn').addEventListener('click', showNextStep);
        }

        function showNextStep() {
            if (currentStep < steps.length - 1) {
                currentStep++;
                updateTutorialContent();
            } else {
                closeTutorial();
            }
        }

        function showPrevStep() {
            if (currentStep > 0) {
                currentStep--;
                updateTutorialContent();
            }
        }

        function closeTutorial() {
            tutorial.classList.add('fade-out');
            setTimeout(() => {
                tutorial.remove();
                localStorage.setItem('tutorialCompleted', 'true');
            }, 300);
        }

        updateTutorialContent();
        document.body.appendChild(tutorial);
    }

    // 在错误操作时播放错误音效
    handleInvalidMove() {
        SoundManager.play('error');
    }
}

// 初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    new TycerineGame();
}); 