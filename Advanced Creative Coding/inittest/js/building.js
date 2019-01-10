function Building(xPos, yPos)
{
	/// create holder for building
	self = this;

	self.x = xPos;
	self.y = yPos;
	self.isStreet = false;

	self.object = new THREE.Object3D();
	self.object.position.x = self.x;
	self.object.position.y = self.y;
	self.object.position.z = -0.1;
	// self.object.position.z = (noise.simplex2(xPos * 0.0005, yPos * 0.0005) + 1) / 2 * -80;
	// self.object.position.z /= (noise.simplex2(xPos * 0.0001, yPos * 0.0001) + 1) / 2 * 1;

	/// for testing purposes\
	// var cubeGeo = new THREE.BoxGeometry(1, 1, 1);
	// var cubeMat = new THREE.MeshPhongMaterial({color: 0x00ffff});
	// var cube = new THREE.Mesh(cubeGeo, cubeMat);
	// self.object.add(cube);


 	self.setFaceColor = function(geo, color)
	{
		for ( var i = 0; i < geo.faces.length; i ++ )
		{
				var f  = geo.faces[ i ];
				for( var k = 0; k < 3; k++ )
				{
					f.vertexColors[ k ] = color;
				}
		}
	}




	var hue = (noise.simplex2(xPos * 0.0005, yPos * 0.0005) + 1) / 2;
	hue = hue + Math.random()*0.2;
	var saturation = Math.random()*0.5+0.5;
	// saturation = 1;

	// self.geometry = new THREE.BoxGeometry(100, 100, 1);
	self.geometry = new THREE.CylinderGeometry(80, 80, 1, 8 );
	self.geometry.rotateX(Math.PI/2);
	// self.geometry.rotateZ(Math.PI/4);
	self.geometry.rotateZ(Math.random(Math.PI));
	// self.geometry.translate(0, 0, 150);
	self.setFaceColor(self.geometry, new THREE.Color().setHSL(0.0, 0.0, 0.1));
	self.bufferGeometry;
	self.isDead = false;

	var numParts = Math.round(Math.random()*5+5);
	var partCount = 0;
	// numParts = 30;

	var minWidth = 0.01;
	var maxWidth = Math.random() * 5 + 40;

	// minWidth = 0.01;
	// maxWidth = 10;

	// maxWidth = 10;
	var offsetRange = maxWidth * (Math.random() * 0.7 + 0.2) * 1.5;
	var minHeight = 10;
	var maxHeightMod = (noise.simplex2(xPos * 0.0012, yPos * 0.0012) + 1) / 2;
	maxHeightMod *= (noise.simplex2(xPos * 0.013, yPos * 0.013) + 1) / 2;
	maxHeightMod /= (noise.simplex2(xPos * 0.0003, yPos * 0.0003) + 1) / 2;
	// console.log(maxHeightMod);
	var maxHeight = minHeight + maxHeightMod * 150;

	// minHeight = 1;
	// maxHeight = 5;

	var slopeIntensity = Math.random();
	var spikeIntensity = Math.random();
	if (Math.random() > 0.5) spikeIntensity = 0;

	var symmetryType = Math.floor(Math.random()*2.5);

	self.shiftLeftEdge = function(geo, amount)
	{
		geo.vertices[6].x += amount;
		geo.vertices[4].x += amount;
	}

	self.shiftRightEdge = function(geo, amount)
	{
		geo.vertices[1].x += amount;
		geo.vertices[3].x += amount;
	}

	self.shiftNearEdge = function(geo, amount)
	{
		geo.vertices[1].y += amount;
		geo.vertices[4].y += amount;
	}

	self.shiftFarEdge = function(geo, amount)
	{
		geo.vertices[6].y += amount;
		geo.vertices[3].y += amount;
	}

	self.slopeEdge = function(geo, edge, amount)
	{
		var edges = [[6, 4], [1, 4], [1, 3], [6, 3]];
		geo.vertices[edges[edge][0]].z += amount;
		geo.vertices[edges[edge][1]].z += amount;
	}



	self.createPart = function()
	{
		var width = Math.random() * (maxWidth-minWidth) + minWidth;
		var depth = width;
		if (Math.random()>0.8) depth = Math.random() * (maxWidth-minWidth) + minWidth;
		var heightMod = Math.pow(Math.random(), 1);
		var height = heightMod * (maxHeight-minHeight) + minHeight;

		var X = Math.random() * offsetRange - offsetRange/2;
		var Y = Math.random() * offsetRange - offsetRange/2;
		var Z = -height/2;

		// console.log(offsetRange + " " + X + " " + Y + " " + Z);

		// if (isSymmetric && j>2) z -= Math.random()*maxHeight*0.5;

		var lightness = Math.random() * 0.3 + 0.2;
		var saturation = Math.random()*0.5+0.5;
		var color = new THREE.Color().setHSL(hue + Math.random()*0.0, saturation, lightness);


		var partGeo = new THREE.BoxGeometry(width, depth, height);

		/// shift top edges in a random amount
		var rightShift = -Math.random() * width/2 * slopeIntensity;
		var leftShift = Math.random() * width/2 * slopeIntensity;
		var farShift = Math.random() * width/2 * slopeIntensity;
		var nearShift = -Math.random() * width/2 * slopeIntensity;

		var slopeEdge = Math.floor(Math.random()*4);
		var slopeMod = height * 0.5;
		var slopeAmount = Math.random() * slopeMod - slopeMod*0.5;
		// slopeAmount = 1;
		if (Math.random() > 0.2) slopeAmount = 0;

		self.shiftLeftEdge(partGeo, leftShift);
		self.shiftRightEdge(partGeo, rightShift);
		self.shiftNearEdge(partGeo, nearShift);
		self.shiftFarEdge(partGeo, farShift);

		self.slopeEdge(partGeo, slopeEdge, slopeAmount);

		/// add per-face color
		self.setFaceColor(partGeo, color);

		var rot = Math.random(Math.PI*0.001);

		// if (isSymmetric) partGeo.rotateZ(rot);
		partGeo.translate(X, Y, Z);
		self.geometry.merge(partGeo);
		partGeo.dispose();

		if (symmetryType > 0)
		{
			var partGeo2 = new THREE.Geometry();
			partGeo2.merge(partGeo);
			self.reflectGeo(partGeo2, true, false);
			self.geometry.merge(partGeo2);
			partGeo2.dispose();

			if (symmetryType > 1)
			{
				var partGeo3 = new THREE.Geometry();
				partGeo3.merge(partGeo);
				self.reflectGeo(partGeo3, false, true);
				self.geometry.merge(partGeo3);
				partGeo3.dispose();

				var partGeo4 = new THREE.Geometry();
				partGeo4.merge(partGeo);
				self.reflectGeo(partGeo4, true, true);
				self.geometry.merge(partGeo4);
				partGeo4.dispose();

			}
		}

		partCount++;
		if (partCount == numParts) self.createMesh();
	}

	self.reflectGeo = function(geo, reflectX, reflectY)
	{
		for (var i = 0; i < geo.vertices.length; i++)
			{
			    var v = geo.vertices[i];
			    if (reflectX) v.x *= -1;
			    if (reflectY) v.y *= -1;
			}
	}

	self.createMesh = function()
	{
		self.bufferGeometry = new THREE.BufferGeometry().fromGeometry(self.geometry);
		self.mesh = new THREE.Mesh(self.bufferGeometry, BUILDING_MAT);
		self.mesh.updateMatrix();
		self.mesh.position.x = 0;
		self.mesh.position.y = 0;
		self.mesh.position.z = 0;
		self.object.add(self.mesh);

		self.object.position.x = self.x;
		self.object.position.y = self.y;

		self.object.scale.x = 0;
		self.object.scale.y = 0;
		self.object.scale.z = 0;

		// var rot = Math.random(Math.PI*0.001);
		// self.object.rotateZ(rot);

		var rotSnap = Math.floor(Math.random()*4);
		var rot = rotSnap * Math.PI*0.5;
		self.object.rotateZ(rot);

		TweenLite.to(self.object.scale, 1, {x:1, y:1, z:1, ease:Sine.easeOut, delay:0});
	}

	self.generateGeometry = function()
	{
		for (var i=0; i<numParts; i++)
		{
			self.createPart();
		}
	}


	// figure out if this cell should be a building or a road

	var roadNoise = (noise.simplex2(xPos * 0.0015, yPos * 0.0015) + 1) / 2;
	var roadRange = 0.4;

	if (roadNoise < 0.5-roadRange/2 || roadNoise > 0.5+roadRange/2)
	{
		self.generateGeometry();
	}
	else
	{
		self.isStreet = true;
		// self.geometry = new THREE.Geometry();
		self.setFaceColor(self.geometry, new THREE.Color().setHSL(hue, 0.0, 0.1));
		self.createMesh();
	}


	// self.generateGeometry();

	self.destroy = function()
	{
		self.geometry.dispose();
		self.bufferGeometry.dispose();
	}
}
