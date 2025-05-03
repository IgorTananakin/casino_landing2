class FrameAnimator {
    constructor(options) {
      // Проверка обязательных параметров
      if (!options.canvas) throw new Error('Canvas обязателен');
      if (!options.prefix) throw new Error('Prefix обязателен');
      if (!options.frameCount) throw new Error('количество фотографий обязательно');
  
      // Настройки
      this.canvas = options.canvas;
      this.ctx = this.canvas.getContext('2d');
      this.prefix = options.prefix;
      this.frameCount = options.frameCount;
      this.imagePath = this.normalizePath(options.imagePath || './media/img-optimized/');
      this.digits = options.digits || 3;
      this.fps = options.fps || 24;
      this.loop = options.loop !== false;
      this.autoplay = options.autoplay !== false;
      this.debug = options.debug || true;
  
      // Состояние
      this.images = [];
      this.currentFrame = 0;
      this.isPlaying = false;
      this.animationId = null;
      this.hasError = false;
      this.originalWidth = 0;
      this.originalHeight = 0;
      this.scale = 1;

      // для однократного проигрывания
      this.playOnce = options.playOnce || false;
      this.hasPlayed = false;
  
      // Инициализация
      this.log('инициализация:', options);
      this.init();
    }
  
    // ========== Основные методы ========== //
  
    init() {
      this.log('запуск');
      
      // Проверяем существование первого кадра
      this.testFirstFrame()
        .then(img => {
          this.originalWidth = img.naturalWidth || img.width;
          this.originalHeight = img.naturalHeight || img.height;
          this.setupResizeObserver();
          this.updateCanvasSize();
          this.preloadImages();
          if (this.autoplay) this.play();
        })
        .catch(err => {
          this.error('Initialization failed:', err.message);
        });
    }
  
    play() {
      if (this.isPlaying || this.hasError) return;
      
      this.isPlaying = true;
      this.lastTime = performance.now();
      this.animationId = requestAnimationFrame(this.animate.bind(this));
      this.log('запуск анимации');
    }
  
    stop() {
      this.isPlaying = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.log('остановка анимации');
      }
    }
  
    destroy() {
      this.stop();
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
    }
  
    // ========== Вспомогательные методы ========== //
  
    normalizePath(path) {
      return path.endsWith('/') ? path : path + '/';
    }
  
    log(...args) {
      if (this.debug) {
        console.log(`[картинка:${this.prefix}]`, ...args);
      }
    }
  
    error(...args) {
      console.error(`[картинка:${this.prefix}]`, ...args);
      this.hasError = true;
      this.showErrorState();
    }
  
    showErrorState() {
      this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '16px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('ошибка ', this.canvas.width/2, this.canvas.height/2 - 10);
      this.ctx.font = '12px Arial';
      this.ctx.fillText(`проверить `, this.canvas.width/2, this.canvas.height/2 + 10);
    }
  
    // ========== Методы работы с изображениями ========== //
  
    testFirstFrame() {
      return new Promise((resolve, reject) => {
        const testImg = new Image();
        testImg.src = this.getFramePath(1);
        
        testImg.onload = () => {
          this.log(`первая успешная загрузка: ${testImg.src}`);
          resolve(testImg);
        };
        
        testImg.onerror = () => {
          reject(new Error(`ошибка в первом изображении: ${testImg.src}`));
        };
      });
    }
  
    getFramePath(index) {
      const frameNum = index.toString().padStart(this.digits, '0');
      const path = `${this.imagePath}${this.prefix}/${this.prefix}${frameNum}.webp`;
      return path;
    }
  
    preloadImages() {
      this.log(`предзагрузка ${this.frameCount} картинок`);
      
      let loadedCount = 0;
      
      for (let i = 1; i <= this.frameCount; i++) {
        const img = new Image();
        img.src = this.getFramePath(i);
        img.dataset.frameIndex = i;
        
        img.onload = () => {
          loadedCount++;
          this.log(`картинка ${i} загружена (${loadedCount}/${this.frameCount})`);
        };
        
        img.onerror = () => {
          this.error(`ошибка загрузки картинки ${i}: ${img.src}`);
        };
        
        this.images.push(img);
      }
    }
  
    // ========== Методы масштабирования ========== //
  
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
      
      // Рассчитываем масштаб с сохранением пропорций
      const widthRatio = containerWidth / this.originalWidth;
      const heightRatio = containerHeight / this.originalHeight;
      this.scale = Math.min(widthRatio, heightRatio);
      
      // Устанавливаем размеры
      this.canvas.width = this.originalWidth * this.scale;
      this.canvas.height = this.originalHeight * this.scale;
      
    }
  
    // ========== Метод анимации ========== //
  
    animate(timestamp) {
        if (!this.isPlaying) return;
      
        // для проигрования анимации 1 раз
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
          // Увеличиваем кадр
          if (!this.playOnce || !this.hasPlayed || this.loop) {
            this.currentFrame = (this.currentFrame + 1) % this.frameCount;
          }
      
          const img = this.images[this.currentFrame];
          
          if (!img.complete) {
            this.log(`Frame ${this.currentFrame + 1} not loaded yet`);
            return;
          }
          
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
  
    // ========== Статические методы ========== //
  
    static initAll() {
      document.querySelectorAll('.frame-animation').forEach(canvas => {
        try {
          const options = {
            canvas: canvas,
            prefix: canvas.dataset.frames,
            frameCount: parseInt(canvas.dataset.count),
            imagePath: canvas.dataset.path || './media/img-optimized/',
            digits: parseInt(canvas.dataset.digits) || 3,
            fps: parseInt(canvas.dataset.fps) || 24,
            loop: canvas.dataset.loop !== 'false',
            autoplay: canvas.dataset.autoplay !== 'false',
            debug: canvas.dataset.debug !== 'false',
            playOnce: canvas.dataset.playOnce === 'true',
          };
          
          new FrameAnimator(options);
        } catch (err) {
          console.error('Failed to initialize animation:', err);
        }
      });
    }
  }
  
  // Автоматическая инициализация
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      FrameAnimator.initAll();
      document.body.classList.add('loaded');
    });
  } else {
    FrameAnimator.initAll();
    document.body.classList.add('loaded');
  }