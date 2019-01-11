'use strict';

//loading physics scripts

 Physijs.scripts.worker = 'js/physijs_worker.js';
 Physijs.scripts.ammo = 'ammo.js';

//global variables
var object = 0;
var car;
noise.seed(Math.random());
var clock = new THREE.Clock();
var stats = new Stats();
var zTranslation = 0.0;
var xTranslation = 0.0;
stats.showPanel(1);
//importing THREEx
var THREEx    = THREEx    || {};
var keyboard = new THREEx.KeyboardState();

//camera setup
var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.9, 10000);
camera.position.set(100, 100, -20);
//scene setup with physics engine implemented
var scene = new Physijs.Scene({fixedTimeStep: 1/60});
//setting up gravity
scene.setGravity(new THREE.Vector3(0, -10, 0));

camera.lookAt(scene.position);

//audio loader
var listener = new THREE.AudioListener();
camera.add( listener );

// create a global audio source
var sound = new THREE.Audio( listener );


// load a sound
var audioLoader = new THREE.AudioLoader();
//finding mp3 file
audioLoader.load( 'music/Initial D Running.mp3', function( buffer ) {
	sound.setBuffer( buffer );
	sound.setLoop( true );
	sound.setVolume( 0.1 );
	sound.play();
});

//setting up renderer
var renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
//camera controls
var controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;
controls.enableKeys = false;

//lighting setup
var ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

var directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(3, 3, 3);
scene.add(directionalLight);

var directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight2.position.set(-3, 10, 5);
scene.add(directionalLight2);

//ground underneath buildings
var ground = new THREE.Object3D();
ground.rotation.x = Math.PI/2;
scene.add(ground);
//large plane across the space with physics engine
var plane = new Physijs.BoxMesh(
  new THREE.CubeGeometry(25000, 0.1, 25000),
  new THREE.MeshPhongMaterial({color:0x222222, side:THREE.DoubleSide}),
  0
);

scene.add(plane);
//object importing from .OBJ file
var manager = new THREE.LoadingManager( loadModel );

var textureLoader = new THREE.TextureLoader( manager );

var loader = new THREE.OBJLoader2( manager );

function loadModel(){
  object.traverse( function ( child ){
    if ( child.isMesh ) child.material.map = new THREE.MeshPhongMaterial({color:0xffffff});
  });
//setting size and position of loaded model
  object.scale.x = 3;
  object.scale.y = 3;
  object.scale.z = 3;
  object.position.y = 5;
  scene.add(object);
}
loader.load('model/Car.obj', function ( obj ){
   object = obj;
});

//material of builinds being generated
var BUILDING_MAT = new THREE.MeshPhongMaterial({color: 0xffffff, vertexColors: THREE.VertexColors});
BUILDING_MAT.side = THREE.DoubleSide;
BUILDING_MAT.shading = THREE.FlatShading;

//change these values to increase/decrease size of city
var cellSize = 60;
var gridSize = 40;
var allBuildings = [];
var count = 0;

//building spaces for building streets
for (var i=0; i<gridSize; i++){
  for (var j=0; j<gridSize; j++){
    var building = new Building(i*cellSize, j*cellSize, false);
    allBuildings[count] = building;
    if (!building.isStreet){
      ground.add(building.object);
    }
    count++;
  }
}


function animate(){


  render();
}

//setting up variables for movement
var angle = Math.PI/2;

function render(){
  stats.begin();

//variables for movement and turning
  var delta = clock.getDelta()
  var rotate = angle * delta;
  var moveDistance = 50 * delta;
  //movement
  if(keyboard.pressed("W")) {
    object.translateX(-moveDistance);
  }
  if(keyboard.pressed("A")) {
    object.rotateOnAxis( new THREE.Vector3(0, 1, 0), rotate );

  }
  if(keyboard.pressed("S")) {
    object.translateX(moveDistance);
  }
  if(keyboard.pressed("D")) {
    object.rotateOnAxis( new THREE.Vector3(0, 1, 0), -rotate );
  }
//setting up chase camera, might not work currently
  if(keyboard.pressed("A")) {
    camera.translateX(moveDistance);
    //angle += 0.1;
  }
  if(keyboard.pressed("W")) {
    camera.rotateOnAxis( new THREE.Vector3(0, 1, 0), -rotate );
    //angle -= 0.1;
  }
  if(keyboard.pressed("D")) {
    camera.translateX(-moveDistance);
  }
  if(keyboard.pressed("S")) {
    camera.rotateOnAxis( new THREE.Vector3(0, 1, 0), rotate );
  }

  controls.update();
  requestAnimationFrame(render);
  //this allows physics to be run on this scene
  scene.simulate();
  renderer.render(scene, camera);
  //camera.lookAt(object.position);

  stats.end();

}
render()
