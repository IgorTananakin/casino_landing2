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
      this.debug = options.debug || false;
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
      this.isLoading = false;
      this.loadStartTime = 0;
  
      // Прогресс-бар
      this.progressBar = this.createProgressBar();
      this.canvas.parentNode.appendChild(this.progressBar);
  
      this.init();
    }
  
    // ========== Методы загрузки ========== //
  
    async init() {
      try {
        const firstFrame = await this.loadImage(1);
        this.originalWidth = firstFrame.naturalWidth;
        this.originalHeight = firstFrame.naturalHeight;
        this.setupResizeObserver();
        this.updateCanvasSize();
  
        // Начинаем загрузку всех кадров
        this.isLoading = true;
        this.loadStartTime = performance.now();
        await this.loadAllFrames();
        this.isLoading = false;
  
        // Показываем статистику загрузки
        const loadTime = (performance.now() - this.loadStartTime).toFixed(0);
        console.log(`Все кадры загружены за ${loadTime}ms`);
  
        // Удаляем прогресс-бар
        this.progressBar.remove();
  
        // Автовоспроизведение
        if (this.autoplay) this.play();
      } catch (err) {
        this.error('Ошибка инициализации:', err.message);
      }
    }
  
    async loadAllFrames() {
      const batchSize = 45; // Загружаем по 4 кадра за раз
      const totalBatches = Math.ceil(this.frameCount / batchSize);
  
      for (let batch = 0; batch < totalBatches; batch++) {
        const start = batch * batchSize + 1;
        const end = Math.min((batch + 1) * batchSize, this.frameCount);
        
        await Promise.all(
          Array.from({length: end - start + 1}, (_, i) => 
            this.loadFrame(start + i)
          )
        );
        
        // Обновляем прогресс-бар
        this.updateProgress((batch + 1) / totalBatches);
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
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = this.getFramePath(frameNum);
        
        img.onload = () => {
          if (this.debug) {
            console.log(`Загружен кадр ${frameNum}`);
          }
          resolve(img);
        };
        
        img.onerror = () => {
          reject(new Error(`Ошибка загрузки кадра ${frameNum}`));
        };
      });
    }
  
    // ========== Прогресс-бар ========== //
  
    createProgressBar() {
      const bar = document.createElement('div');
      bar.style.position = 'absolute';
      bar.style.bottom = '0';
      bar.style.left = '0';
      bar.style.width = '100%';
      bar.style.height = '4px';
      bar.style.backgroundColor = 'rgba(255,255,255,0.2)';
      
      const progress = document.createElement('div');
      progress.style.height = '100%';
      progress.style.width = '0%';
      progress.style.backgroundColor = '#fff';
      progress.style.transition = 'width 0.3s ease';
      progress.id = `${this.prefix}-progress`;
      
      bar.appendChild(progress);
      return bar;
    }
  
    updateProgress(percent) {
      const progress = this.progressBar.querySelector('div');
      if (progress) {
        progress.style.width = `${percent * 100}%`;
      }
    }
  
    // ========== Методы анимации ========== //
  
    play() {
      if (this.isPlaying || this.hasError || this.isLoading) return;
      
      this.currentFrame = 0;
      this.hasPlayed = false;
      this.isPlaying = true;
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.animate.bind(this));
    }
  
    playFromFrame(startFrame) {
      if (this.isPlaying || this.hasError || this.isLoading) return;
      
      startFrame = Math.max(0, Math.min(startFrame, this.frameCount - 1));
      this.currentFrame = startFrame;
      this.hasPlayed = false;
      this.isPlaying = true;
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.animate.bind(this));
    }
  
    stop() {
      this.isPlaying = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
    }
  
    animate(timestamp) {
      if (!this.isPlaying) return;
      
      if (this.playOnce && this.hasPlayed) {
        this.stop();
        return;
      }
      
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
      
      this.animationId = requestAnimationFrame(this.animate.bind(this));
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
  
    // ========== Вспомогательные методы ========== //
  
    normalizePath(path) {
      return path.endsWith('/') ? path : path + '/';
    }
  
    getFramePath(index) {
      const frameNum = index.toString().padStart(this.digits, '0');
      return `${this.imagePath}${this.prefix}/${this.prefix}${frameNum}.webp`;
    }
  
    setupResizeObserver() {
      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', () => this.handleResize());
        return;
      }
  
      this.resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          if (entry.target === this.canvas.parentElement) {
            this.handleResize();
          }
        }
      });
      this.resizeObserver.observe(this.canvas.parentElement);
    }
  
    handleResize() {
      if (!this.originalWidth || !this.originalHeight) return;
      this.updateCanvasSize();
      this.renderFrame();
    }
  
    updateCanvasSize() {
      const container = this.canvas.parentElement;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      const widthRatio = containerWidth / this.originalWidth;
      const heightRatio = containerHeight / this.originalHeight;
      this.scale = Math.min(widthRatio, heightRatio);
      
      this.canvas.width = this.originalWidth * this.scale;
      this.canvas.height = this.originalHeight * this.scale;
    }
  
    error(...args) {
      console.error(`[${this.prefix}]`, ...args);
      this.hasError = true;
    }
  
    static initAll() {
      document.querySelectorAll('.frame-animation').forEach(canvas => {
        try {
          const options = {
            canvas: canvas,
            prefix: canvas.dataset.frames,
            frameCount: parseInt(canvas.dataset.count),
            imagePath: canvas.dataset.path || './media/imgOpt/',
            digits: parseInt(canvas.dataset.digits) || 3,
            fps: parseInt(canvas.dataset.fps) || 24,
            loop: canvas.dataset.loop !== 'false',
            autoplay: canvas.dataset.autoplay !== 'false',
            debug: canvas.dataset.debug === 'true',
            playOnce: canvas.dataset.playOnce === 'true',
          };
          
          const animator = new FrameAnimator(options);
          
          const parentBlock = canvas.closest('.land__animate_2');
          if (parentBlock) {
            parentBlock.addEventListener('click', () => {
              if (animator.isPlaying) {
                animator.stop();
              }
              animator.playFromFrame(28);
            });
          }
          
        } catch (err) {
          console.error('Ошибка инициализации анимации:', err);
        }
      });
    }
  }
  
  // Инициализация с задержкой для CSS-анимаций
  setTimeout(() => {
    FrameAnimator.initAll();
    document.body.classList.add('loaded');
  }, 100);