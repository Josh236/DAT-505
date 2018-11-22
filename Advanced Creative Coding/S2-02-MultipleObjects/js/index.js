var scene, camera, renderer;

// Create an empty scene
scene = new THREE.Scene();

// Create a basic perspective camera
camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
camera.position.z = 2.5;

// Create a renderer with Antialiasing
renderer = new THREE.WebGLRenderer({antialias:true});

// Configure renderer clear color
renderer.setClearColor("#2E2B40");

// Configure renderer size
renderer.setSize( window.innerWidth, window.innerHeight );

// Append Renderer to DOM
document.body.appendChild( renderer.domElement );

// ------------------------------------------------
// Main Content
// ------------------------------------------------
var geometry = new THREE.BoxGeometry( 1, 1, 1 );
var material = new THREE.MeshNormalMaterial( { color: "#433F81" } );
var cube01 = new THREE.Mesh( geometry, material );
scene.add( cube01 );

var geometry = new THREE.BoxGeometry( 2,2,2 );
var material = new THREE.MeshBasicMaterial( { color: "#FF00FF",wireframe:true,transparent:true } );
var cube01_wireframe = new THREE.Mesh( geometry, material );
scene.add( cube01_wireframe );

var geometry = new THREE.BoxGeometry( 1, 1, 1 );
var material = new THREE.MeshNormalMaterial( { color: "#A49FEF" } );
var cube02 = new THREE.Mesh( geometry, material );
scene.add( cube02 );

var geometry = new THREE.BoxGeometry( 2,2,2 );
var material = new THREE.MeshBasicMaterial({color:"#71E8B8",wireframe:true,transparent:true,opacity: 0.3});
var cube02_wireframe = new THREE.Mesh( geometry, material );
scene.add( cube02_wireframe );

var geometry = new THREE.BoxGeometry( 10, 0.1, 0.5 );
var material = new THREE.MeshBasicMaterial( { color: "#00FFBC" } );
var bar01 = new THREE.Mesh( geometry, material );
bar01.position.z = -0.5;
scene.add( bar01 );

var geometry = new THREE.BoxGeometry( 10, 0.1, 0.5 );
var material = new THREE.MeshBasicMaterial( { color: "#ffffff" } );
var bar02 = new THREE.Mesh( geometry, material );
bar02.position.z = -0.5;
scene.add( bar02 );

// Render Loop
var render = function () {
  requestAnimationFrame( render );

  cube01.rotation.x += 0.01;
  cube01.rotation.y += 0.012;

  cube01_wireframe.rotation.x += 0.012;
  cube01_wireframe.rotation.y += 0.011;

  cube02.rotation.x -= 0.011;
  cube02.rotation.y -= 0.01;

  cube02_wireframe.rotation.x -= 0.012;
  cube02_wireframe.rotation.y -= 0.013;

  bar01.rotation.z-=0.01;
  bar02.rotation.z+=0.01;

  //Render the scene
  renderer.render(scene, camera);
};

render();
