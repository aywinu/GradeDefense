/**
 * BattleScene: Main gameplay scene with layout, towers, and enemy spawning
 * Ref: .kiro/specs/deadline-defense/tasks.md Phase 3.3-3.5
 */

import Phaser from 'phaser';
import { Palette } from '../palette';
import { Layout, towerPosition, fortressPosition, enemySpawnPosition } from '../layout';
import { TowerView } from '../entities/TowerView';
import { EnemyView } from '../entities/EnemyView';
import { resolveSemester } from '../../core/semester';
import { generateWave, campaignLength } from '../../core/wave';
import { stepSimulation } from '../../core/sim';
import { mulberry32 } from '../../core/rng';
import type { DemoSemester, Semester, GameState, EnemyStats, TowerStats } from '../../core/types';

// Import demo data (will be replaced with actual import at runtime)
import demoData from '../../data/demo.json';

export class BattleScene extends Phaser.Scene {
  private semester!: Semester;
  private gameState!: GameState;
  private gameOver = false; // Flag to prevent multiple victory/defeat triggers
  
  // Visual objects (keyed by ID)
  private towerViews: Map<string, TowerView> = new Map();
  private enemyViews: Map<string, EnemyView> = new Map();
  
  // HUD elements
  private hudText!: Phaser.GameObjects.Text;
  
  constructor() {
    super({ key: 'BattleScene' });
  }

  create() {
    // Load demo data and resolve dates
    this.semester = resolveSemester(demoData as DemoSemester, new Date());
    
    // Initialize game state
    this.initializeGameState();
    
    // Draw battlefield layout
    this.drawLayout();
    
    // Create HUD
    this.createHUD();
    
    // Spawn towers
    this.spawnTowers();
    
    // Generate and spawn first wave
    this.spawnWave(1);
    
    // Input handlers
    this.setupInput();
  }

  /**
   * Initialize game state
   */
  private initializeGameState(): void {
    this.gameState = {
      wave: 1,
      gold: 0,
      fortressHp: 100,
      maxFortressHp: 100,
      towers: [],
      enemies: [],
      chargeMeter: 0,
      answeredQuestions: [],
      lastAnswerTime: 0,
    };
  }

  /**
   * Draw battlefield layout (lanes, fortress, background)
   */
  private drawLayout(): void {
    const graphics = this.add.graphics();
    
    // Draw lane dividers (subtle lines)
    graphics.lineStyle(1, Palette.Mist, 0.3);
    for (let i = 0; i <= Layout.LANE_COUNT; i++) {
      const y = Layout.LANE_START_Y + i * ((Layout.LANE_END_Y - Layout.LANE_START_Y) / Layout.LANE_COUNT);
      graphics.lineTo(Layout.CANVAS_WIDTH, y);
      graphics.strokePath();
    }
    
    // Draw fortress (grimoire desk) - simple rectangle for now
    const fortress = fortressPosition();
    graphics.fillStyle(Palette.Stone, 0.8);
    graphics.fillRect(
      Layout.FORTRESS_X_MIN,
      fortress.y - 100,
      Layout.FORTRESS_X_MAX - Layout.FORTRESS_X_MIN,
      200
    );
    graphics.lineStyle(2, Palette.Parchment, 0.5);
    graphics.strokeRect(
      Layout.FORTRESS_X_MIN,
      fortress.y - 100,
      Layout.FORTRESS_X_MAX - Layout.FORTRESS_X_MIN,
      200
    );
    
    // Fortress label
    this.add.text(fortress.x, fortress.y, 'FORTRESS', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '24px',
      color: '#e9dcc0',
      align: 'center',
    }).setOrigin(0.5);
  }

  /**
   * Create HUD elements
   */
  private createHUD(): void {
    this.hudText = this.add.text(16, 16, '', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '18px',
      color: '#e9dcc0',
    });
    
    this.updateHUD();
  }

  /**
   * Update HUD display
   */
  private updateHUD(): void {
    const { wave, gold, fortressHp, maxFortressHp, chargeMeter } = this.gameState;
    this.hudText.setText([
      `Wave: ${wave}`,
      `Gold: ${gold}`,
      `Fortress HP: ${fortressHp}/${maxFortressHp}`,
      `Charge: ${Math.floor(chargeMeter)}%`,
    ]);
  }

  /**
   * Spawn towers (one per course)
   */
  private spawnTowers(): void {
    this.semester.courses.forEach((course, index) => {
      const pos = towerPosition(index);
      
      // Create tower stats
      const towerStats: TowerStats = {
        courseId: course.id,
        x: pos.x,
        y: pos.y,
        range: 150,
        damage: 10,
        fireRate: 1,
        lastFiredAt: 0,
        upgrades: {
          damage: 0,
          speed: 0,
          range: 0,
        },
      };
      
      this.gameState.towers.push(towerStats);
      
      // Create tower view
      const towerView = new TowerView(this, pos.x, pos.y, course.id, 150);
      this.towerViews.set(course.id, towerView);
    });
  }

  /**
   * Spawn wave of enemies
   */
  private spawnWave(waveNumber: number): void {
    const now = Date.now();
    const waveEnemies = generateWave(this.semester, waveNumber, now);
    
    // Add enemies to game state
    this.gameState.enemies = waveEnemies;
    
    // Schedule spawns with delays
    waveEnemies.forEach((enemy) => {
      this.time.delayedCall(enemy.spawnDelayMs, () => {
        this.spawnEnemy(enemy);
      });
    });
  }

  /**
   * Spawn a single enemy
   */
  private spawnEnemy(enemy: EnemyStats): void {
    const pos = enemySpawnPosition(enemy.lane);
    
    const enemyView = new EnemyView(
      this,
      pos.x,
      pos.y,
      enemy.courseId,
      enemy.type,
      enemy.label,
      enemy.daysLeft,
      enemy.isMinion || false
    );
    
    this.enemyViews.set(enemy.id, enemyView);
    
    // Apply visual effects for special states
    if (enemy.isOverdue) {
      enemyView.applyOverdueEffect();
    }
    
    // Update HP bar
    enemyView.updateHpBar(enemy.hp, enemy.maxHp);
  }

  /**
   * Setup input handlers
   */
  private setupInput(): void {
    // ESC to return to title (temporary, will be replaced with pause menu)
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start('TitleScene');
    });
  }

  update(_time: number, delta: number): void {
    // Skip if game is over
    if (this.gameOver) {
      return;
    }
    
    // Check for defeat
    if (this.gameState.fortressHp <= 0) {
      this.gameOver = true;
      this.onDefeat();
      return;
    }
    
    // Run simulation step
    const result = this.stepGameSimulation(delta);
    
    // Handle events from simulation
    this.handleSimulationEvents(result.events);
    
    // Update visuals to match new state
    this.syncVisualsToState();
    
    // Update HUD every frame
    this.updateHUD();
  }

  /**
   * Run one step of the game simulation
   */
  private stepGameSimulation(delta: number): import('../../core/sim').SimResult {
    const rng = mulberry32(Date.now()); // Use wall-clock seed for now
    
    const result = stepSimulation(this.gameState, delta, rng);
    this.gameState = result.state;
    
    return result;
  }

  /**
   * Handle events emitted by the simulation
   */
  private handleSimulationEvents(events: import('../../core/sim').SimEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'projectile':
          this.renderProjectile(event.fromX, event.fromY, event.toX, event.toY);
          break;
        
        case 'hit':
          // Update enemy HP bar
          const enemyView = this.enemyViews.get(event.enemyId);
          if (enemyView) {
            const enemy = this.gameState.enemies.find(e => e.id === event.enemyId);
            if (enemy) {
              enemyView.updateHpBar(enemy.hp, enemy.maxHp);
            }
          }
          break;
        
        case 'kill':
          // Remove enemy view
          const killedView = this.enemyViews.get(event.enemyId);
          if (killedView) {
            killedView.destroy();
            this.enemyViews.delete(event.enemyId);
          }
          break;
        
        case 'fortressHit':
          // Visual feedback for fortress damage (flash, shake, etc.)
          this.cameras.main.shake(200, 0.005);
          break;
        
        case 'waveCleared':
          this.onWaveCleared();
          break;
      }
    }
  }

  /**
   * Sync visual positions to game state
   */
  private syncVisualsToState(): void {
    for (const enemy of this.gameState.enemies) {
      const enemyView = this.enemyViews.get(enemy.id);
      if (enemyView) {
        enemyView.setPosition(enemy.x, enemy.y);
        enemyView.updateHpBar(enemy.hp, enemy.maxHp);
      }
    }
  }

  /**
   * Render a projectile (simple line for now)
   */
  private renderProjectile(fromX: number, fromY: number, toX: number, toY: number): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, Palette.Spectral, 1);
    graphics.lineBetween(fromX, fromY, toX, toY);
    
    // Fade out and destroy after 100ms
    this.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 100,
      onComplete: () => graphics.destroy(),
    });
  }

  /**
   * Handle wave cleared
   */
  private onWaveCleared(): void {
    // Check if this was the last wave (campaign complete)
    const totalWaves = campaignLength(this.semester, Date.now());
    
    if (this.gameState.wave >= totalWaves) {
      this.onVictory();
      return;
    }
    
    // Display "Wave Cleared" message
    const message = this.add.text(
      Layout.CANVAS_WIDTH / 2,
      Layout.CANVAS_HEIGHT / 2,
      `Wave ${this.gameState.wave} Cleared!`,
      {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '48px',
        color: '#6ee7d0',
        stroke: '#07060b',
        strokeThickness: 4,
      }
    ).setOrigin(0.5);
    
    // Fade in, hold, fade out
    this.tweens.add({
      targets: message,
      alpha: { from: 0, to: 1 },
      duration: 300,
      yoyo: true,
      hold: 2000,
      onComplete: () => {
        message.destroy();
        this.startNextWave();
      },
    });
  }

  /**
   * Start the next wave after a delay
   */
  private startNextWave(): void {
    this.time.delayedCall(3000, () => {
      this.gameState.wave++;
      this.spawnWave(this.gameState.wave);
    });
  }

  /**
   * Handle victory (semester saved)
   */
  private onVictory(): void {
    this.gameOver = true;
    
    // Display victory message
    this.add.text(
      Layout.CANVAS_WIDTH / 2,
      Layout.CANVAS_HEIGHT / 2 - 50,
      'SEMESTER SAVED',
      {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '64px',
        color: '#6ee7d0',
        stroke: '#07060b',
        strokeThickness: 6,
      }
    ).setOrigin(0.5);
    
    this.add.text(
      Layout.CANVAS_WIDTH / 2,
      Layout.CANVAS_HEIGHT / 2 + 50,
      'Press ENTER to restart',
      {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '24px',
        color: '#e9dcc0',
      }
    ).setOrigin(0.5);
    
    // Listen for Enter key
    this.input.keyboard?.once('keydown-ENTER', () => {
      this.scene.start('TitleScene');
    });
  }

  /**
   * Handle defeat (fortress HP hit 0)
   */
  private onDefeat(): void {
    this.gameOver = true;
    
    // Display defeat message
    this.add.text(
      Layout.CANVAS_WIDTH / 2,
      Layout.CANVAS_HEIGHT / 2 - 50,
      'THE SEMESTER HAS FALLEN',
      {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '64px',
        color: '#b3202c',
        stroke: '#07060b',
        strokeThickness: 6,
      }
    ).setOrigin(0.5);
    
    this.add.text(
      Layout.CANVAS_WIDTH / 2,
      Layout.CANVAS_HEIGHT / 2 + 50,
      'Press ENTER to restart',
      {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '24px',
        color: '#e9dcc0',
      }
    ).setOrigin(0.5);
    
    // Listen for Enter key
    this.input.keyboard?.once('keydown-ENTER', () => {
      this.scene.start('TitleScene');
    });
  }
}
