/**
 * Advanced Obstacle System
 * Multiple obstacle types with varied behaviors and visual effects
 */

export type ObstacleType = 'pipe' | 'spike' | 'rotating' | 'moving' | 'chain';

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: ObstacleType;
  rotation: number;
  rotationSpeed: number;
  vx: number; // velocity for moving obstacles
  amplitude: number; // for oscillating obstacles
  frequency: number;
  active: boolean;
  color: string;
}

export class AdvancedObstacleSystem {
  private obstacles: Obstacle[] = [];
  private nextId = 0;
  private gameWidth: number;
  private gameHeight: number;
  private time = 0;

  constructor(gameWidth: number, gameHeight: number) {
    this.gameWidth = gameWidth;
    this.gameHeight = gameHeight;
  }

  /**
   * Spawn obstacle at specific position
   */
  spawnObstacle(x: number, y: number, difficulty: number = 1): Obstacle {
    const types: ObstacleType[] = ['pipe', 'spike', 'rotating', 'moving', 'chain'];
    
    // Higher difficulty = more variety
    let type: ObstacleType;
    if (difficulty < 2) {
      type = 'pipe';
    } else if (difficulty < 4) {
      type = types[Math.floor(Math.random() * 2)]; // pipe or spike
    } else if (difficulty < 6) {
      type = types[Math.floor(Math.random() * 3)]; // add rotating
    } else {
      type = types[Math.floor(Math.random() * types.length)]; // all types
    }

    return this.createObstacle(x, y, type, difficulty);
  }

  private createObstacle(x: number, y: number, type: ObstacleType, difficulty: number): Obstacle {
    const baseSize = 40;
    
    const obstacle: Obstacle = {
      id: `obstacle-${this.nextId++}`,
      x,
      y,
      width: baseSize,
      height: baseSize,
      type,
      rotation: 0,
      rotationSpeed: 0,
      vx: 0,
      amplitude: 0,
      frequency: 0,
      active: true,
      color: this.getObstacleColor(type),
    };

    // Configure based on type
    switch (type) {
      case 'pipe':
        obstacle.width = 50;
        obstacle.height = 80;
        break;

      case 'spike':
        obstacle.width = 30;
        obstacle.height = 60;
        break;

      case 'rotating':
        obstacle.rotationSpeed = 0.05 * difficulty;
        obstacle.width = 50;
        obstacle.height = 50;
        break;

      case 'moving':
        obstacle.vx = 2 + difficulty * 0.5; // Moves left
        obstacle.amplitude = 15 + difficulty * 5;
        obstacle.frequency = 0.02;
        obstacle.width = 45;
        obstacle.height = 45;
        break;

      case 'chain':
        obstacle.width = 40;
        obstacle.height = 40;
        obstacle.amplitude = 10;
        obstacle.frequency = 0.03;
        break;
    }

    return obstacle;
  }

  /**
   * Update all obstacles
   */
  update(scrollSpeed: number) {
    this.time++;

    this.obstacles = this.obstacles.filter(obs => {
      // Move obstacle left (screen scrolling)
      obs.x -= scrollSpeed;

      // Type-specific updates
      switch (obs.type) {
        case 'rotating':
          obs.rotation += obs.rotationSpeed;
          break;

        case 'moving':
          obs.vx = Math.max(-3, obs.vx - 0.02); // Accelerate left over time
          obs.x += obs.vx;
          // Oscillate vertically
          obs.y += Math.sin(this.time * obs.frequency) * 0.5;
          break;

        case 'chain':
          // Swing motion
          obs.y += Math.sin(this.time * obs.frequency) * 0.3;
          break;
      }

      // Remove if off-screen
      return obs.x > -100;
    });
  }

  /**
   * Check collision with fish
   */
  checkCollision(fishX: number, fishY: number, fishRadius: number): Obstacle | null {
    for (const obs of this.obstacles) {
      if (!obs.active) continue;

      // Circular collision detection
      const dx = fishX - obs.x;
      const dy = fishY - obs.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const obstacleRadius = Math.max(obs.width, obs.height) / 2;
      if (distance < fishRadius + obstacleRadius) {
        return obs;
      }
    }

    return null;
  }

  /**
   * Get all active obstacles
   */
  getObstacles(): Obstacle[] {
    return this.obstacles;
  }

  /**
   * Render obstacles on canvas
   */
  render(ctx: CanvasRenderingContext2D) {
    this.obstacles.forEach(obs => {
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.rotation);

      // Glow effect for some types
      if (obs.type === 'rotating' || obs.type === 'spike') {
        ctx.shadowColor = obs.color;
        ctx.shadowBlur = 10;
      }

      ctx.fillStyle = obs.color;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;

      switch (obs.type) {
        case 'pipe':
          // Rectangular pipe with beveled edges
          this.drawPipe(ctx, obs);
          break;

        case 'spike':
          // Triangle spike
          this.drawSpike(ctx, obs);
          break;

        case 'rotating':
          // Rotating square with sharp edges
          this.drawRotatingObstacle(ctx, obs);
          break;

        case 'moving':
          // Round moving obstacle
          ctx.beginPath();
          ctx.arc(0, 0, obs.width / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;

        case 'chain':
          // Chain-link pattern
          this.drawChainLink(ctx, obs);
          break;
      }

      ctx.restore();
    });
  }

  private drawPipe(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    // Main body
    ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
    ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);

    // Inner hollow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(-obs.width / 3, -obs.height / 3, (obs.width * 2) / 3, (obs.height * 2) / 3);
  }

  private drawSpike(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    // Triangle
    ctx.beginPath();
    ctx.moveTo(0, -obs.height / 2);
    ctx.lineTo(obs.width / 2, obs.height / 2);
    ctx.lineTo(-obs.width / 2, obs.height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawRotatingObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    // Rotating star-like shape
    const points = 4;
    const radius = obs.width / 2;
    
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i / (points * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? radius : radius * 0.6;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawChainLink(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    // Draw multiple connected circles
    const links = 2;
    for (let i = 0; i < links; i++) {
      const offsetY = (i - links / 2 + 0.5) * 15;
      ctx.beginPath();
      ctx.arc(0, offsetY, obs.width / 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private getObstacleColor(type: ObstacleType): string {
    switch (type) {
      case 'pipe': return '#8b5a2b';
      case 'spike': return '#ff6b6b';
      case 'rotating': return '#ff9500';
      case 'moving': return '#c41e3a';
      case 'chain': return '#663399';
      default: return '#ff0000';
    }
  }

  /**
   * Clear all obstacles
   */
  clear() {
    this.obstacles = [];
  }

  /**
   * Get obstacle count
   */
  getCount(): number {
    return this.obstacles.length;
  }

  setDimensions(width: number, height: number) {
    this.gameWidth = width;
    this.gameHeight = height;
  }
}
