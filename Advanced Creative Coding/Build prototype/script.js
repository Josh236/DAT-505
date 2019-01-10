'use strict';

 Physijs.scripts.worker = 'js/physijs_worker.js';
 Physijs.scripts.ammo = 'ammo.js';



noise.seed(Math.random());

var stats = new Stats();
stats.showPanel(1);

// var THREEx    = THREEx    || {};

var zTranslation = 0.0;
var xTranslation = 0.0;

var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.9, 10000);
camera.position.set(0, 2, -2);

var scene = new Physijs.Scene({fixedTimeStep: 1/60});
scene.setGravity(new THREE.Vector3(0, -10, 0));

camera.lookAt(scene.position);

var listener = new THREE.AudioListener();
camera.add( listener );

// create a global audio source
var sound = new THREE.Audio( listener );

// var keyboard = new THREEx.KeyboardState();

// load a sound and set it as the Audio object's buffer
var audioLoader = new THREE.AudioLoader();
audioLoader.load( 'music/Initial D Running.mp3', function( buffer ) {
	sound.setBuffer( buffer );
	sound.setLoop( true );
	sound.setVolume( 0.1 );
	sound.play();
});


var renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

var controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;
controls.enableKeys = false;


var ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

var directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(3, 3, 3);
scene.add(directionalLight);

var directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight2.position.set(-3, 10, 5);
scene.add(directionalLight2);

var ground = new THREE.Object3D();
ground.rotation.x = Math.PI/2;
scene.add(ground);

var plane = new Physijs.BoxMesh(
  new THREE.CubeGeometry(25000, 0.1, 25000),
  new THREE.MeshPhongMaterial({color:0x222222, side:THREE.DoubleSide}),
  0
);

scene.add(plane);

// var loader = new THREE.GLTFLoader();
// loader.load(
//   '/model/Car.glb',
//   function ( gltf ) {
//     var model = gltf.scene;
//     gltf.scene.position.set(0, 0, 0);
//     scene.add(model);
//
//   });


var loader = new THREE.OBJLoader2();

var callbackOnLoad = function (event){
  scene.add(event.detail.loaderRootNode);
}
loader.load('model/Car.obj', callbackOnLoad, null, null, null, false);





// var car = new Physijs.BoxMesh(
//   new THREE.CubeGeometry(10, 10, 50),
//   new THREE.MeshPhongMaterial({color:0xffffff}), 1
// );

var car = new THREE.Mesh(
  new THREE.CubeGeometry(10, 10, 50),
  new THREE.MeshPhongMaterial({color:0xffffff}), 1
);

car.position.y = 5;
car.add(camera);
scene.add(car);

//var keyboard = new THREEx.KeyboardState();


var BUILDING_MAT = new THREE.MeshPhongMaterial({color: 0xffffff, vertexColors: THREE.VertexColors});
BUILDING_MAT.side = THREE.DoubleSide;
BUILDING_MAT.shading = THREE.FlatShading;


var cellSize = 60;
var gridSize = 40;
var allBuildings = [];
var count = 0;

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


function updateGrid(){
  var building, dx, dy, newX, newY, buffer;
  buffer = cellSize * gridSize/2;

  for (var i=0; i<allBuildings.length; i++){
    building = allBuildings[i];

    if (!building.isDead){
      dy = building.y - cameraTarget.position.z;
      dx = building.x - cameraTarget.position.x;
      newX = building.x;
      newY = building.y;

      if (dx > buffer){
        newX -= buffer*2;
        building.isDead = true;
      }
      else if (dy <- buffer){
        newY += buffer*2;
        building.isDead = true;
      }
      if (building.isDead){
        setTimeout(addNewBuilding.bind(this, newX, newY, i), Math.random() * 200);
      }
    }
  }
}

var Speed = 10;

var addNewBuilding = function(x, y, index){
  var building = allBuildings[index];
  ground.remove(building.object);
  building.destroy();
  allBuildings[index] = null;

  var newBuilding = new Building(x, y, false);
  allBuildings[index] = newBuilding;

  if (!newBuilding.isStreet){
    ground.add(newBuilding.object);
  }
}

car.position.z = zTranslation;
car.position.x = xTranslation;

document.addEventListener("keydown", onDocumentKeyDown, false);
function onDocumentKeyDown(event){
  var keyCode = event.which;
  if (keyCode == 87){
      car.position.z -= Speed;

  } else if (keyCode == 83){
      zTranslation += Speed;

  } else if (keyCode == 65){
      //xTranslation -= Speed;
      car.rotation.y += 0.1;

  } else if (keyCode == 68){
      xTranslation += Speed;
      car.rotation.y -= 0,1;
  }
  console.log(event);
  render();
};





function animate(){


  render();
}

function render(){
  stats.begin();
  // if(keyboard.pressed("left")) {
  //   car.rotation.y += 0.1;
  //   angle += 0.1;
  // }
  // if(keyboard.pressed("right")) {
  //   car.rotation.y -= 0.1;
  //   angle -= 0.1;
  // }
  // if(keyboard.pressed("up")) {
  //   car.position.z -= Math.sin(-angle);
  //   car.position.x -= Math.cos(-angle);
  // }
  // if(keyboard.pressed("down")) {
  //   car.position.z += Math.sin(-angle);
  //   car.position.x += Math.cos(-angle);
  // }
  //controls.update();
  requestAnimationFrame(render);
  scene.simulate();
  //updateFlight();
  renderer.render(scene, camera);
  controls.update();
  // update();
  stats.end();
}
render()
