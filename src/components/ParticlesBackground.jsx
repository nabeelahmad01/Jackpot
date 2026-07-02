'use client';

import React, { useEffect, useRef } from 'react';

export default function ParticlesBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particlesArray = [];
    const maxParticles = 40;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height + canvas.height;
        this.size = Math.random() * 2.2 + 0.8;
        this.speedY = Math.random() * 0.55 + 0.15;
        this.speedX = (Math.random() - 0.5) * 0.3;
        const goldTones = ['#ffd700', '#ffa500', '#ffeb8a'];
        this.color = goldTones[Math.floor(Math.random() * goldTones.length)];
        this.opacity = Math.random() * 0.4 + 0.2;
        this.fadeDirection = Math.random() > 0.5 ? 0.003 : -0.003;
      }

      update() {
        this.y -= this.speedY;
        this.x += this.speedX;
        
        if (this.y < 0) {
          this.y = canvas.height + Math.random() * 20;
          this.x = Math.random() * canvas.width;
        }
        
        this.opacity += this.fadeDirection;
        if (this.opacity > 0.7 || this.opacity < 0.1) {
          this.fadeDirection = -this.fadeDirection;
        }
      }

      draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = this.size * 2;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
      }
    }

    const init = () => {
      particlesArray = [];
      for (let i = 0; i < maxParticles; i++) {
        particlesArray.push(new Particle());
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    init();
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas id="particles-canvas" ref={canvasRef}></canvas>;
}
