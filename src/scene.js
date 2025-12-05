import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { FaceManager } from './faceManager.js';

// Fragment Shader for Background (Warping effect)
const bgVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const bgFragmentShader = `
varying vec2 vUv;
uniform float uTime;

void main() {
    vec2 p = vUv * 2.0 - 1.0;
    
    // Slower, more subtle warping
    float t = uTime * 0.1;
    for(int i = 1; i < 3; i++) {
        p.x += 0.2 / float(i) * sin(float(i) * 2.0 * p.y + t);
        p.y += 0.2 / float(i) * cos(float(i) * 2.0 * p.x + t);
    }
    
    // Create a deep, dark void-like texture
    // Using simple sine waves but mapped to very dark greyscale
    float v = sin(p.x * 2.0 + p.y * 2.0 + t) * 0.5 + 0.5;
    
    // Add a second layer of interference for "liminal" feel
    float v2 = cos(p.y * 3.0 - p.x * 1.5 - t * 0.5) * 0.5 + 0.5;
    
    // Combine and darken significantly
    float finalVal = (v * 0.6 + v2 * 0.4) * 0.15; // Very dark
    
    // Slight blue-ish/purple tint for "space" feel, but mostly black
    vec3 color = vec3(finalVal * 0.8, finalVal * 0.85, finalVal * 1.0);

    gl_FragColor = vec4(color, 1.0);
}
`;

export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
        this.camera.position.set(0, 0, 10);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.mouse = new THREE.Vector2();

        // Reusable objects to avoid allocations in animation loop
        this.tempVector = new THREE.Vector3();
        this.massCenter = new THREE.Vector3();
        this.screenPosition = new THREE.Vector3();
        
        // Smoothed mass center for face positioning (to prevent jumping)
        this.smoothedMassCenter = new THREE.Vector3();
        this.smoothedScreenX = window.innerWidth / 2;
        this.smoothedScreenY = window.innerHeight / 2;

        // Physics variables for blobs
        this.blobs = [];
        this.numBlobs = 8;

        // Initialize face manager
        this.faceManager = new FaceManager();

        this.initObjects();
        this.addEvents();
        
        // Animation control
        this.isPaused = false;
        this.animationFrameId = null;
        
        // Bind animate once to avoid creating new function every frame
        this.animate = this.animate.bind(this);
        this.animate();
    }

    pause() {
        this.isPaused = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.animate();
        }
    }

    setFaceTalking(isTalking) {
        if (!this.faceManager) return;
        
        if (isTalking) {
            this.faceManager.startTalkingAnimation();
        } else {
            this.faceManager.stopTalkingAnimation();
        }
    }

    initObjects() {
        // 1. Background
        const bgGeometry = new THREE.PlaneGeometry(30, 15);
        const bgMaterial = new THREE.ShaderMaterial({
            vertexShader: bgVertexShader,
            fragmentShader: bgFragmentShader,
            uniforms: {
                uTime: { value: 0 }
            }
        });
        this.bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
        this.bgMesh.position.z = -5;
        this.scene.add(this.bgMesh);

        // 2. Environment Map (HDRI)
        new RGBELoader()
            .load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr', (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                this.scene.environment = texture;

                // Update material once env map is loaded
                if (this.effect && this.effect.material) {
                    this.effect.material.envMap = texture;
                    this.effect.material.needsUpdate = true;
                }
            });

        // 3. Marching Cubes Setup
        const resolution = 64;
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.99,
            transmission: 0.1,
            thickness: 1.0,
            clearcoat: 1.0,
            side: THREE.DoubleSide
        });

        this.effect = new MarchingCubes(resolution, material, true, true, 100000);
        this.effect.position.set(0, 0, 0);
        this.effect.scale.set(5.0, 5.0, 0.5); 
        this.effect.enableUvs = false;
        this.effect.enableColors = true;
        this.scene.add(this.effect);

        // Initialize Blob Data (Position, Velocity, Color)
        const colors = [
            new THREE.Color('indianred'),
            new THREE.Color('skyblue'),
            new THREE.Color('teal'),
            new THREE.Color('orange'),
            new THREE.Color('hotpink'),
            new THREE.Color('aquamarine'),
            new THREE.Color('purple')
        ];

        for (let i = 0; i < this.numBlobs; i++) {
            this.blobs.push({
                pos: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5,
                    0
                ),
                vel: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.01,
                    0
                ),
                color: colors[i % colors.length],
                strength: 0.3 + Math.random() * 0.55,
                subtract: 10
            });
        }
    }

    updateBlobs(time) {
        if (!this.effect) return;

        this.effect.reset();

        // Update physics and add blobs
        this.blobs.forEach((blob, index) => {
            // 1. Center attraction force (Gravity towards 0,0,0)
            // Use reusable temp vector instead of clone()
            this.tempVector.copy(blob.pos).multiplyScalar(-0.003);
            blob.vel.add(this.tempVector);

            // 2. Damping (Friction)
            blob.vel.multiplyScalar(0.99);

            // 3. Regular "Flow" Movement (Sine wave based)
            blob.vel.x += Math.sin(time * 0.25 + index) * 0.0003;
            blob.vel.y += Math.cos(time * 0.25 + index) * 0.0003;

            // 4. Random wandering (Jitter)
            blob.vel.x += (Math.random() - 0.5) * 0.002;
            blob.vel.y += (Math.random() - 0.5) * 0.002;

            // Limits (Soft boundaries)
            // if (blob.pos.x > 4) blob.vel.x -= 0.005;
            // if (blob.pos.x < -4) blob.vel.x += 0.005;
            // if (blob.pos.y > 4) blob.vel.y -= 0.005;
            // if (blob.pos.y < -4) blob.vel.y += 0.005;

            blob.pos.add(blob.vel);
            blob.pos.z = 0; // Keep on plane

            this.effect.addBall(
                0.5 + blob.pos.x * 0.5,
                0.5 + blob.pos.y * 0.5,
                0.5,
                blob.strength,
                blob.subtract,
                blob.color
            );
        });

        this.effect.update();
        
        // Calculate center of mass of blobs
        this.calculateMassCenter();
    }
    
    calculateMassCenter() {
        if (this.blobs.length === 0) return;
        
        let totalMass = 0;
        this.massCenter.set(0, 0, 0);
        
        // Calculate weighted center of mass (weighted by blob strength)
        this.blobs.forEach(blob => {
            const mass = blob.strength;
            totalMass += mass;
            
            // Convert blob position to world space
            // blob.pos is in normalized space (roughly -0.25 to 0.25)
            // addBall uses: 0.5 + blob.pos.x * 0.5 (converts to normalized 0-1)
            // Effect is scaled by 5.0, so world space = (normalized - 0.5) * scale
            // Simplifying: world = blob.pos.x * 0.5 * scale = blob.pos.x * 2.5
            
            // Convert blob position to world space
            const normalizedX = 0.5 + blob.pos.x * 0.5;
            const normalizedY = 0.5 + blob.pos.y * 0.5;
            const worldX = (normalizedX - 0.5) * this.effect.scale.x;
            const worldY = (normalizedY - 0.5) * this.effect.scale.y;
            const worldZ = 0; // blob.pos.z is 0
            
            // Add effect position offset
            const finalX = worldX + this.effect.position.x;
            const finalY = worldY + this.effect.position.y;
            const finalZ = worldZ + this.effect.position.z;
            
            this.massCenter.x += finalX * mass;
            this.massCenter.y += finalY * mass;
            this.massCenter.z += finalZ * mass;
        });
        
        if (totalMass > 0) {
            this.massCenter.divideScalar(totalMass);
        }
        
        // Project 3D position to screen coordinates
        // Clone the vector before projecting (project modifies the vector)
        const projected = this.massCenter.clone().project(this.camera);
        
        // Convert normalized device coordinates (-1 to 1) to screen pixels
        // NDC: x ranges from -1 (left) to 1 (right), y ranges from -1 (bottom) to 1 (top)
        // Screen: x ranges from 0 (left) to width (right), y ranges from 0 (top) to height (bottom)
        const targetX = (projected.x * 0.5 + 0.5) * this.width;
        const targetY = (-projected.y * 0.5 + 0.5) * this.height; // Flip y-axis for screen coordinates
        
        // Validate coordinates
        if (!isFinite(targetX) || !isFinite(targetY) || 
            targetX < 0 || targetX > this.width || 
            targetY < 0 || targetY > this.height || 
            !this.faceManager) {
            return;
        }
        
        // Smooth interpolation to prevent jumping
        // Use exponential smoothing (lerp) for smooth, responsive movement
        // Higher factor (0.15) = more responsive but less smooth
        // Lower factor (0.05) = smoother but less responsive
        const smoothingFactor = 0.12; // Balanced: smooth but still responsive
        
        // Exponential smoothing (exponential moving average)
        // Always update for smoothness - no distance threshold
        this.smoothedScreenX += (targetX - this.smoothedScreenX) * smoothingFactor;
        this.smoothedScreenY += (targetY - this.smoothedScreenY) * smoothingFactor;
        
        // Update face position with smoothed coordinates
        this.faceManager.updatePosition(this.smoothedScreenX, this.smoothedScreenY);
    }

    addEvents() {
        window.addEventListener('resize', this.onResize.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
    }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        
        // Reset smoothed position to center on resize to prevent jumps
        this.smoothedScreenX = this.width / 2;
        this.smoothedScreenY = this.height / 2;
        
        // Update face manager if needed (for responsive sizing)
        // Face overlay is CSS-positioned, so no action needed here
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / this.width) * 2 - 1;
        this.mouse.y = -(event.clientY / this.height) * 2 + 1;
        
        // Update face manager with mouse position
        if (this.faceManager) {
            this.faceManager.updateMousePosition(this.mouse.x, this.mouse.y);
        }
    }

    expandBlob(onComplete = null) {
        // Expand the entire group scale
        const duration = 1.0;
        const startScale = new THREE.Vector3().copy(this.effect.scale);
        const targetScale = new THREE.Vector3(40.0, 40.0, 0.5);
        const startTime = this.clock.getElapsedTime();

        const animateExpansion = () => {
            const now = this.clock.getElapsedTime();
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);

            this.effect.scale.lerpVectors(startScale, targetScale, ease);

            if (progress < 1) {
                requestAnimationFrame(animateExpansion);
            } else {
                // Animation complete
                if (onComplete) {
                    onComplete();
                }
            }
        };
        animateExpansion();
    }

    resetBlob(onComplete = null) {
        const duration = 1.0;
        const startScale = new THREE.Vector3().copy(this.effect.scale);
        const targetScale = new THREE.Vector3(5.0, 5.0, 0.5); // Return to flattened state
        const startTime = this.clock.getElapsedTime();

        const animateReset = () => {
            const now = this.clock.getElapsedTime();
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);

            this.effect.scale.lerpVectors(startScale, targetScale, ease);

            if (progress < 1) {
                requestAnimationFrame(animateReset);
            } else {
                // Animation complete
                if (onComplete) {
                    onComplete();
                }
            }
        };
        animateReset();
    }

    animate() {
        if (this.isPaused) return;

        this.animationFrameId = requestAnimationFrame(this.animate);

        const time = this.clock.getElapsedTime();

        this.updateBlobs(time);

        if (this.bgMesh) {
            this.bgMesh.material.uniforms.uTime.value = time;
        }

        this.renderer.render(this.scene, this.camera);
    }
}
