import { gsap } from 'gsap';

export class FaceManager {
    constructor() {
        this.container = null;
        this.elements = {
            leftEye: null,
            rightEye: null,
            nose: null,
            mouth: null
        };
        
        // Parallax multipliers (nose moves most, eyes least)
        this.parallaxMultipliers = {
            nose: 1.0,      // Moves the most
            mouth: 0.6,
            leftEye: 0.3,  // Moves the least
            rightEye: 0.3
        };
        
        // Current mouse position (normalized -1 to 1)
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Current expression state
        this.currentExpression = 'neutral';
        
        // Animation timelines
        this.expressionTimeline = null;
        this.blinkInterval = null;
        this.talkingTimeline = null;
        
        this.init();
    }
    
    init() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'face-container';
        document.body.appendChild(this.container);
        
        // Create SVG for face
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 200 200');
        svg.setAttribute('width', '240');
        svg.setAttribute('height', '240');
        svg.style.width = '240px';
        svg.style.height = '240px';
        this.container.appendChild(svg);
        
        // Create face elements
        this.createFaceElements(svg);
        
        // Initialize transform-based positioning (centered)
        // Use xPercent and yPercent to center the element initially
        gsap.set(this.container, {
            xPercent: -50,
            yPercent: -50,
            x: 0,
            y: 0,
            transformOrigin: "center center"
        });
        
        // Set initial expression
        this.setExpression('neutral');
        
        // Start auto-blinking
        this.startAutoBlink();
    }
    
    createFaceElements(svg) {
        // Left Eye (circle)
        const leftEyeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        leftEyeGroup.setAttribute('class', 'face-element left-eye');
        const leftEye = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        leftEye.setAttribute('cx', '70');
        leftEye.setAttribute('cy', '70');
        leftEye.setAttribute('r', '8');
        leftEye.setAttribute('fill', 'none');
        leftEye.setAttribute('stroke', '#2a2a2a');
        leftEye.setAttribute('stroke-width', '3');
        leftEyeGroup.appendChild(leftEye);
        svg.appendChild(leftEyeGroup);
        this.elements.leftEye = leftEyeGroup;
        
        // Right Eye (circle)
        const rightEyeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        rightEyeGroup.setAttribute('class', 'face-element right-eye');
        const rightEye = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        rightEye.setAttribute('cx', '130');
        rightEye.setAttribute('cy', '70');
        rightEye.setAttribute('r', '8');
        rightEye.setAttribute('fill', 'none');
        rightEye.setAttribute('stroke', '#2a2a2a');
        rightEye.setAttribute('stroke-width', '3');
        rightEyeGroup.appendChild(rightEye);
        svg.appendChild(rightEyeGroup);
        this.elements.rightEye = rightEyeGroup;
        
        // Nose (L-shape)
        const noseGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        noseGroup.setAttribute('class', 'face-element nose');
        const noseVertical = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        noseVertical.setAttribute('x1', '100');
        noseVertical.setAttribute('y1', '85');
        noseVertical.setAttribute('x2', '100');
        noseVertical.setAttribute('y2', '110');
        noseVertical.setAttribute('stroke', '#2a2a2a');
        noseVertical.setAttribute('stroke-width', '3');
        noseVertical.setAttribute('stroke-linecap', 'round');
        const noseHorizontal = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        noseHorizontal.setAttribute('x1', '100');
        noseHorizontal.setAttribute('y1', '110');
        noseHorizontal.setAttribute('x2', '115');
        noseHorizontal.setAttribute('y2', '110');
        noseHorizontal.setAttribute('stroke', '#2a2a2a');
        noseHorizontal.setAttribute('stroke-width', '3');
        noseHorizontal.setAttribute('stroke-linecap', 'round');
        noseGroup.appendChild(noseVertical);
        noseGroup.appendChild(noseHorizontal);
        svg.appendChild(noseGroup);
        this.elements.nose = noseGroup;
        
        // Mouth (horizontal line)
        const mouthGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        mouthGroup.setAttribute('class', 'face-element mouth');
        const mouth = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        mouth.setAttribute('x1', '85');
        mouth.setAttribute('y1', '130');
        mouth.setAttribute('x2', '115');
        mouth.setAttribute('y2', '130');
        mouth.setAttribute('stroke', '#2a2a2a');
        mouth.setAttribute('stroke-width', '3');
        mouth.setAttribute('stroke-linecap', 'round');
        mouthGroup.appendChild(mouth);
        svg.appendChild(mouthGroup);
        this.elements.mouth = mouthGroup;
    }
    
    updatePosition(screenX, screenY) {
        // Update face container position to follow mass center smoothly
        // screenX and screenY are in pixels (should be numbers)
        // Validate inputs
        if (!isFinite(screenX) || !isFinite(screenY)) {
            return; // Skip invalid coordinates
        }
        
        // Calculate offset from screen center for transform-based positioning
        const offsetX = screenX - window.innerWidth / 2;
        const offsetY = screenY - window.innerHeight / 2;
        
        // Use transform-based positioning for smooth updates
        gsap.to(this.container, {
            x: offsetX,
            y: offsetY,
            duration: 0.3,
            ease: "power1.out",
            overwrite: true  // Kill any existing position tweens
        });
    }
    
    updateMousePosition(x, y) {
        // x and y are normalized (-1 to 1)
        this.mouseX = x;
        this.mouseY = y;
        
        // Apply parallax effect to each element
        // Nose moves the most, eyes move the least
        const maxOffset = 15; // Maximum pixel offset
        
        // Reflect y-axis for staring mechanism (invert y direction)
        const reflectedY = -this.mouseY;
        
        // Update nose position (most parallax)
        gsap.to(this.elements.nose, {
            x: this.mouseX * maxOffset * this.parallaxMultipliers.nose,
            y: reflectedY * maxOffset * this.parallaxMultipliers.nose,
            duration: 0.3,
            ease: 'power2.out'
        });
        
        // Update mouth position
        gsap.to(this.elements.mouth, {
            x: this.mouseX * maxOffset * this.parallaxMultipliers.mouth,
            y: reflectedY * maxOffset * this.parallaxMultipliers.mouth,
            duration: 0.3,
            ease: 'power2.out'
        });
        
        // Update eyes position (least parallax)
        gsap.to(this.elements.leftEye, {
            x: this.mouseX * maxOffset * this.parallaxMultipliers.leftEye,
            y: reflectedY * maxOffset * this.parallaxMultipliers.leftEye,
            duration: 0.3,
            ease: 'power2.out'
        });
        
        gsap.to(this.elements.rightEye, {
            x: this.mouseX * maxOffset * this.parallaxMultipliers.rightEye,
            y: reflectedY * maxOffset * this.parallaxMultipliers.rightEye,
            duration: 0.3,
            ease: 'power2.out'
        });
    }
    
    setExpression(type) {
        if (this.currentExpression === type) return;
        this.currentExpression = type;
        
        // Kill any existing expression animation
        if (this.expressionTimeline) {
            this.expressionTimeline.kill();
        }
        
        this.expressionTimeline = gsap.timeline();
        
        switch (type) {
            case 'neutral':
                this.setNeutralExpression();
                break;
            case 'happy':
                this.setHappyExpression();
                break;
            case 'surprised':
                this.setSurprisedExpression();
                break;
            case 'wink':
                this.setWinkExpression();
                break;
            case 'blink':
                this.blink();
                break;
            default:
                this.setNeutralExpression();
        }
    }
    
    setNeutralExpression() {
        // Reset all elements to neutral state
        const leftEye = this.elements.leftEye.querySelector('circle');
        const rightEye = this.elements.rightEye.querySelector('circle');
        const mouth = this.elements.mouth.querySelector('line');
        
        // Eyes: open circles
        gsap.to(leftEye, {
            attr: { r: 8 },
            duration: 0.3
        });
        gsap.to(rightEye, {
            attr: { r: 8 },
            duration: 0.3
        });
        
        // Mouth: horizontal line
        gsap.to(mouth, {
            attr: {
                x1: 85,
                y1: 130,
                x2: 115,
                y2: 130
            },
            duration: 0.3
        });
    }
    
    setHappyExpression() {
        const leftEye = this.elements.leftEye.querySelector('circle');
        const rightEye = this.elements.rightEye.querySelector('circle');
        const mouth = this.elements.mouth.querySelector('line');
        
        // Eyes: slightly smaller (squinting)
        gsap.to([leftEye, rightEye], {
            attr: { r: 6 },
            duration: 0.3
        });
        
        // Mouth: upward curve by adjusting y positions
        gsap.to(mouth, {
            attr: {
                x1: 85,
                y1: 125,
                x2: 115,
                y2: 125
            },
            duration: 0.3,
            ease: 'back.out(1.7)'
        });
    }
    
    setSurprisedExpression() {
        const leftEye = this.elements.leftEye.querySelector('circle');
        const rightEye = this.elements.rightEye.querySelector('circle');
        const mouth = this.elements.mouth.querySelector('line');
        
        // Eyes: larger circles
        gsap.to([leftEye, rightEye], {
            attr: { r: 12 },
            duration: 0.3,
            ease: 'back.out(1.7)'
        });
        
        // Mouth: open (smaller line)
        gsap.to(mouth, {
            attr: {
                x1: 100,
                y1: 130,
                x2: 100,
                y2: 130
            },
            duration: 0.3
        });
    }
    
    setWinkExpression() {
        const leftEye = this.elements.leftEye.querySelector('circle');
        const rightEye = this.elements.rightEye.querySelector('circle');
        
        // Left eye: close (line)
        gsap.to(leftEye, {
            attr: { r: 0 },
            duration: 0.2
        });
        
        // Right eye: open
        gsap.to(rightEye, {
            attr: { r: 8 },
            duration: 0.2
        });
        
        // After a moment, reopen left eye
        gsap.delayedCall(0.5, () => {
            gsap.to(leftEye, {
                attr: { r: 8 },
                duration: 0.2
            });
        });
    }
    
    blink() {
        const leftEye = this.elements.leftEye.querySelector('circle');
        const rightEye = this.elements.rightEye.querySelector('circle');
        const currentRadius = parseFloat(leftEye.getAttribute('r')) || 8;
        
        // Quick blink
        gsap.to([leftEye, rightEye], {
            attr: { r: 0 },
            duration: 0.1
        });
        gsap.to([leftEye, rightEye], {
            attr: { r: currentRadius },
            duration: 0.1,
            delay: 0.1
        });
    }
    
    // Random expression changes for programmatic animation
    randomExpression() {
        const expressions = ['neutral', 'happy', 'surprised', 'wink', 'blink'];
        const randomExpr = expressions[Math.floor(Math.random() * expressions.length)];
        this.setExpression(randomExpr);
    }
    
    // Periodic blinking
    startAutoBlink() {
        this.blinkInterval = setInterval(() => {
            if (this.currentExpression === 'neutral') {
                this.blink();
            }
        }, 3000 + Math.random() * 2000); // Blink every 3-5 seconds
    }
    
    // Start mouth animation for TTS
    startTalkingAnimation() {
        // Don't start if already talking
        if (this.talkingTimeline) {
            return;
        }
        
        const mouth = this.elements.mouth.querySelector('line');
        if (!mouth) return;
        
        // Create repeating animation timeline
        // Each cycle: open (mouth gets wider and moves down slightly) then close
        // Animation speed: ~2.5 cycles per second (0.4s per cycle)
        this.talkingTimeline = gsap.timeline({ repeat: -1 });
        
        // Open mouth: wider line, slightly lower
        this.talkingTimeline.to(mouth, {
            attr: {
                x1: 80,
                y1: 135,
                x2: 120,
                y2: 135
            },
            duration: 0.2,
            ease: 'power2.inOut'
        });
        
        // Close mouth: narrower line, back to neutral position
        this.talkingTimeline.to(mouth, {
            attr: {
                x1: 90,
                y1: 130,
                x2: 110,
                y2: 130
            },
            duration: 0.2,
            ease: 'power2.inOut'
        });
    }
    
    // Stop mouth animation and return to neutral
    stopTalkingAnimation() {
        if (this.talkingTimeline) {
            this.talkingTimeline.kill();
            this.talkingTimeline = null;
        }
        
        // Return mouth to neutral position
        const mouth = this.elements.mouth.querySelector('line');
        if (mouth) {
            gsap.to(mouth, {
                attr: {
                    x1: 85,
                    y1: 130,
                    x2: 115,
                    y2: 130
                },
                duration: 0.2,
                ease: 'power2.out'
            });
        }
    }
    
    destroy() {
        if (this.expressionTimeline) {
            this.expressionTimeline.kill();
        }
        if (this.talkingTimeline) {
            this.talkingTimeline.kill();
        }
        if (this.blinkInterval) {
            clearInterval(this.blinkInterval);
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

