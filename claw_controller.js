import * as THREE from 'three';
import { RigidBody } from './physics_engine.js';
import { Vec3 } from './physics_engine_vec3.js';
import { MeshBVH, MeshBVHHelper } from 'https://unpkg.com/three-mesh-bvh@0.7.0/build/index.module.js';

export class ClawController {
    // AGGIUNTA: Il costruttore ora accetta 'grabbableObjects'
 constructor(clawGroup, cylinders, clawBones, scene, objectsInteraction, physicsEngine, grabbableObjects, joystickPivot, button) {
        this.clawGroup = clawGroup;
        this.cylinders = cylinders;
        this.clawBones = clawBones;
        this.scene = scene;
        this.objectsInteraction = objectsInteraction;
        this.physicsEngine = physicsEngine;
        this.machineBox = null;
        this.chuteMesh = null;
        
        // AGGIUNTA: Memorizza l'array di oggetti
        this.grabbableObjects = grabbableObjects; 
        
        // --- State Machine ---
        this.automationState = 'MANUAL_HORIZONTAL';
        this.returnYPosition = 0;
        this.dropTargetY = 0;       // Questa verrà calcolata dinamicamente
        
        this.moveState = { left:false, right:false, forward:false, backward:false };
        this.moveSpeed = 1.5;
        this.moveMargin = 0.2;
        this.stopStatus = { A: false, B: false, C: false };
        this.spawnPosition = new THREE.Vector3();     // Posizione iniziale della claw
        this.dropOffPosition = new THREE.Vector3();   

        // ... (il resto del costruttore rimane invariato)
        this.isAnimating = false;
        this.isClosed = false;
        this.isClosing = false;
        this.isGrabbing = false;
        this.grabbedObject = null;
        this.lastClawPosition = new THREE.Vector3();
        this.chuteBox = null;
        this.dropZoneThreshold = 0.3;
        this.dropZoneIndicator = null;
        this.deliveredStars =10;
        this.initialTransforms = {};


        this.joystickPivot = joystickPivot; // Rinominiamo la proprietà per chiarezza
        this.button = button;
        this.initialJoystickRotation = this.joystickPivot ? this.joystickPivot.rotation.clone() : null;
        this.initialButtonPosition = this.button ? this.button.position.clone() : null;
        this.joystickTiltTarget = new THREE.Euler();
        this.buttonPressTime = 0;
        this.buttonPressDuration = 250; // in ms
        this.joystickTiltAngle = 0.3; // Manteniamo l'angolo piccolo

        this.storeInitialTransforms();
    }

    

    setDependencies(machineBox, chuteMesh) {
        this.machineBox = machineBox;
        this.chuteMesh = chuteMesh;
        
        // Memorizziamo la posizione di spawn iniziale della claw
        if(this.spawnPosition.lengthSq() === 0) {
            this.spawnPosition.copy(this.clawGroup.position);
        }

        if (this.machineBox) {
            // Definiamo il punto di rilascio in un angolo della macchina (es. in alto a destra)
            // Puoi cambiare 'max.x' e 'max.z' con 'min.x' e 'min.z' per scegliere un altro angolo
            this.dropOffPosition.set(
                this.machineBox.max.x - this.moveMargin - 0.1,
                0, // La Y verrà impostata al momento
                this.machineBox.max.z - this.moveMargin - 0.1
            );
        }
        
        // La logica della drop zone non è più necessaria per il rilascio automatico,
        // ma la lasciamo per usi futuri se necessario.
        if (this.chuteMesh) {
            this.chuteMesh.updateWorldMatrix(true, false);
            this.chuteBox = new THREE.Box3().setFromObject(this.chuteMesh);
            this.createDropZoneIndicator();
        }
    }

    storeInitialTransforms() {
        const objectsToStore = [...Object.values(this.clawBones), ...this.cylinders];
        objectsToStore.forEach(obj => {
            if (obj) {
                this.initialTransforms[obj.name] = {
                    position: obj.position.clone(),
                    rotation: obj.rotation.clone(),
                    scale: obj.scale.clone()
                };
            }
        });
    }

    toggleClaw() {
        if (this.isAnimating) {
            return; 
        }

        if (this.isClosed) {
            this.openClaw();
        } else {
            this.closeClaw();
        }
    }

    waitUntilAllStopped(callback) {
        const checkInterval = setInterval(() => {
            if (this.stopStatus.A && this.stopStatus.B && this.stopStatus.C) {
                clearInterval(checkInterval);
                console.log("Tutte le dita hanno colliso almeno una volta. Avvio apertura.");
                callback();
            }
        }, 50);
    }
    
    checkFingerCollisions() {
        const fingerToCylinder = { 'A': 'Cylinder', 'B': 'Cylinder003', 'C': 'Cylinder008' };
        const keys = ['A', 'B', 'C'];
    
        for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
                const f1 = keys[i];
                const f2 = keys[j];
    
                const c1 = this.clawGroup.getObjectByName(fingerToCylinder[f1]);
                const c2 = this.clawGroup.getObjectByName(fingerToCylinder[f2]);
    
                if (c1 && c2) {
                    // Usa bounding box aggiornate per ciascun cilindro
                    const box1 = new THREE.Box3().setFromObject(c1);
                    const box2 = new THREE.Box3().setFromObject(c2);
    
                    if (box1.intersectsBox(box2)) {
                        console.log(`Collisione tra dita ${f1} e ${f2}`);
                        this.stopStatus[f1] = true;
                        this.stopStatus[f2] = true;
                    }
                }
            }
        }
    }
    spendStarAsCoin() {
    if (this.deliveredStars > 0) {
        this.deliveredStars--;
        console.log(`🪙 Star spent! Remaining stars: ${this.deliveredStars}`);
        return true;
    } else {
        console.warn("Not enough stars to insert a coin.");
        return false;
    }
}


calculateAndSetDropHeight() {
    const fallbackHeight = this.machineBox ? this.machineBox.min.y + 0.5 : 0;

    // Fallback 1: L'array di oggetti non esiste o è vuoto.
    if (!this.grabbableObjects || this.grabbableObjects.length === 0) {
        this.dropTargetY = fallbackHeight;
        console.warn(`Nessun oggetto afferrabile trovato. Uso altezza di fallback: ${this.dropTargetY.toFixed(2)}`);
        return;
    }

    let highestY = -Infinity;
    this.grabbableObjects.forEach(objData => {
        // Controlla che il corpo fisico e la sua posizione siano validi
        if (objData && objData.body && objData.body.position && !objData.body.isHeld) {
            if (objData.body.position.y > highestY) {
                highestY = objData.body.position.y;
            }
        }
    });

    // Fallback 2: Gli oggetti esistono, ma nessuno ha fornito una coordinata Y valida.
    if (highestY === -Infinity) {
        this.dropTargetY = fallbackHeight;
        console.error(`Impossibile determinare l'altezza delle stelle! Uso altezza di fallback: ${this.dropTargetY.toFixed(2)}`);
        return;
    }

    const penetrationOffset = -0.15; // Valore di penetrazione
    this.dropTargetY = highestY - penetrationOffset; // SOTTRAIAMO l'offset invece di aggiungerlo

    // Controllo di sicurezza finale: assicurati che il target non sia sotto il pavimento della macchina
    if (this.machineBox && this.dropTargetY < this.machineBox.min.y) {
        console.warn(`L'altezza calcolata (${this.dropTargetY.toFixed(2)}) è sotto il pavimento. La imposto al livello minimo.`);
        this.dropTargetY = this.machineBox.min.y + 0.1;
    }

    console.log(`Altezza di discesa calcolata: ${this.dropTargetY.toFixed(2)} (penetrando di ${penetrationOffset} dalla stella più alta a ${highestY.toFixed(2)})`);
}



// in claw_controller.js


startDropSequence() {
    // --- INIZIO LOGICA DI BLOCCO CON MARGINE DI SICUREZZA ---
    if (this.chuteBox) {
        const clawPos = this.clawGroup.position;
        const chuteBounds = this.chuteBox;

        // --- NUOVO: Calcoliamo dinamicamente le dimensioni della claw ---
        const clawBox = new THREE.Box3().setFromObject(this.clawGroup);
        const clawSize = new THREE.Vector3();
        clawBox.getSize(clawSize);

        // Il margine di sicurezza è la metà della dimensione della claw su ciascun asse.
        // In questo modo, il blocco scatta quando il *bordo* della claw tocca la zona di rispetto.
        const safeMarginX = clawSize.x ;
        const safeMarginZ = clawSize.z ;

        // --- MODIFICATO: La condizione ora usa i margini di sicurezza ---
        // Controlliamo se il centro della claw entra in un'area "gonfiata" delle dimensioni del margine.
        const isOverChute =
            clawPos.x >= (chuteBounds.min.x - safeMarginX) &&
            clawPos.x <= (chuteBounds.max.x + safeMarginX) &&
            clawPos.z >= (chuteBounds.min.z - safeMarginZ) &&
            clawPos.z <= (chuteBounds.max.z + safeMarginZ);

        if (isOverChute) {
            console.warn("🚫 Discesa bloccata: la claw è troppo vicina all'area di scarico.");
            return; // Esce dalla funzione, impedendo l'avvio della sequenza.
        }
    }
    // --- ✅ FINE LOGICA DI BLOCCO ---

    // Il resto della funzione originale viene eseguito solo se il controllo precedente passa
    if (this.automationState === 'MANUAL_HORIZONTAL' && !this.isAnimating) { //
        console.log("▶️ Avvio sequenza di discesa..."); //
        
        if (this.button) { //
            this.buttonPressTime = Date.now(); //
        }

        this.calculateAndSetDropHeight();  //
        this.isAnimating = true; //
        this.returnYPosition = this.clawGroup.position.y; //
        this.automationState = 'DESCENDING'; //
    }
}

// --- NUOVO CICLO DI PRESA ASINCRONO ---
async runCloseSequence() {
    this.automationState = 'OPERATING';
    console.log("Attempting to grab...");

    await this.closeClaw(); // Chiudi la claw
    
    // Pausa per stabilizzare la presa (se c'è)
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log("Grab attempt finished. Ascending.");
    // Passa subito allo stato di risalita, SENZA aprire la claw
    this.automationState = 'ASCENDING';
}

// in claw_controller.js

async runReleaseAndReturnSequence() {
    this.automationState = 'RELEASING_OBJECT';

    // --- NEW RELEASE LOGIC ---
    // This is now the *only* place where the object's state transitions from "held" to "released".
    if (this.isGrabbing && this.grabbedObject) {
        this.deliveredStars++;
        console.log(`%c🌟 DELIVERY SUCCESS! Total Stars: ${this.deliveredStars}`, 'color: gold; font-weight: bold;');

        const body = this.grabbedObject.body;
        
        // 1. Un-pin the object from the claw controller.
        body.isHeld = false;
        this.isGrabbing = false;
        this.grabbedObject = null;

        // 2. Activate the physics engine's "clean release" system.
        body.ignoreClawCollision = true;
        body.isBeingReleased = true;
        body.releaseStartTime = Date.now();

        // 3. Reset physics state for a clean vertical drop.
        body.linearVelocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.force.set(0, 0, 0);
        body.torque.set(0, 0, 0);
        body.isSleeping = false;
        
        console.log(`🚀 CLEAN RELEASE: ${body.mesh.name} released from kinematic lock.`);
    }
    // --- END NEW LOGIC ---

    console.log("Opening claw to complete release...");
    
    await this.openClaw();
    await new Promise(resolve => setTimeout(resolve, 500)); 
    
    console.log("Returning to spawn point...");
    // The state transition to begin returning to the start position
    this.automationState = 'RETURNING_ASCEND';
}
// --- closeClaw E openClaw MODIFICATI PER RESTITUIRE PROMISES ---
closeClaw() {
    return new Promise(resolve => {
        console.log("Closing claw...");
        this.isClosing = true;
        // Resetta lo stato di stop all'inizio di ogni chiusura
        this.stopStatus = { A: false, B: false, C: false };

        const closeStep = 0.03;
        let rotationSteps = 0;
        const maxSteps = 60;

        const grabInterval = setInterval(() => {
            rotationSteps++;

            // Ruota le dita solo se non sono state fermate da una collisione
            if (this.clawBones.A && !this.stopStatus.A) {
                this.clawBones.A.rotation.z -= closeStep;
            }
            if (this.clawBones.B && !this.stopStatus.B) {
                this.clawBones.B.rotation.z -= closeStep;
            }
            if (this.clawBones.C && !this.stopStatus.C) {
                this.clawBones.C.rotation.z -= closeStep;
            }
            
            this.cylinders.forEach(c => c.updateMatrixWorld(true));

            // Esegui il controllo delle collisioni ad ogni passo
            this.checkFingerCollisions();

            // Condizioni di stop: timeout OPPURE tutte le dita si sono fermate
            const allFingersCollided = this.stopStatus.A && this.stopStatus.B && this.stopStatus.C;

            if (rotationSteps >= maxSteps || allFingersCollided) {
                clearInterval(grabInterval);
                this.isClosed = true;
                this.isClosing = false;
                const reason = allFingersCollided ? "finger collision" : "timeout";
                console.log(`Claw closed (${reason}).`);
                resolve(); // La Promise è risolta
            }
        }, 50);
    });
}


// in claw_controller.js

openClaw() {
    return new Promise(resolve => {
        // --- SIMPLIFIED: This function no longer manages the grabbed object's state. ---
        
        console.log("Opening claw animation...");
        const openSteps = 30;
        let currentStep = 0;
    
        const startRotations = {
            A: this.clawBones.A.rotation.z,
            B: this.clawBones.B.rotation.z,
            C: this.clawBones.C.rotation.z
        };
        const targetRotations = {
            A: this.initialTransforms[this.clawBones.A.name].rotation.z,
            B: this.initialTransforms[this.clawBones.B.name].rotation.z,
            C: this.initialTransforms[this.clawBones.C.name].rotation.z
        };
    
        const openInterval = setInterval(() => {
            currentStep++;
            const progress = currentStep / openSteps;
    
            this.clawBones.A.rotation.z = THREE.MathUtils.lerp(startRotations.A, targetRotations.A, progress);
            this.clawBones.B.rotation.z = THREE.MathUtils.lerp(startRotations.B, targetRotations.B, progress);
            this.clawBones.C.rotation.z = THREE.MathUtils.lerp(startRotations.C, targetRotations.C, progress);
    
            if (currentStep >= openSteps) {
                clearInterval(openInterval);
                this.isClosed = false;
                console.log("Claw opened.");
                resolve(); // The Promise is resolved
            }
        }, 30);
    });
}
    applyDirectLink(deltaTime) {
        if (!this.isGrabbing || !this.grabbedObject) {
            return;
        }

        const objectBody = this.grabbedObject.body;
        objectBody.isSleeping = false;
        
        // --- Position ---
        // The target position is the center of the claw
        const targetPosition = new THREE.Vector3();
        this.clawGroup.getWorldPosition(targetPosition);
        targetPosition.y -= 0.15;

        // Directly set the object's position for a zero-lag connection
        objectBody.position.copy(targetPosition);

        // --- Velocity ---
        // Calculate the claw's current velocity based on its position change
        const clawVelocity = new THREE.Vector3()
            .copy(this.clawGroup.position)
            .sub(this.lastClawPosition)
            .divideScalar(deltaTime);

        // Directly set the object's velocity to match the claw's
        objectBody.linearVelocity.copy(clawVelocity);
        
        // Also, kill any rotation for stability
        objectBody.angularVelocity.set(0, 0, 0);
    }
    
    isInDropZone() {
        if (!this.chuteBox || !this.isGrabbing) {
            return false;
        }
        
        const clawPosition = this.clawGroup.position;
        
        // Check if claw is horizontally above the chute
        const isAboveChute = clawPosition.x >= this.chuteBox.min.x && 
                           clawPosition.x <= this.chuteBox.max.x &&
                           clawPosition.z >= this.chuteBox.min.z && 
                           clawPosition.z <= this.chuteBox.max.z;
        
        // Check if claw is within drop threshold above chute
        const isWithinDropHeight = clawPosition.y <= (this.chuteBox.max.y + this.dropZoneThreshold) &&
                                 clawPosition.y >= this.chuteBox.max.y;
        
        return isAboveChute && isWithinDropHeight;
    }
    
    triggerAutoDrop() {
        if (!this.isGrabbing || !this.grabbedObject) {
            return;
        }
        
        console.log(`%cAUTO-DROP: Releasing ${this.grabbedObject.name} into chute!`, 'color: orange; font-weight: bold;');
        
        // Increment delivered counter
        this.deliveredStars++;
        console.log(`%c🌟 DELIVERY SUCCESS! Stars delivered: ${this.deliveredStars}`, 'color: gold; font-weight: bold;');
        
        // Release the object
        this.grabbedObject.body.isHeld = false;
        
        // Give it a slight downward velocity to ensure it falls into the chute
        this.grabbedObject.body.linearVelocity.set(0, -1, 0);
        this.grabbedObject.body.angularVelocity.set(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );
        
        // Clear grab state
        this.isGrabbing = false;
        this.grabbedObject = null;
        
        // Automatically open the claw
        if (this.isClosed) {
            this.openClaw();
        }
    }
    
    createDropZoneIndicator() {
        if (!this.chuteBox || !this.scene) return;
        
        // Create a subtle wireframe box above the chute
        const geometry = new THREE.BoxGeometry(
            this.chuteBox.max.x - this.chuteBox.min.x,
            this.dropZoneThreshold,
            this.chuteBox.max.z - this.chuteBox.min.z
        );
        
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        
        this.dropZoneIndicator = new THREE.Mesh(geometry, material);
        
        // Position it above the chute
        const center = this.chuteBox.getCenter(new THREE.Vector3());
        this.dropZoneIndicator.position.set(
            center.x,
            this.chuteBox.max.y + this.dropZoneThreshold / 2,
            center.z
        );
        
        this.dropZoneIndicator.visible = false; // Hidden by default
        this.scene.add(this.dropZoneIndicator);
    }
    
    updateDropZoneIndicator() {
        if (!this.dropZoneIndicator) return;
        
        // Show indicator only when grabbing an object and near drop zone
        const shouldShow = this.isGrabbing && this.isInDropZone();
        
        if (shouldShow && !this.dropZoneIndicator.visible) {
            this.dropZoneIndicator.visible = true;
            this.dropZoneIndicator.material.color.setHex(0x00ff00); // Green when ready to drop
        } else if (!shouldShow && this.dropZoneIndicator.visible) {
            this.dropZoneIndicator.visible = false;
        }
        
        // Add pulsing effect when in drop zone
        if (shouldShow) {
            const time = Date.now() * 0.01;
            this.dropZoneIndicator.material.opacity = 0.3 + 0.2 * Math.sin(time);
        }
    }

        // NUOVO: Metodo per animare il pulsante
    updateButtonAnimation() {
        if (!this.button || this.buttonPressTime === 0) return;

        const elapsed = Date.now() - this.buttonPressTime;
        const pressDepth = -0.05; // Quanto scende il pulsante

        if (elapsed < this.buttonPressDuration) {
            // Usa una curva sinusoidale per un movimento di andata e ritorno fluido
            const progress = Math.sin((elapsed / this.buttonPressDuration) * Math.PI);
            this.button.position.y = this.initialButtonPosition.y + progress * pressDepth;
        } else {
            // Resetta alla fine dell'animazione
            this.button.position.copy(this.initialButtonPosition);
            this.buttonPressTime = 0;
        }
    }

 updateJoystickTilt() {
        // MODIFICATO: Controlliamo e ruotiamo 'joystickPivot'
        if (!this.joystickPivot) return;
        
        let targetTiltX = 0;
        if (this.moveState.forward) {
            targetTiltX = -this.joystickTiltAngle;
        } else if (this.moveState.backward) {
            targetTiltX = this.joystickTiltAngle;
        }

        let targetTiltZ = 0;
        if (this.moveState.left) {
            targetTiltZ = this.joystickTiltAngle;
        } else if (this.moveState.right) {
            targetTiltZ = -this.joystickTiltAngle;
        }
        
        this.joystickTiltTarget.x = targetTiltX;
        this.joystickTiltTarget.z = targetTiltZ;

        // MODIFICATO: Applichiamo la rotazione al PIVOT
        this.joystickPivot.rotation.x = THREE.MathUtils.lerp(this.joystickPivot.rotation.x, this.joystickTiltTarget.x, 0.1);
        this.joystickPivot.rotation.z = THREE.MathUtils.lerp(this.joystickPivot.rotation.z, this.joystickTiltTarget.z, 0.1);
    }




    update(deltaTime) {
        // La logica prima dello switch non cambia
        this.lastClawPosition.copy(this.clawGroup.position);
        this.updateButtonAnimation();
        this.updateJoystickTilt();
        
        if (this.isClosing && !this.isGrabbing) {
            const potentialObject = this.objectsInteraction.getGrabbableCandidate(2);
            if (potentialObject) {
                // 🆕 SAFETY CHECK: Don't grab objects that are being released
                if (potentialObject.body.isBeingReleased) {
                    console.log(`⚠️ Skipping grab of ${potentialObject.name} - object is in clean release mode`);
                    return;
                }
                
                this.isGrabbing = true;
                this.grabbedObject = potentialObject;
                this.grabbedObject.body.isHeld = true;
                console.log(`%cGRAB SUCCESS: Holding ${potentialObject.name}!`, 'color: lightgreen; font-weight: bold;');
            }
        }
        if (this.isGrabbing) {
            this.applyDirectLink(deltaTime);
        }

        // --- VERSIONE COMPLETA E CORRETTA DELLO SWITCH ---
        switch (this.automationState) {

            case 'MANUAL_HORIZONTAL': {
                if (this.machineBox) {
                    const v = new THREE.Vector3();
                    if (this.moveState.left)      v.x -= 1;
                    if (this.moveState.right)     v.x += 1;
                    if (this.moveState.forward)   v.z -= 1;
                    if (this.moveState.backward)  v.z += 1;

                    if (v.lengthSq() > 0) {
                        v.normalize().multiplyScalar(this.moveSpeed * deltaTime);
                        this.clawGroup.position.add(v);
                    }
        
                    const minX = this.machineBox.min.x + this.moveMargin;
                    const maxX = this.machineBox.max.x - this.moveMargin;
                    const minZ = this.machineBox.min.z + this.moveMargin;
                    const maxZ = this.machineBox.max.z - this.moveMargin;
                    this.clawGroup.position.x = THREE.MathUtils.clamp(this.clawGroup.position.x, minX, maxX);
                    this.clawGroup.position.z = THREE.MathUtils.clamp(this.clawGroup.position.z, minZ, maxZ);
                }
                break;
            }

            case 'DESCENDING': {
                if (this.clawGroup.position.y > this.dropTargetY) {
                    this.clawGroup.position.y -= this.moveSpeed * deltaTime;
                } else {
                    this.clawGroup.position.y = this.dropTargetY;
                    this.runCloseSequence();
                }
                break;
            }

            case 'OPERATING': {
                // Stato di attesa, corretto che sia vuoto
                break;
            }

            case 'ASCENDING': {
                if (this.clawGroup.position.y < this.returnYPosition) {
                    this.clawGroup.position.y += this.moveSpeed * deltaTime;
                } else {
                    this.clawGroup.position.y = this.returnYPosition;
                    console.log(`Arrivato in cima. Stato di grabbing: ${this.isGrabbing}, Oggetto: ${this.grabbedObject?.name || 'nessuno'}`);
    
                    if (this.isGrabbing && this.grabbedObject) {
                        console.log("Prize acquired! Starting delivery sequence.");
                        this.automationState = 'DELIVERING_MOVE_X';
                    } else {
                        console.log("Grab failed, opening claw for next turn.");
                        this.automationState = 'RELEASING_OBJECT';
                        this.openClaw().then(() => {
                            this.automationState = 'MANUAL_HORIZONTAL';
                            this.isAnimating = false;
                        });
                    }
                }
                break;
            }

            case 'DELIVERING_MOVE_X': {
                const targetX = this.dropOffPosition.x;
                const currentX = this.clawGroup.position.x;
                this.clawGroup.position.x = THREE.MathUtils.lerp(currentX, targetX, 0.05);
                if (Math.abs(currentX - targetX) < 0.01) {
                    this.clawGroup.position.x = targetX;
                    console.log("X movement complete. Starting Z movement.");
                    this.automationState = 'DELIVERING_MOVE_Z';
                }
                break;
            }

            case 'DELIVERING_MOVE_Z': {
                const targetZ = this.dropOffPosition.z;
                const currentZ = this.clawGroup.position.z;
                this.clawGroup.position.z = THREE.MathUtils.lerp(currentZ, targetZ, 0.05);
                if (Math.abs(currentZ - targetZ) < 0.01) {
                    this.clawGroup.position.z = targetZ;
                    console.log("Z movement complete. Arrived at drop-off point.");
                    this.automationState = 'DELIVERING_DESCEND';
                }
                break;
            }

            case 'DELIVERING_DESCEND': {
                const descendTargetY = this.returnYPosition - 0.5;
                if (this.clawGroup.position.y > descendTargetY) {
                    this.clawGroup.position.y -= this.moveSpeed * deltaTime;
                } else {
                    this.runReleaseAndReturnSequence();
                }
                break;
            }
                
            case 'RELEASING_OBJECT': {
                break;
            }

            case 'RETURNING_ASCEND': {
                if (this.clawGroup.position.y < this.returnYPosition) {
                    this.clawGroup.position.y += this.moveSpeed * deltaTime;
                } else {
                    this.clawGroup.position.y = this.returnYPosition;
                    console.log("Ascend complete. Returning on Z-axis.");
                    this.automationState = 'RETURNING_MOVE_Z';
                }
                break;
            }

            case 'RETURNING_MOVE_Z': {
                const spawnZ = this.spawnPosition.z;
                const currentZ = this.clawGroup.position.z;
                this.clawGroup.position.z = THREE.MathUtils.lerp(currentZ, spawnZ, 0.05);
                if (Math.abs(currentZ - spawnZ) < 0.01) {
                    this.clawGroup.position.z = spawnZ;
                    console.log("Z-axis return complete. Returning on X-axis.");
                    this.automationState = 'RETURNING_MOVE_X';
                }
                break;
            }

            case 'RETURNING_MOVE_X': {
                const spawnX = this.spawnPosition.x;
                const currentX = this.clawGroup.position.x;
                this.clawGroup.position.x = THREE.MathUtils.lerp(currentX, spawnX, 0.05);
                if (Math.abs(currentX - spawnX) < 0.01) {
                    console.log("✅ Sequence complete. Ready for manual control.");
                    this.clawGroup.position.copy(this.spawnPosition);
                    this.automationState = 'MANUAL_HORIZONTAL';
                    this.isAnimating = false;
                }
                break;
            }
        }
        
        if (this.cylinders) {
            this.cylinders.forEach(cyl => cyl.updateMatrixWorld(true));
        }
    } 
        
    
    checkClawCollision(velocity) {
        if (!this.chuteMesh) return false;
    
        const chuteBVH = this.chuteMesh.geometry.boundsTree;
        const clawBBox = new THREE.Box3();
        let collisionDetected = false;
    
        // This matrix transforms points from world space to the chute's local space
        const worldToChuteMatrix = new THREE.Matrix4().copy(this.chuteMesh.matrixWorld).invert();
    
        // Test each axis of movement independently
        ['x', 'y', 'z'].forEach(axis => {
            if (velocity[axis] === 0) return;
    
            // Get the claw's bounding box in its potential new position
            clawBBox.setFromObject(this.clawGroup);
            const moveVector = new THREE.Vector3();
            moveVector[axis] = velocity[axis];
            clawBBox.translate(moveVector);
    
            // Check for collision
            if (chuteBVH.intersectsBox(clawBBox, worldToChuteMatrix)) {
                // If a collision would occur, nullify the movement on this axis
                velocity[axis] = 0;
                collisionDetected = true;
            }
        });
    
        // Apply the corrected velocity vector (some components might be zero)
        this.clawGroup.position.add(velocity);
    
        // Return true if any collision was detected and prevented
        return collisionDetected;
    }

    setMoving(direction, state) {
        this.moveState[direction] = state;
    }
    
    getDeliveredStars() {
        return this.deliveredStars;
    }
    
    resetScore() {
        this.deliveredStars = 0;
        console.log('Score reset to 0');
    }
} 