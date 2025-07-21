import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class HomepageManager {
    constructor(playerController, cameraManager, onCharacterSelectedCallback) {
        this.playerController = playerController;
        this.cameraManager = cameraManager;
        this.onCharacterSelectedCallback = onCharacterSelectedCallback;

        this.selectionScreenElement = document.getElementById('characterSelectionScreen');
        
        // Scene Setup for Character Selection
        this.selectionScene = new THREE.Scene();
        this.selectionScene.background = new THREE.Color(0x10101a);
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Camera for the selection screen
        this.selectionCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
        this.selectionCamera.position.set(0, 1.5, 5);

        // Lighting for the selection screen
        this._setupLighting();

        // Character models and state
        this.characterModels = [];
        this.selectedCharacterIndex = -1; // -1 means no character is selected yet
        this.characterDefs = [
            { name: "Hoodie", url: 'Hoodie Character.glb', position: new THREE.Vector3(-3.5, -1, 0) },
            { name: "Businessman", url: 'Business Man.glb', position: new THREE.Vector3(0, -1, 0) },
            { name: "Worker", url: 'Worker.glb', position: new THREE.Vector3(3.5, -1, 0) },
        ];
        
        this.isActive = false;

        this.isDragging = false;
        this.previousMouseX = 0.0;

        this._loadCharacterModels();

        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
    }

    _setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.selectionScene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        keyLight.position.set(2, 2, 3);
        this.selectionScene.add(keyLight);
        
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(-2, 1, 3);
        this.selectionScene.add(fillLight);
    }

    _loadCharacterModels() {
        const loader = new GLTFLoader();
        this.characterDefs.forEach((def, index) => {
            loader.load(def.url, (gltf) => {
                const model = gltf.scene;
                model.scale.setScalar(2);
                model.position.copy(def.position);
                model.userData.index = index; // Store index for easy lookup
                
                this.selectionScene.add(model);
                this.characterModels.push(model);

                // Default to selecting the first character once loaded
                if (index === 0) {
                    this._selectCharacter(0);
                }
            });
        });
    }

    showCharacterSelection() {
        this.isActive = true;
        this.selectionScreenElement.style.display = 'flex';

        document.getElementById('startGameBtn').onclick = () => this._startGame();
        
        this.selectionScreenElement.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);
        window.addEventListener('mousemove', this._onMouseMove);
    }
    
    _selectCharacter(index) {
        let selectionIndex = index;
        if (index === 0) {
            selectionIndex = 1;
        } else if (index === 1) {
            selectionIndex = 0;
        }

        if (selectionIndex < 0 || selectionIndex >= this.characterModels.length) return;

        // Deselect the previously selected character
        if (this.selectedCharacterIndex !== -1 && this.characterModels[this.selectedCharacterIndex]) {
            this.characterModels[this.selectedCharacterIndex].scale.setScalar(2); // Return to normal size
        }

        this.selectedCharacterIndex = selectionIndex;

        // Select the new character
        if (this.characterModels[this.selectedCharacterIndex]) {
            const selectedModel = this.characterModels[this.selectedCharacterIndex];
            selectedModel.scale.setScalar(2.2); // Make it slightly larger
            selectedModel.rotation.y = 0; // CRITICAL: Reset rotation to face forward.
        }
    }

    _onMouseDown(event) {
        // Prevent starting drag/selection if a UI button was clicked.
        if (event.target.tagName === 'BUTTON') {
            return;
        }

        // --- Raycasting for Selection ---
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.selectionCamera);

        const intersects = this.raycaster.intersectObjects(this.characterModels, true);

        if (intersects.length > 0) {
            let selectedObject = intersects[0].object;
            // Traverse up the hierarchy to find the parent group with the user data index
            while (selectedObject.parent && selectedObject.userData.index === undefined) {
                selectedObject = selectedObject.parent;
            }
            if (selectedObject.userData.index !== undefined) {
                this._selectCharacter(selectedObject.userData.index);
            }
        }
        
        // --- Always start drag for rotation after a click on the canvas area ---
        this.isDragging = true;
        this.previousMouseX = event.clientX;
    }

    _onMouseUp() {
        this.isDragging = false;
    }

    _onMouseMove(event) {
        if (!this.isDragging || this.selectedCharacterIndex === -1 || !this.characterModels[this.selectedCharacterIndex]) {
            return;
        }

        const deltaX = event.clientX - this.previousMouseX;
        this.previousMouseX = event.clientX;

        const model = this.characterModels[this.selectedCharacterIndex];
        const rotationAmount = deltaX * 0.02;
        model.rotation.y += rotationAmount;
    }

    _startGame() {
        if (this.selectedCharacterIndex === -1) {
            alert("Please select a character first!");
            return;
        }
        
        this.isActive = false;
        this.selectionScreenElement.style.display = 'none';

        this.selectionScreenElement.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mouseup', this._onMouseUp);
        window.removeEventListener('mousemove', this._onMouseMove);

        const selectedCharacterUrl = this.characterDefs[this.selectedCharacterIndex].url;

        this.playerController.loadCharacter(selectedCharacterUrl)
            .then(() => {
                this.onCharacterSelectedCallback();
            })
            .catch(err => {
                console.error("Failed to start game after character selection:", err);
                // Fallback to starting the game anyway
                this.onCharacterSelectedCallback();
            });
    }
    
    // This will be called in the main animate loop
    update(deltaTime) {
        if (!this.isActive) return;

        // Gently rotate all models for a dynamic feel
        this.characterModels.forEach((model, index) => {
            if (index !== this.selectedCharacterIndex) { // Don't auto-rotate the selected one
                model.rotation.y += deltaTime * 0.2;
            }
        });
    }

    onWindowResize() {
        this.selectionCamera.aspect = window.innerWidth / window.innerHeight;
        this.selectionCamera.updateProjectionMatrix();
    }
} 