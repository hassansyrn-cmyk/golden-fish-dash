/**
 * Advanced Particle System for Golden Fish Dash
 * Handles all visual effects: coins, explosions, trails, etc.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'coin' | 'spark' | 'trail' | 'debris' | 'star' | 'bubble';
  opacity: number;
  rotation: number;
  rotationVel: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private gravity = 0.15;

  /**
   * Create coin collection burst (5-8 particles)
   */
  burstCoins(x: number, y: number, count: number = 6) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 3 + Math.random() * 2;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0,
        maxLife: 40,
        size: 6,
        color: '#ffd60a',
        type: 'coin',
        opacity: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationVel: Math.random() * 0.3 - 0.15,
      });
    }
  }

  /**
   * Create spark effect on obstacle hit
   */
  sparkHit(x: number, y: number, count: number = 8, color: string = '#ff4d6d') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 4 + Math.random() * 3;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 0,
        maxLife: 35,
        size: 4,
        color,
        type: 'spark',
        opacity: 1,
        rotation: 0,
        rotationVel: 0,
      });
    }
  }

  /**
   * Create glowing trail effect for fish movement
   */
  addTrail(x: number, y: number, baseColor: string = '#00d9ff') {
    const trail: Particle = {
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      life: 0,
      maxLife: 20,
      size: 3 + Math.random() * 2,
      color: baseColor,
      type: 'trail',
      opacity: 0.8,
      rotation: Math.random() * Math.PI * 2,
      rotationVel: 0.05,
    };
    this.particles.push(trail);
  }

  /**
   * Create debris explosion
   */
  explosion(x: number, y: number, count: number = 12, color: string = '#ff6b6b') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 4;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 0,
        maxLife: 45,
        size: 5 + Math.random() * 3,
        color,
        type: 'debris',
        opacity: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationVel: Math.random() * 0.2 - 0.1,
      });
    }
  }

  /**
   * Create achievement star burst
   */
  starBurst(x: number, y: number, count: number = 10) {
    const colors = ['#ffd60a', '#ff9500', '#ffc300'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 5 + Math.random() * 2;
      
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 50,
        size: 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'star',
        opacity: 1,
        rotation: 0,
        rotationVel: 0.15,
      });
    }
  }

  /**
   * Create bubble effect for slow zones
   */
  bubbleEffect(x: number, y: number, count: number = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1;
      
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 0,
        maxLife: 60,
        size: 6 + Math.random() * 4,
        color: '#4fe3c1',
        type: 'bubble',
        opacity: 0.6,
        rotation: 0,
        rotationVel: 0.02,
      });
    }
  }

  /**
   * Update all particles (physics + lifecycle)
   */
  update() {
    this.particles = this.particles.filter(p => {
      p.life++;
      
      // Physics
      p.vy += this.gravity;
      p.x += p.vx;
      p.y += p.vy;
      
      // Rotation
      p.rotation += p.rotationVel;
      
      // Opacity fade-out (last 10 frames)
      if (p.life > p.maxLife - 10) {
        p.opacity = (p.maxLife - p.life) / 10;
      }
      
      // Air resistance
      p.vx *= 0.98;
      p.vy *= 0.98;
      
      return p.life < p.maxLife;
    });
  }

  /**
   * Render all particles on canvas
   */
  render(ctx: CanvasRenderingContext2D) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      // Draw based on type
      switch (p.type) {
        case 'coin':
        case 'star':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'spark':
        case 'debris':
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          break;

        case 'trail':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'bubble':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }

      ctx.restore();
    });
  }

  clear() {
    this.particles = [];
  }

  getParticleCount() {
    return this.particles.length;
  }
}
