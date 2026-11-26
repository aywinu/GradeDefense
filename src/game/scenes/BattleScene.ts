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
import { generateWave } from '../../core/wave';
import type { DemoSemester, Semester, GameState, EnemyStats, TowerStats } from '../../core/types';

// Import demo data (will be replaced with actual import at runtime)
import demoData from '../../data/demo.json';

export class BattleScene extends Phaser.Scene {
  private semester!: Semester;
  private gameState!: GameState;
  
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

  update(_time: number, _delta: number): void {
    // TODO: Enemy movement (Phase 3.6)
    // TODO: Tower firing (Phase 3.7)
    // TODO: Wave end detection (Phase 3.8)
    
    // Update HUD every frame
    this.updateHUD();
  }
}
