class FrameAnimator {
    constructor(options) {
      if (!options.canvas) throw new Error('Canvas обязателен');
      if (!options.prefix) throw new Error('Prefix обязателен');
      if (!options.frameCount) throw new Error('Количество кадров обязательно');
  
      this.canvas = options.canvas;
      this.ctx = this.canvas.getContext('2d');
      this.prefix = options.prefix;
      this.frameCount = options.frameCount;
      this.imagePath = this.normalizePath(options.imagePath || './media/imgOpt/');
      this.digits = options.digits || 3;
      this.fps = options.fps || 24;
      this.loop = options.loop !== false;
      this.autoplay = options.autoplay !== false;
      this.playOnce = options.playOnce || false;
  
      this.images = new Array(this.frameCount).fill(null);
      this.currentFrame = 0;
      this.isPlaying = false;
      this.animationId = null;
      this.hasError = false;
      this.originalWidth = 0;
      this.originalHeight = 0;
      this.scale = 1;
      this.hasPlayed = false;
      this.loadedCount = 0;
  
      this.init();
    }
  
    async init() {
      try {
        const firstFrame = await this.loadImage(1);
        this.originalWidth = firstFrame.naturalWidth;
        this.originalHeight = firstFrame.naturalHeight;
        this.setupResizeObserver();
        this.updateCanvasSize();
  
        await this.loadAllFrames();
  
        if (this.autoplay) this.play();
  
        setTimeout(() => {
          document.body.classList.add('loaded');
        }, 500);
  
      } catch (err) {
        console.error('Ошибка инициализации:', err);
        document.body.classList.add('loaded');
      }
    }
  
    async loadAllFrames() {
      const batchSize = 45;
      
      for (let i = 1; i <= this.frameCount; i += batchSize) {
        const end = Math.min(i + batchSize - 1, this.frameCount);
        const frameNumbers = Array.from({length: end - i + 1}, (_, idx) => i + idx);
        
        await Promise.all(
          frameNumbers.map(frameNum => this.loadFrame(frameNum))
        );
      }
    }
  
    async loadFrame(frameNum) {
      if (this.images[frameNum - 1]) return;
      const img = await this.loadImage(frameNum);
      this.images[frameNum - 1] = img;
      this.loadedCount++;
      return img;
    }
  
    loadImage(frameNum) {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = this.getFramePath(frameNum);
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    }
  
    play() {
      if (this.isPlaying || this.hasError) return;
      this.currentFrame = 0;
      this.hasPlayed = false;
      this.isPlaying = true;
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.animate.bind(this));
    }
  
    playFromFrame(startFrame) {
      if (this.isPlaying || this.hasError) return;
      
      startFrame = Math.max(0, Math.min(startFrame, this.frameCount - 1));
      this.currentFrame = startFrame;
      this.hasPlayed = false;
      this.isPlaying = true;
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.animate.bind(this));
    }
  
    animate(timestamp) {
      if (!this.isPlaying) return;
      
      const delta = timestamp - this.lastTime;
      if (delta > 1000 / this.fps) {
        this.renderFrame();
        this.lastTime = timestamp - (delta % (1000 / this.fps));
        
        if (this.currentFrame === this.frameCount - 1) {
          this.hasPlayed = true;
          if (this.playOnce && !this.loop) {
            this.stop();
            return;
          }
        }
      }
      
      if (!this.playOnce || !this.hasPlayed) {
        this.animationId = requestAnimationFrame(this.animate.bind(this));
      }
    }
  
    renderFrame() {
      try {
        if (!this.playOnce || !this.hasPlayed || this.loop) {
          this.currentFrame = (this.currentFrame + 1) % this.frameCount;
        }
        
        const img = this.images[this.currentFrame];
        if (!img) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(
          img, 
          0, 0, this.originalWidth, this.originalHeight,
          0, 0, this.canvas.width, this.canvas.height
        );
      } catch (err) {
        this.stop();
      }
    }
  
    stop() {
      this.isPlaying = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
    }
  
    normalizePath(path) { return path.endsWith('/') ? path : path + '/'; }
    
    getFramePath(index) {
      return `${this.imagePath}${this.prefix}/${this.prefix}${index.toString().padStart(this.digits, '0')}.webp`;
    }
  
    setupResizeObserver() {
      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', () => this.handleResize());
        return;
      }
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  
    handleResize() {
      if (!this.originalWidth || !this.originalHeight) return;
      this.updateCanvasSize();
      this.renderFrame();
    }
  
    updateCanvasSize() {
      const container = this.canvas.parentElement;
      const widthRatio = container.clientWidth / this.originalWidth;
      const heightRatio = container.clientHeight / this.originalHeight;
      this.scale = Math.min(widthRatio, heightRatio);
      this.canvas.width = this.originalWidth * this.scale;
      this.canvas.height = this.originalHeight * this.scale;
    }
  
    static initAll() {
      document.querySelectorAll('.frame-animation').forEach(canvas => {
        try {
          const animator = new FrameAnimator({
            canvas: canvas,
            prefix: canvas.dataset.frames,
            frameCount: parseInt(canvas.dataset.count),
            imagePath: canvas.dataset.path,
            digits: parseInt(canvas.dataset.digits) || 3,
            fps: parseInt(canvas.dataset.fps) || 24,
            loop: canvas.dataset.loop !== 'false',
            autoplay: canvas.dataset.autoplay !== 'false',
            playOnce: canvas.dataset.playOnce === 'true',
          });
  
          const parentBlock = canvas.closest('.land__animate_2');
          if (parentBlock) {
            parentBlock.addEventListener('click', () => {
              if (animator.isPlaying) {
                animator.stop();
              }
              animator.playFromFrame(28); // Запуск с 29 кадра (индекс 28)
            });
          }
  
        } catch (err) {
          console.error('Ошибка инициализации анимации:', err);
        }
      });
    }
  }
  
  window.addEventListener('load', () => {
    FrameAnimator.initAll();
  });