/*
 * Activity: Implementing the Phong lighting model.
 */


'use strict';

import * as twgl from 'twgl-base.js';
import GUI from 'lil-gui';
import { M4, type Mat4, type Vec3 } from '../../libs/3d-lib';
import { Scene } from '../../libs/scene.js';
import { randomColor } from '../../libs/color.ts';
import { Object3D } from '../../libs/object3d.ts';
import { Camera3D } from '../../libs/camera3d.ts';
import { Light3D } from '../../libs/light3d.ts';
import { cubeFaceColors } from '../../libs/shapes.ts';

// Define the shader code, using GLSL 3.00
import vsGLSL from './vs_phong_activity.glsl?raw';
import fsGLSL from './fs_phong_activity.glsl?raw';

class PhongActivityScene extends Scene {

    // Variable for the scene settings
    settings = {
        // Speed in degrees
        rotationSpeed: {
            x: 10,
            y: 10,
            z: 10,
        },
    };

    // Duration of the animation in milliseconds
    duration: number = 1000;
    camera: Camera3D;
    lights: Light3D[] = [];
    object: Object3D;

    constructor(gl: WebGL2RenderingContext) {
        super(gl, vsGLSL, fsGLSL);

        // Configure the camera for this scene
        this.camera = new Camera3D(
            0,              // ID
            10,             // Distance to target
            0,              // Azimut
            0,              // Elevation
            [0, 0, 0],
            [0, 0, 0]);
        // Make the camera respond to keyboard events
        this.camera.setupControls();

        this.lights.push(new Light3D(
            0,                      // ID
            [3, 3, 5],              // Position
            [0.3, 0.3, 0.3, 1.0],   // Ambient
            [1.0, 1.0, 1.0, 1.0],   // Diffuse
            [1.0, 1.0, 1.0, 1.0],   // Specular
        ));

        // Create the cube object for this scene
        this.object = this.addObject('cube', cubeFaceColors(3), randomColor());
    }

    drawObject(object: Object3D, viewProjectionMatrix: Mat4): void {
        // Get the WebGL context and program info
        const { gl, programInfo } = this;

        // Prepare the vector for translation and scale
        let v3_tra: Vec3 = object.posArray;
        let v3_sca: Vec3 = object.scaArray;

        // Create the individual transform matrices
        const scaMat: Mat4 = M4.scale(v3_sca);
        const rotXMat: Mat4 = M4.rotationX(object.transforms.rr.x);
        const rotYMat: Mat4 = M4.rotationY(object.transforms.rr.y);
        const rotZMat: Mat4 = M4.rotationZ(object.transforms.rr.z);
        const traMat: Mat4 = M4.translation(v3_tra);

        // Create the composite matrix with all transformations
        let transforms: Mat4 = M4.identity();
        transforms = M4.multiply(scaMat, transforms);
        transforms = M4.multiply(rotXMat, transforms);
        transforms = M4.multiply(rotYMat, transforms);
        transforms = M4.multiply(rotZMat, transforms);
        transforms = M4.multiply(traMat, transforms);

        // Apply the projection to the final matrix for the
        // World-View-Projection
        const wvpMat: Mat4 = M4.multiply(viewProjectionMatrix, transforms);

        // The matrix to be used for normal transformations
        const normalMat = M4.transpose(M4.inverse(transforms));

        let uniforms = {
            u_world: transforms,
            u_worldViewProjection: wvpMat,
            u_worldInverseTransform: normalMat,
            u_ambientColor: object.color,
            u_diffuseColor: object.color,
            u_specularColor: object.color,
            u_shininess: object.shininess,
        }

        twgl.setUniforms(programInfo, uniforms);
        gl.bindVertexArray(object.vao);
        twgl.drawBufferInfo(gl, object.bufferInfo);
    }

    // Function to do the actual display of the scene
    render(deltaTime: number): void {
        const { gl, programInfo } = this;

        // Clear the canvas
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Tell webgl to cull faces
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        gl.useProgram(programInfo.program);

        // Scene uniforms
        const globalUniforms = {
            u_lightWorldPosition: this.lights[0].posArray,
            u_viewWorldPosition: this.camera.posArray,
            u_ambientLight: this.lights[0].ambient,
            u_diffuseLight: this.lights[0].diffuse,
            u_specularLight: this.lights[0].specular,
        }
        twgl.setUniforms(programInfo, globalUniforms);

        // Check for camera keys and update the camera position
        this.camera.checkKeys();
        const viewProjectionMatrix = this.camera.setupViewProjection(gl);

        const cube = this.getObject('cube');
        this.renderMultipleCubes(viewProjectionMatrix, cube, deltaTime);
    }

    renderMultipleCubes(
        viewProjectionMatrix: Mat4,
        object: Object3D,
        deltaTime: number
    ): void {
        // Calculate the fraction of the duration that has passed
        const fract = deltaTime / this.duration;

        // Rotate the base object according to the settings
        object.transforms.rd.x = (object.transforms.rd.x + this.settings.rotationSpeed.x * fract) % 360;
        object.transforms.rd.y = (object.transforms.rd.y + this.settings.rotationSpeed.y * fract) % 360;
        object.transforms.rd.z = (object.transforms.rd.z + this.settings.rotationSpeed.z * fract) % 360;
        object.transforms.rr.x = object.transforms.rd.x * Math.PI / 180;
        object.transforms.rr.y = object.transforms.rd.y * Math.PI / 180;
        object.transforms.rr.z = object.transforms.rd.z * Math.PI / 180;

        this.drawObject(object, viewProjectionMatrix);
    }

    // Setup UI controls to inspect the lighting
    setupUI() {
        const gui = new GUI();

        const animFolder = gui.addFolder('Animation:')
        animFolder.add( this.settings.rotationSpeed, 'x', 0, 360).decimals(2)
        animFolder.add( this.settings.rotationSpeed, 'y', 0, 360).decimals(2)
        animFolder.add( this.settings.rotationSpeed, 'z', 0, 360).decimals(2)
        animFolder.close();

        const modelFolder = gui.addFolder('Model material')
        modelFolder.addColor( this.object, 'color')
        modelFolder.add( this.object, 'shininess', 1, 200, 1)

        // Settings for the light
        const lightFolder = gui.addFolder('Light:')
        lightFolder.add( this.lights[0].position, 'x', -20, 20)
            .decimals(2)
        lightFolder.add( this.lights[0].position, 'y', -20, 20)
            .decimals(2)
        lightFolder.add( this.lights[0].position, 'z', -20, 20)
            .decimals(2)

        lightFolder.addColor(this.lights[0], 'ambient')
        lightFolder.addColor(this.lights[0], 'diffuse')
        lightFolder.addColor(this.lights[0], 'specular')
    }
}

/*
 * Main function to initialize the WebGL context, create the scene, and set up the UI.
 */
function main(): void {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        throw new Error('No canvas element found in the document');
    }

    const gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL2 is not supported by this browser');
    }

    const scene = new PhongActivityScene(gl);
    scene.setupUI();
    scene.draw(0);
}

main()
