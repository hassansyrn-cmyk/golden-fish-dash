/**
 * Dynamic Background Renderer with Parallax Effect
 * Creates depth and immersion with multiple scrolling layers
 */

interface BackgroundLayer {
  depth: number; // 0-1, affects parallax speed
  speed: number;
  offset: number;
  elements: BackgroundElement[];
}

interface BackgroundElement {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  type: 'bubble' | 'plant' | 'rock' | 'wave';
}

export class BackgroundRenderer {
  private layers: BackgroundLayer[] = [];
  private scrollOffset = 0;
  private waveOffset = 0;

  constructor(private width: number, private height: number) {
    this.initializeLayers();
  }

  private initializeLayers() {
    // Layer 1: Far background (slowest)
    this.layers.push({
      depth: 0.1,
      speed: 0.3,
      offset: 0,
      elements: this.generateLayer1Elements(),
    });

    // Layer 2: Mid background
    this.layers.push({
      depth: 0.4,
      speed: 0.6,
      offset: 0,
      elements: this.generateLayer2Elements(),
    });

    // Layer 3: Near foreground (fastest)
    this.layers.push({
      depth: 0.8,
      speed: 0.9,
      offset: 0,
      elements: this.generateLayer3Elements(),
    });
  }

  private generateLayer1Elements(): BackgroundElement[] {
    const elements: BackgroundElement[] = [];
    
    // Distant bubbles
    for (let i = 0; i < 6; i++) {
      elements.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height * 0.5,
        width: 15 + Math.random() * 10,
        height: 15 + Math.random() * 10,
        color: 'rgba(79, 227, 193, 0.15)',
        opacity: 0.3,
        type: 'bubble',
      });
    }

    return elements;
  }

  private generateLayer2Elements(): BackgroundElement[] {
    const elements: BackgroundElement[] = [];
    
    // Medium bubbles and plants
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        // Bubbles
        elements.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          width: 20 + Math.random() * 15,
          height: 20 + Math.random() * 15,
          color: 'rgba(79, 227, 193, 0.25)',
          opacity: 0.5,
          type: 'bubble',
        });
      } else {
        // Sea plants
        elements.push({
          x: Math.random() * this.width,
          y: this.height * 0.6 + Math.random() * this.height * 0.4,
          width: 8,
          height: 40 + Math.random() * 30,
          color: 'rgba(76, 175, 80, 0.4)',
          opacity: 0.4,
          type: 'plant',
        });
      }
    }

    return elements;
  }

  private generateLayer3Elements(): BackgroundElement[] {
    const elements: BackgroundElement[] = [];
    
    // Larger bubbles and rocks in foreground
    for (let i = 0; i < 10; i++) {
      if (i % 3 === 0) {
        // Rocks/terrain
        elements.push({
          x: Math.random() * this.width,
          y: this.height - 60,
          width: 30 + Math.random() * 40,
          height: 40 + Math.random() * 30,
          color: 'rgba(139, 69, 19, 0.6)',
          opacity: 0.6,
          type: 'rock',
        });
      } else {
        // Large bubbles
        elements.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height * 0.8,
          width: 25 + Math.random() * 25,
          height: 25 + Math.random() * 25,
          color: 'rgba(79, 227, 193, 0.35)',
          opacity: 0.6,
          type: 'bubble',
        });
      }
    }

    return elements;
  }

  /**
   * Update background scrolling and wave effect
   */
  update(gameScrollSpeed: number) {
    this.scrollOffset += gameScrollSpeed * 0.3;
    this.waveOffset += 0.05;

    // Update each layer's offset based on depth
    this.layers.forEach(layer => {
      layer.offset = (this.scrollOffset * layer.speed) % (this.width * 2);
    });
  }

  /**
   * Render background with parallax and animated elements
   */
  render(ctx: CanvasRenderingContext2D) {
    // Base gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#0a3a5e');
    gradient.addColorStop(0.5, '#041d33');
    gradient.addColorStop(1, '#021221');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    // Render each layer
    this.layers.forEach((layer, layerIndex) => {
      this.renderLayer(ctx, layer, layerIndex);
    });

    // Render animated waves at bottom
    this.renderWaveEffect(ctx);
  }

  private renderLayer(ctx: CanvasRenderingContext2D, layer: BackgroundLayer, layerIndex: number) {
    ctx.save();
    ctx.globalAlpha = layer.depth * 0.8;

    layer.elements.forEach(elem => {
      // Calculate parallax position
      const x = (elem.x - layer.offset) % (this.width * 2);
      const parallaxY = elem.y + Math.sin(this.waveOffset + elem.x * 0.01) * 3;

      ctx.globalAlpha = elem.opacity;
      ctx.fillStyle = elem.color;

      switch (elem.type) {
        case 'bubble':
          ctx.beginPath();
          ctx.arc(x, parallaxY, elem.width / 2, 0, Math.PI * 2);
          ctx.fill();
          // Bubble outline
          ctx.strokeStyle = 'rgba(79, 227, 193, 0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;

        case 'plant':
          // Wavy plant
          ctx.beginPath();
          ctx.moveTo(x, parallaxY);
          for (let i = 0; i < elem.height; i += 5) {
            const waveX = x + Math.sin(this.waveOffset + i * 0.02) * 3;
            ctx.lineTo(waveX, parallaxY + i);
          }
          ctx.lineWidth = elem.width;
          ctx.strokeStyle = elem.color;
          ctx.stroke();
          break;

        case 'rock':
          // Rounded rock
          ctx.fillRect(x - elem.width / 2, parallaxY - elem.height / 2, elem.width, elem.height);
          break;

        case 'wave':
          // Wave pattern
          ctx.beginPath();
          ctx.moveTo(x, parallaxY);
          for (let i = 0; i < elem.width; i += 5) {
            const y = parallaxY + Math.sin((this.waveOffset + i) * 0.05) * elem.height;
            ctx.lineTo(x + i, y);
          }
          ctx.strokeStyle = elem.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
      }
    });

    ctx.restore();
  }

  private renderWaveEffect(ctx: CanvasRenderingContext2D) {
    const waveHeight = 8;
    const waveFrequency = 0.05;
    const waveSpeed = this.waveOffset;

    ctx.strokeStyle = 'rgba(79, 227, 193, 0.4)';
    ctx.lineWidth = 2;

    for (let i = 0; i < 3; i++) {
      const yOffset = this.height - 20 - i * 15;
      ctx.beginPath();

      for (let x = 0; x <= this.width; x += 10) {
        const y = yOffset + Math.sin((x * waveFrequency) + waveSpeed) * waveHeight;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    }
  }

  /**
   * Reset background state
   */
  reset() {
    this.scrollOffset = 0;
    this.waveOffset = 0;
  }

  setDimensions(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}
