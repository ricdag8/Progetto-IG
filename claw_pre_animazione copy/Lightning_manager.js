import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class LightingManager {
    constructor() {
        this.scene = null;
        this.machineOffset = null;
        this.candyMachineOffset = null;
        this.time = 0; // For animations
        
        // 🆕 LIGHT REFERENCES OBJECT
        this.lightReferences = {
            ambientLight: null,
            clawSpotlight: null,
            candySpotlight: null,
            sideLight1: null,
            sideLight2: null,
            centerLight: null,
            ceilingLeds: [], // Array for all ceiling light components
            // Arrays for grouped lights
            wallWashers: [],
            ceilingGrid: [],
            clawSupports: [],
            candySupports: [],
            ledStrips: [] // For our new LED strips
        };
        
        console.log("💡 Lighting Manager initialized");
    }
    
    update(deltaTime) {
        this.time += deltaTime;
        
        // Animate LED strips
        this.lightReferences.ledStrips.forEach((led, index) => {
            // Create a flowing rainbow effect using HSL color space
            const hue = (this.time * 0.2 + index * 0.02) % 1.0;
            const saturation = 1.0;
            const lightness = 0.5;
            
            led.material.color.setHSL(hue, saturation, lightness);
            led.material.emissive.setHSL(hue, saturation, lightness); // Make it glow
        });
    }
    
    // 🆕 INITIALIZE WITH SCENE AND MACHINE POSITIONS
    initialize(scene, machineOffset, candyMachineOffset) {
        this.scene = scene;
        this.machineOffset = machineOffset;
        this.candyMachineOffset = candyMachineOffset;
        
        console.log("⚡ Lighting Manager initialized with scene and positions");
    }
    
    // 🆕 SETUP ENHANCED LIGHTING SYSTEM
    setupLighting() {
        if (!this.scene) {
            console.error("❌ Scene not initialized! Call initialize() first.");
            return;
        }
        
        // 🆕 AMBIENT LIGHT WITH CONTROL
        this.lightReferences.ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(this.lightReferences.ambientLight);
        
        // Main directional light (reduced intensity)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(-50, 40, 40);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        
        const shadowAreaSize = 60;
        directionalLight.shadow.camera.left = -shadowAreaSize;
        directionalLight.shadow.camera.right = shadowAreaSize;
        directionalLight.shadow.camera.top = shadowAreaSize;
        directionalLight.shadow.camera.bottom = -shadowAreaSize;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 200;
        
        this.scene.add(directionalLight);
        
        // 🆕 CLAW MACHINE AREA LIGHTING - MORE DIFFUSED
        // Main spotlight (wider angle)
        this.lightReferences.clawSpotlight = new THREE.SpotLight(0xff4444, 3.5, 20, Math.PI / 2, 0.8);
        this.lightReferences.clawSpotlight.position.set(this.machineOffset.x, 7, this.machineOffset.z + 3);
        this.lightReferences.clawSpotlight.target.position.set(this.machineOffset.x, 0, this.machineOffset.z);
        this.lightReferences.clawSpotlight.castShadow = true;
        this.scene.add(this.lightReferences.clawSpotlight);
        this.scene.add(this.lightReferences.clawSpotlight.target);
        
        // Support lights for claw area
        const clawSupport1 = new THREE.PointLight(0xff4444, 1.5, 12);
        clawSupport1.position.set(this.machineOffset.x + 3, 5, this.machineOffset.z - 2);
        this.scene.add(clawSupport1);
        
        const clawSupport2 = new THREE.PointLight(0xff4444, 1.5, 12);
        clawSupport2.position.set(this.machineOffset.x - 3, 5, this.machineOffset.z + 2);
        this.scene.add(clawSupport2);
        
        // �� CANDY MACHINE AREA LIGHTING - MORE DIFFUSED
        this.lightReferences.candySpotlight = new THREE.SpotLight(0x4444ff, 3.5, 20, Math.PI / 2, 0.8);
        this.lightReferences.candySpotlight.position.set(this.candyMachineOffset.x, 7, this.candyMachineOffset.z + 3);
        this.lightReferences.candySpotlight.target.position.set(this.candyMachineOffset.x, 0, this.candyMachineOffset.z);
        this.lightReferences.candySpotlight.castShadow = true;
        this.scene.add(this.lightReferences.candySpotlight);
        this.scene.add(this.lightReferences.candySpotlight.target);
        
        // Support lights for candy area
        const candySupport1 = new THREE.PointLight(0x4444ff, 1.5, 12);
        candySupport1.position.set(this.candyMachineOffset.x + 3, 5, this.candyMachineOffset.z - 2);
        this.scene.add(candySupport1);
        
        const candySupport2 = new THREE.PointLight(0x4444ff, 1.5, 12);
        candySupport2.position.set(this.candyMachineOffset.x - 3, 5, this.candyMachineOffset.z + 2);
        this.scene.add(candySupport2);
        
        // 🆕 WALL LIGHTING SYSTEM (WALL WASHERS)
        this.lightReferences.wallWashers = [];
        
        // Side walls
        for (let i = 0; i < 4; i++) {
            const wallWasher = new THREE.SpotLight(0x44ff44, 2.5, 15, Math.PI / 3, 0.9);
            wallWasher.position.set(-8, 6, -6 + i * 4);
            wallWasher.target.position.set(-10, 2, -6 + i * 4);
            this.scene.add(wallWasher);
            this.scene.add(wallWasher.target);
            this.lightReferences.wallWashers.push(wallWasher);
            
            const wallWasher2 = new THREE.SpotLight(0x44ff44, 2.5, 15, Math.PI / 3, 0.9);
            wallWasher2.position.set(8, 6, -6 + i * 4);
            wallWasher2.target.position.set(10, 2, -6 + i * 4);
            this.scene.add(wallWasher2);
            this.scene.add(wallWasher2.target);
            this.lightReferences.wallWashers.push(wallWasher2);
        }
        
        // Back wall
        for (let i = 0; i < 5; i++) {
            const backWallWasher = new THREE.SpotLight(0x44ff44, 2.0, 12, Math.PI / 4, 0.8);
            backWallWasher.position.set(-8 + i * 4, 6, -6);
            backWallWasher.target.position.set(-8 + i * 4, 2, -8);
            this.scene.add(backWallWasher);
            this.scene.add(backWallWasher.target);
            this.lightReferences.wallWashers.push(backWallWasher);
        }
        
        this.setupCeilingLights();
        
        // Main center lights
        // this.lightReferences.centerLight = new THREE.PointLight(0xffffff, 2.0, 15);
        // this.lightReferences.centerLight.position.set(0, 6, 0);
        // this.scene.add(this.lightReferences.centerLight);
        
        // Store support lights for color control
        this.lightReferences.clawSupports = [clawSupport1, clawSupport2];
        this.lightReferences.candySupports = [candySupport1, candySupport2];
        
        this.createLedPaths();
        this.createWallLeds();
        
        console.log("🌈 Enhanced diffused lighting system created");
    }

    setupCeilingLights() {
        const loader = new GLTFLoader();
        loader.load('led_light.glb', (gltf) => {
            const ledTemplate = gltf.scene;

            // Define positions for the three LED fixtures
            const positions = [
                new THREE.Vector3(0, 7, 0),
                new THREE.Vector3(-6, 7, 0),
                new THREE.Vector3(6, 7, 0)
            ];

            positions.forEach(pos => {
                const ledModel = ledTemplate.clone(true); // Deep clone the model
                ledModel.position.copy(pos);
                ledModel.scale.set(2, 2, 2);
                this.scene.add(ledModel);

                const light1Mesh = ledModel.getObjectByName('light1');
                const light2Mesh = ledModel.getObjectByName('light2');
                
                // Helper to create a light and attach it
                const createLight = (mesh) => {
                    if (!mesh) return null;
                    
                    // Make the mesh itself glow
                    mesh.material = new THREE.MeshStandardMaterial({
                        emissive: 0xffffff, // Start with white glow
                        emissiveIntensity: 0.0, // Will be controlled by main intensity
                    });

                    const pointLight = new THREE.PointLight(0xffffff, 1.5, 20);
                    pointLight.position.copy(mesh.position);
                    ledModel.add(pointLight);

                    // Store references to both the light and its mesh for color updates
                    this.lightReferences.ceilingLeds.push({ light: pointLight, mesh: mesh });
                    return pointLight;
                };

                createLight(light1Mesh);
                createLight(light2Mesh);
            });
            
            console.log(`✅ Created ${this.lightReferences.ceilingLeds.length} ceiling lights from led_light.glb.`);

        }, undefined, (error) => {
            console.error("❌ Failed to load led_light.glb for ceiling", error);
        });
    }

    createLedPaths() {
        const ledSize = 0.15;
        const ledSpacing = 0.2;
        const yPos = 0.02; // Slightly above the floor to prevent z-fighting

        const ledGeometry = new THREE.PlaneGeometry(ledSize, ledSize);
        ledGeometry.rotateX(-Math.PI / 2); // Lay it flat on the floor

        const startPoint = new THREE.Vector3(0, yPos, 3.5);

        const paths = [
            // Path to Claw Machine
            { from: startPoint, to: new THREE.Vector3(this.machineOffset.x, yPos, startPoint.z) },
            { from: new THREE.Vector3(this.machineOffset.x, yPos, startPoint.z), to: new THREE.Vector3(this.machineOffset.x, yPos, this.machineOffset.z + 2.0) }
        ];

        // Path to Candy Machine
        if (this.candyMachineOffset) {
            paths.push(
                { from: startPoint, to: new THREE.Vector3(this.candyMachineOffset.x, yPos, startPoint.z) },
                { from: new THREE.Vector3(this.candyMachineOffset.x, yPos, startPoint.z), to: new THREE.Vector3(this.candyMachineOffset.x, yPos, this.candyMachineOffset.z + 2.0) }
            );
        }

        paths.forEach(path => {
            const direction = new THREE.Vector3().subVectors(path.to, path.from);
            const length = direction.length();
            direction.normalize();

            const ledCount = Math.floor(length / ledSpacing);

            for (let i = 0; i <= ledCount; i++) {
                const led = new THREE.Mesh(
                    ledGeometry,
                    // Each LED needs its own material instance to have a unique color
                    new THREE.MeshStandardMaterial({
                        emissive: 0xffffff, // This will be set in the update loop
                        emissiveIntensity: 1.5,
                    })
                );

                const position = path.from.clone().add(direction.clone().multiplyScalar(i * ledSpacing));
                led.position.copy(position);
                
                this.scene.add(led);
                this.lightReferences.ledStrips.push(led);
            }
        });
        console.log(`✨ Created ${this.lightReferences.ledStrips.length} LEDs for floor paths.`);
    }

    createWallLeds() {
        const roomSize = { width: 40, height: 8, depth: 20 };
        const ledSize = 0.15;
        const ledSpacing = 0.4; // Slightly closer spacing for smoother waves
        const wallOffset = 0.02;

        // Wave parameters to control the pattern
        const waveAmplitude = 0.6; // How high/low the wave goes
        const waveFrequency = 0.25; // How many waves across the wall

        const createLed = (geometry, position) => {
            // CRITICAL FIX: To allow each LED to have a unique color, we must
            // create a new material instance for each one, not share a single material.
            const led = new THREE.Mesh(
                geometry,
                new THREE.MeshStandardMaterial({
                    emissive: 0xffffff, // Base color, will be changed by the animation
                    emissiveIntensity: 0.4, // Keep the lower intensity for wall LEDs
                    side: THREE.DoubleSide
                })
            );

            led.position.copy(position);
            this.scene.add(led);
            this.lightReferences.ledStrips.push(led);
        };

        // --- NEW DYNAMIC WAVE PATTERN ---

        const geoZ = new THREE.PlaneGeometry(ledSize, ledSize);
        const geoX = new THREE.PlaneGeometry(ledSize, ledSize);
        geoX.rotateY(Math.PI / 2);

        // Loop through the height levels for the base of the waves
        for (let yBase = 2.0; yBase < roomSize.height; yBase += 2.0) { // Increased vertical spacing for distinct waves
            
            // Create LEDs on Back and Front walls with a sine wave pattern
            for (let x = -roomSize.width / 2 + 1; x < roomSize.width / 2 - 1; x += ledSpacing) {
                const yOffset = Math.sin(x * waveFrequency) * waveAmplitude;
                const currentY = yBase + yOffset;
                // Back wall
                createLed(geoZ, new THREE.Vector3(x, currentY, -roomSize.depth / 2 + wallOffset));
                // Front wall (with phase shift for variation)
                createLed(geoZ, new THREE.Vector3(x, yBase - yOffset, roomSize.depth / 2 - wallOffset));
            }

            // Create LEDs on Left and Right walls with a sine wave pattern
            for (let z = -roomSize.depth / 2 + 1; z < roomSize.depth / 2 - 1; z += ledSpacing) {
                const yOffset = Math.sin(z * waveFrequency) * waveAmplitude;
                const currentY = yBase + yOffset;
                // Left wall
                createLed(geoX, new THREE.Vector3(-roomSize.width / 2 + wallOffset, currentY, z));
                // Right wall (with phase shift for variation)
                createLed(geoX, new THREE.Vector3(roomSize.width / 2 - wallOffset, yBase - yOffset, z));
            }
        }
        
        console.log(`✨ Created dynamic wave LED pattern on walls. Total LEDs: ${this.lightReferences.ledStrips.length}`);
    }
    
    // 🆕 SETUP LIGHT CONTROLS UI
    setupLightControls() {
        const toggleButton = document.getElementById('toggleLightControls');
        const lightControls = document.getElementById('lightControls');
        
        if (!toggleButton || !lightControls) {
            console.warn("⚠️ Light control UI elements not found");
            return;
        }
        
        toggleButton.addEventListener('click', () => {
            lightControls.style.display = lightControls.style.display === 'none' ? 'block' : 'none';
        });
        
        // 🆕 AMBIENT LIGHT CONTROLS
        this.setupAmbientLightControls();
        
        // 🆕 COLOR PICKER CONTROLS
        this.setupColorControls();
        
        // 🆕 INTENSITY CONTROLS
        this.setupIntensityControls();
        
        console.log("🎛️ Light controls initialized");
    }
    
    setupAmbientLightControls() {
        const ambientColorInput = document.getElementById('ambientLightColor');
        const ambientIntensityInput = document.getElementById('ambientLightIntensity');
        const ambientToggle = document.getElementById('ambientLightToggle');
        
        if (ambientColorInput) {
            ambientColorInput.addEventListener('input', (e) => {
                this.updateLightColor('ambient', e.target.value);
                this.updatePreview('ambientLightPreview', e.target.value);
            });
        }
        
        if (ambientIntensityInput) {
            ambientIntensityInput.addEventListener('input', (e) => {
                this.updateLightIntensity('ambient', parseFloat(e.target.value));
                const valueElement = document.getElementById('ambientIntensityValue');
                if (valueElement) valueElement.textContent = e.target.value;
            });
        }
        
        if (ambientToggle) {
            ambientToggle.addEventListener('change', (e) => {
                if (this.lightReferences.ambientLight) {
                    this.lightReferences.ambientLight.visible = e.target.checked;
                }
            });
        }
    }
    
    setupColorControls() {
        const colorControls = [
            { id: 'clawLightColor', type: 'claw', preview: 'clawLightPreview' },
            { id: 'candyLightColor', type: 'candy', preview: 'candyLightPreview' },
            { id: 'sideLightColor', type: 'side', preview: 'sideLightPreview' },
            { id: 'centerLightColor', type: 'center', preview: 'centerLightPreview' }
        ];
        
        colorControls.forEach(control => {
            const element = document.getElementById(control.id);
            if (element) {
                element.addEventListener('input', (e) => {
                    this.updateLightColor(control.type, e.target.value);
                    this.updatePreview(control.preview, e.target.value);
                });
            }
        });
    }
    
    setupIntensityControls() {
        const intensityControls = [
            { id: 'clawLightIntensity', type: 'claw', valueId: 'clawIntensityValue' },
            { id: 'candyLightIntensity', type: 'candy', valueId: 'candyIntensityValue' },
            { id: 'sideLightIntensity', type: 'side', valueId: 'sideIntensityValue' },
            { id: 'centerLightIntensity', type: 'center', valueId: 'centerIntensityValue' }
        ];
        
        intensityControls.forEach(control => {
            const element = document.getElementById(control.id);
            if (element) {
                element.addEventListener('input', (e) => {
                    this.updateLightIntensity(control.type, parseFloat(e.target.value));
                    const valueElement = document.getElementById(control.valueId);
                    if (valueElement) valueElement.textContent = e.target.value;
                });
            }
        });
    }
    
    // 🆕 UPDATE PREVIEW COLOR
    updatePreview(previewId, color) {
        const preview = document.getElementById(previewId);
        if (preview) {
            preview.style.backgroundColor = color;
        }
    }
    
    // 🆕 UPDATE LIGHT COLOR
    updateLightColor(lightType, colorHex) {
        const color = new THREE.Color(colorHex);
        
        switch(lightType) {
            case 'ambient':
                if (this.lightReferences.ambientLight) {
                    this.lightReferences.ambientLight.color.copy(color);
                }
                break;
            case 'claw':
                if (this.lightReferences.clawSpotlight) {
                    this.lightReferences.clawSpotlight.color.copy(color);
                }
                // Update support lights
                if (this.lightReferences.clawSupports) {
                    this.lightReferences.clawSupports.forEach(light => light.color.copy(color));
                }
                break;
            case 'candy':
                if (this.lightReferences.candySpotlight) {
                    this.lightReferences.candySpotlight.color.copy(color);
                }
                if (this.lightReferences.candySupports) {
                    this.lightReferences.candySupports.forEach(light => light.color.copy(color));
                }
                break;
            case 'side':
                // Update all wall washers
                if (this.lightReferences.wallWashers) {
                    this.lightReferences.wallWashers.forEach(light => light.color.copy(color));
                }
                break;
            case 'center':
                // if (this.lightReferences.centerLight) {
                //     this.lightReferences.centerLight.color.copy(color);
                // }
                // Update ceiling grid
                this.lightReferences.ceilingLeds.forEach(led => {
                    led.light.color.copy(color);
                    if (led.mesh) {
                        led.mesh.material.emissive.copy(color);
                    }
                });
                break;
        }
    }
    
    // 🆕 UPDATE LIGHT INTENSITY
    updateLightIntensity(lightType, intensity) {
        switch(lightType) {
            case 'ambient':
                if (this.lightReferences.ambientLight) {
                    this.lightReferences.ambientLight.intensity = intensity;
                }
                break;
            case 'claw':
                if (this.lightReferences.clawSpotlight) {
                    this.lightReferences.clawSpotlight.intensity = intensity * 2;
                }
                if (this.lightReferences.clawSupports) {
                    this.lightReferences.clawSupports.forEach(light => light.intensity = intensity);
                }
                break;
            case 'candy':
                if (this.lightReferences.candySpotlight) {
                    this.lightReferences.candySpotlight.intensity = intensity * 2;
                }
                if (this.lightReferences.candySupports) {
                    this.lightReferences.candySupports.forEach(light => light.intensity = intensity);
                }
                break;
            case 'side':
                if (this.lightReferences.wallWashers) {
                    this.lightReferences.wallWashers.forEach(light => light.intensity = intensity * 1.5);
                }
                break;
            case 'center':
                // if (this.lightReferences.centerLight) {
                //     this.lightReferences.centerLight.intensity = intensity * 1.5;
                // }
                this.lightReferences.ceilingLeds.forEach(led => {
                    led.light.intensity = intensity * 0.8; // Adjust intensity for each point light
                    if (led.mesh) {
                        // Link emissive intensity to the light's intensity
                        led.mesh.material.emissiveIntensity = intensity;
                    }
                });
                break;
        }
    }
    
    // 🆕 LIGHT PRESETS
    applyLightPreset(presetName) {
        const presets = {
            arcade: {
                ambient: { color: '#ffffff', intensity: 0.2 },
                claw: { color: '#ff0044', intensity: 2.5 },
                candy: { color: '#0044ff', intensity: 2.5 },
                side: { color: '#44ff00', intensity: 1.8 },
                center: { color: '#ffffff', intensity: 1.2 }
            },
            neon: {
                ambient: { color: '#000040', intensity: 0.1 },
                claw: { color: '#ff00ff', intensity: 3.0 },
                candy: { color: '#00ffff', intensity: 3.0 },
                side: { color: '#ffff00', intensity: 2.5 },
                center: { color: '#ff8000', intensity: 2.0 }
            },
            warm: {
                ambient: { color: '#fff8dc', intensity: 0.2 },
                claw: { color: '#ff8000', intensity: 2.5 },
                candy: { color: '#ffaa00', intensity: 2.5 },
                side: { color: '#ff6600', intensity: 2.0 },
                center: { color: '#ffffaa', intensity: 1.5 }
            },
            cool: {
                ambient: { color: '#f0f8ff', intensity: 0.15 },
                claw: { color: '#0088ff', intensity: 2.2 },
                candy: { color: '#00aaff', intensity: 2.2 },
                side: { color: '#00ffaa', intensity: 1.8 },
                center: { color: '#aaffff', intensity: 1.2 }
            },
            dark: {
                ambient: { color: '#000000', intensity: 0.0 },
                claw: { color: '#ff0000', intensity: 4.0 },
                candy: { color: '#0000ff', intensity: 4.0 },
                side: { color: '#00ff00', intensity: 3.0 },
                center: { color: '#ffffff', intensity: 0.3 }
            }
        };
        
        const preset = presets[presetName];
        if (!preset) {
            console.warn(`⚠️ Light preset '${presetName}' not found`);
            return;
        }
        
        // Apply colors and update UI
        Object.keys(preset).forEach(lightType => {
            const { color, intensity } = preset[lightType];
            this.updateLightColor(lightType, color);
            this.updateLightIntensity(lightType, intensity);
            
            // Update UI
            this.updateUIForPreset(lightType, color, intensity);
        });
        
        // Update ambient light toggle
        const ambientToggle = document.getElementById('ambientLightToggle');
        if (ambientToggle) {
            ambientToggle.checked = preset.ambient.intensity > 0;
            if (this.lightReferences.ambientLight) {
                this.lightReferences.ambientLight.visible = preset.ambient.intensity > 0;
            }
        }
        
        console.log(`🎨 Applied '${presetName}' lighting preset with diffused system`);
    }
    
    updateUIForPreset(lightType, color, intensity) {
        const colorInput = document.getElementById(`${lightType}LightColor`);
        const intensityInput = document.getElementById(`${lightType}LightIntensity`);
        const intensityValue = document.getElementById(`${lightType}IntensityValue`);
        const preview = document.getElementById(`${lightType}LightPreview`);
        
        if (colorInput) colorInput.value = color;
        if (intensityInput) intensityInput.value = intensity;
        if (intensityValue) intensityValue.textContent = intensity;
        if (preview) preview.style.backgroundColor = color;
    }
    
    // 🆕 SETUP SHADOW SYSTEM
    setupShadows(renderer) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
        console.log("🌓 Shadow system enabled");
    }
    
    // 🆕 GETTER FOR LIGHT REFERENCES (for compatibility)
    getLightReferences() {
        return this.lightReferences;
    }
} 