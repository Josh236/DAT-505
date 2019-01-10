/// seed perlin/simplex noise
noise.seed(Math.random());

/// stats
var stats = new Stats();
stats.showPanel( 1 ); // 0: fps, 1: ms, 2: mb, 3+: custom
// document.body.appendChild( stats.dom );

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.9, 10000);
camera.position.y = 0.3;
camera.position.z = 2;

// scene.fog = new THREE.Fog(0x000000, 800, 1200);

var renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

var controls = new THREE.OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;
controls.enableKeys = false;

var ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

var directionalLight = new THREE.DirectionalLight( 0xffffff, 1.0 );
directionalLight.position.set( 3, 3, 3 );
scene.add(directionalLight);

var directionalLight2 = new THREE.DirectionalLight( 0xffffff, 0.5 );
directionalLight2.position.set( -3, 10, 5 );
scene.add(directionalLight2);


/// ground
// var groundWidth = 100;
// var groundHeight = 100;
// var groundGeo = new THREE.PlaneGeometry(groundWidth*5, groundHeight*5);
// var groundMat = new THREE.MeshPhongMaterial({color:0x333333, side:THREE.DoubleSide});
// var ground = new THREE.Mesh(groundGeo, groundMat);
var ground = new THREE.Object3D();
ground.rotation.x = Math.PI/2;
// ground.position.y = -3;
scene.add(ground);


var landGeo = new THREE.PlaneGeometry(2500, 2500);
var landMat = new THREE.MeshPhongMaterial({color:0x222222, side:THREE.DoubleSide});
var land = new THREE.Mesh(landGeo, landMat);
ground.add(land);


/// camera target
var cameraTarget = new THREE.Object3D();
scene.add(cameraTarget);
cameraTarget.position.y = 200;
cameraTarget.rotateY(Math.PI/4);
cameraTarget.add(camera);

/// ship
var ship = new THREE.Object3D();
ship.scale.x = 10;
ship.scale.y = 10;
ship.scale.z = 10;
cameraTarget.add(ship);
var shipMat = new THREE.MeshPhongMaterial({color:0x999999, shading:THREE.FlatShading});

// var hullGeo = new THREE.BoxGeometry(0.01, 0.01, 0.1);
var hullGeo = new THREE.IcosahedronGeometry(0.1, 0);
var hull = new THREE.Mesh(hullGeo, shipMat);
hull.scale.z = 1;
hull.scale.x = 0.1;
hull.scale.y = 0.1;
ship.add(hull);

var hull2 = new THREE.Mesh(hullGeo, shipMat);
hull2.scale.z = 0.5;
hull2.scale.x = 0.1;
hull2.scale.y = 0.12;
hull2.position.z = 0.035;
// hull2.position.y = 0.0015;
ship.add(hull2);

var wingGeo = new THREE.IcosahedronGeometry(0.1, 0);
var wing = new THREE.Mesh(wingGeo, shipMat);
wing.position.z = 0.05;
wing.scale.z = 0.15;
wing.scale.x = 0.7;
wing.scale.y = 0.02;
wing.rotation.z = 0.3;
ship.add(wing);

var wing2 = new THREE.Mesh(wingGeo, shipMat);
wing2.position.z = 0.05;
wing2.scale.z = 0.15;
wing2.scale.x = 0.7;
wing2.scale.y = 0.02;
wing2.rotation.z = -0.3;
ship.add(wing2);


/// camera target motion
var isAccel = false;
var isDecel = false;
var isRollRight = false;
var isRollLeft = false;
var isPitchUp = false;
var isPitchDown = false;
var isYawLeft = false;
var isYawRight = false;

var speed = 1;
var pitchVel = 0;
var rollVel = 0;
var yawVel = 0;
var isPaused = false;
var shouldCaptureScreenshot = false;


/// buildings material
var BUILDING_MAT = new THREE.MeshPhongMaterial({color: 0xffffff, vertexColors: THREE.VertexColors});
BUILDING_MAT.side = THREE.DoubleSide;
BUILDING_MAT.shading = THREE.FlatShading;


/// setup building grid
var cellSize = 60;
var gridSize = 40;
var allBuildings = [];
var count = 0;

for (var i=0; i<gridSize; i++) {
	for (var j=0; j<gridSize; j++) {
    var building = new Building(i*cellSize, j*cellSize, false);
    allBuildings[count] = building;
    if (!building.isStreet) {
        ground.add(building.object);
    }
    count++;
	}
}


cameraTarget.position.x = cellSize * gridSize * 0.5;
cameraTarget.position.z = cellSize * gridSize * 0.5;

function updateGrid() {
    var building, dx, dy, newX, newY, buffer;
    buffer = cellSize*gridSize/2;

	for (var i=0; i<allBuildings.length; i++) {
    building = allBuildings[i];

    if (!building.isDead) {
        dy = building.y - cameraTarget.position.z;
        dx = building.x - cameraTarget.position.x;
        newX = building.x;
        newY = building.y;

        if (dx > buffer) {
            newX -= buffer*2;
            building.isDead = true;
        }
        else if (dx < -buffer) {
            newX += buffer*2;
            building.isDead = true;
        }

        if (dy > buffer) {
            newY -= buffer*2;
            building.isDead = true;
        }
        else if(dy < -buffer) {
            newY += buffer*2;
            building.isDead = true;
        }

        if (building.isDead) {
            // ground.remove(building.object);
            setTimeout(addNewBuilding.bind(this, newX, newY, i), Math.random() * 200);
        }
    }
	}
}

var addNewBuilding = function(x, y, index) {
    var building = allBuildings[index];
    ground.remove(building.object);
    building.destroy();
    allBuildings[index] = null;

    var newBuilding = new Building(x, y, false);
    allBuildings[index] = newBuilding;

    if (!newBuilding.isStreet) {
        ground.add(newBuilding.object);
    }
}

/// flight

function updateFlight() {
	var maxSpeed = 3.0;
	var minSpeed = 0.5;
	var accel = 0.03;

	if (isAccel) {
    speed += accel;
    ship.position.z += (-0.6 - ship.position.z) * 0.1;
  }
	else if (isDecel) {
    speed += -accel;
    ship.position.z += (0.1 - ship.position.z) * 0.05;
  }
  else {
    ship.position.z += (0 - ship.position.z) * 0.05;
  }

	if (speed > maxSpeed) speed = maxSpeed;
	if (speed < minSpeed) speed = minSpeed;

	// speed *= 0.95;
	cameraTarget.translateZ(-speed);
	// camera.position.z = speed * 0.5 + 1.5;
  camera.fov = 60 + speed * 12;
  camera.up = new THREE.Vector3(0,1,0);
  camera.lookAt(new THREE.Vector3(0,0,0));
  camera.updateProjectionMatrix();

	var pitchAccel = 0.001;
	if (isPitchUp) pitchVel += pitchAccel;
	if (isPitchDown) pitchVel += -pitchAccel;
	pitchVel *= 0.95;
	cameraTarget.rotateX(pitchVel);
	ship.rotation.x += ((pitchVel * 20) - ship.rotation.x) * 0.9;
    // camera.position.y = pitchVel * 5;

	var rollAccel = 0.002;
	if (isRollRight) rollVel += -rollAccel;
	if (isRollLeft) rollVel += rollAccel;
	rollVel *= 0.95;
	cameraTarget.rotateZ(rollVel);
	ship.rotation.z = rollVel * 20;

	var yawAccel = 0.001;
	if (isYawRight) yawVel += -yawAccel;
	if (isYawLeft) yawVel += yawAccel;
	yawVel *= 0.95;
	cameraTarget.rotateY(yawVel);
	ship.rotation.y = yawVel * 20;
    // camera.position.x = yawVel * 60;
}


function render() {
  stats.begin();

	requestAnimationFrame(render);
  controls.update();
  update();
  renderer.render(scene, camera);

  if (shouldCaptureScreenshot == true){
      takeScreenshot();
      shouldCaptureScreenshot = false;
  }

  stats.end();
}
render();

function update() {
	if (!isPaused) updateFlight();
	updateGrid();
	land.position.x = cameraTarget.position.x;
  land.position.y = cameraTarget.position.z;
}

function takeScreenshot() {
  var w = window.open('', '');
  w.document.title = "screenshot";
  w.document.body.style.backgroundColor = "black";
  w.document.body.style.margin = "0px";

  var img = new Image();
  img.src = renderer.domElement.toDataURL();
  img.width = window.innerWidth;
  img.height = window.innerHeight;
  w.document.body.appendChild(img);
}

window.addEventListener('resize', function()
{
	var WIDTH = window.innerWidth,
	HEIGHT = window.innerHeight;
	renderer.setSize(WIDTH, HEIGHT);
	camera.aspect = WIDTH / HEIGHT;
	camera.updateProjectionMatrix();
});

document.onkeydown = function(e) {
    e = e || window.event;

    console.log(e.keyCode);
    if (e.keyCode == '72') {
      var brandTag = document.getElementById("brandTag");
      var keyControls = document.getElementById("controls");
      if (brandTag.style.visibility == "hidden") {
        brandTag.style.visibility = "visible";
        keyControls.style.visibility = "visible";
      } else {
        brandTag.style.visibility = "hidden";
        keyControls.style.visibility = "hidden";
      }
    }

    if (e.keyCode == '32') {
      isPaused = !isPaused;
    }

    if (e.keyCode == '67') {
      shouldCaptureScreenshot = true;
    }

    if (e.keyCode == '82') {
      controls.reset();
    }

    if (e.keyCode == '87') // w
    {
    	isAccel = true;
    }
    if (e.keyCode == '83') // s
    {
    	isDecel = true;
    }
    if (e.keyCode == '65') // a
    {
    	isYawLeft = true;
    }
    if (e.keyCode == '68') // d
    {
    	isYawRight = true;
    }

    if (e.keyCode == '38') // up
    {
    	isPitchDown = true;
    }
    if (e.keyCode == '40') // down
    {
    	isPitchUp = true;
    }
    if (e.keyCode == '37') // left
    {
    	isRollLeft = true;
    }
    if (e.keyCode == '39') // right
    {
    	isRollRight = true;
    }
}

document.onkeyup = function(e)
{
    e = e || window.event;

    // console.log(e.keyCode);

    if (e.keyCode == '87') // w
    {
    	isAccel = false;
    }
    if (e.keyCode == '83') // s
    {
    	isDecel = false;
    }
    if (e.keyCode == '65') // a
    {
    	isYawLeft = false;
    }
    if (e.keyCode == '68') // d
    {
    	isYawRight = false;
    }

    if (e.keyCode == '38') // up
    {
    	isPitchDown = false;
    }
    if (e.keyCode == '40') // down
    {
    	isPitchUp = false;
    }
    if (e.keyCode == '37') // left
    {
    	isRollLeft = false;
    }
    if (e.keyCode == '39') // right
    {
    	isRollRight = false;
    }
}
