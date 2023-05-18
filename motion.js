// A widget to help you debug movement

Vue.component("event-log", {
  template: `<div style="flex:1;display:flex;height:140px">
    <div class="log-scroll" style="flex:1;overflow:scroll">
      <div class="log-item" v-for="item in events" style="font-family:sans-serif;font-weight:bold;box-shadow:1px 2px 3px rgba(0,0,0,.4);margin:3px">
        {{item}}
      </div>
    </div>
  </div>`,

  computed: {
    events() {
      return this.log.slice().reverse();
    },
  },

  props: ["log"],
});

Vue.component("widget-devicemovement", {
  template: `
 
  <div class="widget widget-devicemovement" style="width:250px">
    <div>
      <button @click="tracker.startMotionTracking()">MOTION TRACKING</button>
      <button @click="tracker.startGeoTracking()">GEO TRACKING</button>
    </div>
    <div v-if="debug">
      <!-- All the complex visualization stuff -->
    {{joystickMotionControl}}
      <div class="section" v-if="showSliders">
         <table>
          <tr v-for="mvalues,mkey in tracker.motionValues" style="position:relative">
           <div style="position:absolute;top:-9px;font-size:80%;font-family:sans-serif;font-weight:bold" >{{mkey}}</div>
           <td v-for="(v,index) in mvalues">
             <input style="width:70px" v-model="mvalues[index]" type="range" min="-3" max="3"  step=".02" @change="tracker.update()" />
           </td>
          </tr>
        </table>
      </div>

      <div class="section controls"  v-if="showLog">
        <div v-for="item in tracker.log">{{item}}</div>
      </div>

      <div class="section"  v-if="showMap">

        <details>
          <summary>Location: {{tracker.location[0]}}°, {{tracker.location[1]}}°</summary>
          <div id="motionmap" style="width:245px; height: 200px; border: 3px solid grey"></div>
          </details>

      </div>

       <div  v-if="showPhone" style="display:inline-flex;flex-direction:row">
         <!-- dropdown to apply joystick to one of the motion values -->
         <div>
           <select v-model="joystickMotionControl"><option v-for="mvalues,mkey in tracker.motionValues" >{{mkey}}</option></select>
           <div v-if="showJoystick"
             id="joyDiv" 
             style="width:100px;height:100px;margin-bottom:20px;"></div>
        </div>
        <div :style="phoneStyle">PHONE</div>
      </div>


      </div>
    </div>
  </div>`,
  watch: {
    debug() {
      if (this.debug) {
        // Initialize the joystick
        Vue.nextTick(() => {
          this.initializeViz()
        }) 
        
      }
    },
  },
  methods: {
    initializeViz() {
      // Coordinates for the location pin (latitude, longitude)
      const locationPinCoordinates = [13.397634, 52.529198];

      // Create a new OpenLayers Map
      this.tracker.map = new ol.Map({
        target: "motionmap",
        layers: [
          new ol.layer.Tile({
            source: new ol.source.OSM(),
          }),
        ],
        view: new ol.View({
          center: ol.proj.fromLonLat(locationPinCoordinates),
          zoom: 6,
        }),
      });

      // Create a new Feature for the location pin
      this.tracker.locationPinFeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(locationPinCoordinates)),
      });

      // Create a new style for the location pin
      const locationPinStyle = new ol.style.Style({
        image: new ol.style.Icon({
          src: "https://cdn.rawgit.com/openlayers/ol3/3.6.0/examples/data/icon.png",
          anchor: [0.5, 1],
          scale: 0.5,
        }),
      });

      // Set the style for the location pin
      this.tracker.locationPinFeature.setStyle(locationPinStyle);

      // Create a new Vector layer and add the location pin to it
      const locationPinLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
          features: [this.tracker.locationPinFeature],
        }),
      });

      // Add the location pin layer to the map
      this.tracker.map.addLayer(locationPinLayer);

      this.joystick = new JoyStick("joyDiv", {}, (stickData) => {
        // console.log("stick data");
        // Copy over the joystick values

        let m = 0.02;
        let val = [stickData.x * m, stickData.y * m, 0];
        this.tracker.setMotionValue(this.joystickMotionControl, val);
        this.tracker.update();
      });
    },
  },
  computed: {
    phoneStyle() {
      const upVector = this.tracker.motionValues.accelerationIncludingGravity; // Your custom 3D up vector
      // console.log(upVector);
      let transform = upVectorToCSSPerspective(
        upVector,
        (perspectiveDistance = 300)
      );
      // console.log(transform)
      // const rotationMatrix = vectorToMatrix(upVector);
      // const css3DTransform = matrixToCSS3DTransform(rotationMatrix);
      // console.log("CSS 3D Transform:", css3DTransform);

      return {
        transform: transform,
        backgroundColor: "grey",
        margin: "0px 40px",
        width: "70px",
        height: "100px",
      };
    },
  },
  mounted() {
    if (this.debug) {
      this.initializeViz()
    }
  },
  data() {
    return {
      joystickMotionControl: "acceleration",
      showMap: true,
      showSliders: true,
      showPhone: true,
      showJoystick: true,
      showLog: false,
      debug: PARAMS["debug"],
    };
  },
  props: ["tracker"],
});

class MotionTracker {
  constructor() {
    this.log = [];

    this.motionHandlers = [];
    this.activeHandler = undefined;

    this.location = [-87.67493897142913, 42.05221625394806];

    // Motion adapted from
    //yal.cc/js-device-motion/
    this.firstClickFxn = () => {};

    this.previousValues = {
      acceleration: [0, 0, 1],
      accelerationIncludingGravity: [0, 0, 1],
      rotationRate: [0, 0, 0],
    };

    this.motionValues = {
      jerk: [0, 0, 0],
      acceleration: [0, 0, 1],
      accelerationIncludingGravity: [0, 0, 1],
      rotationRate: [0, 0, 0],
    };

    this.rotationMultiplier = 0.07;
  }

  listenForFirstInteraction() {
    // add events for any interaction
    window.addEventListener("click", this.firstClickFxn);
    window.addEventListener("touchend", this.firstClickFxn);
  }

  startTracking() {
    this.startGeoTracking();
    this.startMotionTracking();
  }

  startGeoTracking() {
    // GPT
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          let latitude = position.coords.latitude;
          let longitude = position.coords.longitude;
          console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);
          
          // Add safety offset
          longitude += .001*SAFETY_RADIUS*Math.sin(SAFETY_OFFSET)
          latitude += .001*SAFETY_RADIUS*Math.cos(SAFETY_OFFSET*10 + SAFETY_OFFSET**.2)
          console.log(`Safety-modified Latitude: ${latitude}, Longitude: ${longitude}`);
          
          // Use latitude and longitude values as needed
          this.location = [longitude, latitude];
          
          this.setPinLocation(this.location);
        },
        (error) => {
          console.error("Error getting geolocation:", error);
          // Handle errors accordingly
        },
        {
          enableHighAccuracy: true, // Set to true for more accurate results, if available
          timeout: 10000, // Timeout in milliseconds
          maximumAge: 0, // Maximum age of a cached position, in milliseconds
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      // Handle the case when geolocation is not supported
    }
  }

  setPinLocation(coordinates) {
    console.log("Set new coords", coordinates);
    // Convert the coordinates to the map's projection
    const newLocation = ol.proj.fromLonLat(coordinates);
    console.log("\t loc:", newLocation);

    // Update the location pin feature's geometry
    this.locationPinFeature.getGeometry().setCoordinates(newLocation);

    // Move the map's view to the new location and adjust the zoom level if needed
    this.map.getView().animate({ center: newLocation, zoom: 4 });
  }

  startMotionTracking() {
    this.requestDeviceMotion((err) => {
      this.log.push("request returned", err);
      if (err == null) {
        console.log(
          "MOTION: request for motion tracking granted...\n...but not all devices will create events"
        );
        // Remove the events
        window.removeEventListener("click", this.firstClickFxn);
        window.removeEventListener("touchend", this.firstClickFxn);

        // Subscribe!
        window.addEventListener("devicemotion", (e) => {
          this.setToMotionEvent(e);
        });
      } else {
        // failed; a JS error object is stored in `err`
      }
    });
  }

  requestDeviceMotion(callback) {
    console.log("MOTION: request motion tracking");
    if (window.DeviceMotionEvent == null) {
      callback(new Error("DeviceMotion is not supported."));
    } else if (DeviceMotionEvent.requestPermission) {
      DeviceMotionEvent.requestPermission().then(
        function (state) {
          if (state == "granted") {
            callback(null);
          } else callback(new Error("Permission denied by user"));
        },
        function (err) {
          callback(err);
        }
      );
    } else {
      // no need for permission
      callback(null);
    }
  }

  setToMotionEvent(e) {
    // Set this to a deviceMotion event
    let toArray = (v) => {
      return v.gamma !== undefined
        ? [
            v.alpha * this.rotationMultiplier,
            v.beta * this.rotationMultiplier,
            v.gamma * this.rotationMultiplier,
          ]
        : [v.x, v.y, v.z];
    };

    // Set all the keys (multiply the rotation)
    Object.keys(this.motionValues).forEach((key) => {
      // Do we have a value for this?
      if (e[key] !== undefined) {
        // Store the previous values
        this.previousValues[key] = this.motionValues[key].slice();
        this.motionValues[key] = toArray(e[key]);
      }
    });

    this.update();
  }

  setMotionValue(motionKey, val) {
    let v = this.motionValues[motionKey];
    this.previousValues[motionKey] = v.slice();
    let prev = this.previousValues[motionKey];

    // let loc = this.tracker.motionValues[this.joystickMotionControl];
    // loc[0] = stickData.x * 0.01;
    // loc[1] = stickData.x * 0.01;
    Vue.set(v, 0, val[0]);
    Vue.set(v, 1, val[1]);
    Vue.set(v, 2, val[2]);
  }

  update() {
    this.updateJerk();
    this.checkHandlers();
  }

  updateJerk() {
    // Jerk comes from acceleration
    let jerk = [0, 0, 0];
    let prev = this.previousValues.acceleration;
    let v = this.motionValues.acceleration;
    setToMultiples(jerk, v, 3, prev, -3);
    this.setMotionValue("jerk", jerk);
  }

  checkHandlers() {
    // Check if we wanna reset one
    if (this.activeHandler) {
      let v = this.motionValues[this.activeHandler.key];
      let m = getMagnitude(v);

      // reset active handler if it is not longer high enough
      let timeSince = Date.now() - this.activeHandler.startTime;
      let resetTime = this.activeHandler.resetTime || 500;
      if (m < this.activeHandler.endValue && timeSince > resetTime) {
        console.log(
          `RESET ${this.activeHandler.name}, ${this.activeHandler.key} below ${
            this.activeHandler.endValue
          } (${m.toFixed(2)})`
        );
        this.activeHandler.onEnd?.(v, m);
        this.activeHandler.startTime = undefined;
        this.activeHandler = undefined;
      }
    }

    if (!this.activeHandler) {
      // Test if any motion handlers should apply
      this.motionHandlers.forEach((handler) => {
        let v = this.motionValues[handler.key];
        let m = getMagnitude(v);

        // Is this above the threshhold, and do we have an active listener?
        // console.log(motionKey, m);
        // Activate this?
        if (m > handler.startValue) {
          console.log(
            `START ${handler.name}, ${handler.key} above ${
              handler.endValue
            } (${m.toFixed(2)})`
          );
          this.activeHandler = handler;
          handler.onStart(v, m);
          handler.startTime = Date.now();
        }
      });
    }
  }

  onHighValue(settings) {
    this.motionHandlers.push(settings);
  }
}

// CHATGPT: write a JS function to turn an up vector (array of 3 floats) into a CSS style with perspective, assume Z is up
function upVectorToCSSPerspective(zVector, perspectiveDistance = 1000) {
  // Normalize the Z vector
  const zLength = Math.sqrt(
    zVector[0] * zVector[0] + zVector[1] * zVector[1] + zVector[2] * zVector[2]
  );
  const z = zVector.map((val) => val / zLength);

  // Calculate the X vector (right direction)
  let x;
  if (Math.abs(z[0]) < 0.9) {
    x = [1, 0, 0];
  } else {
    x = [0, 1, 0];
  }
  const dot = z[0] * x[0] + z[1] * x[1] + z[2] * x[2];
  x = x.map((val, i) => val - dot * z[i]);
  const xLength = Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
  x = x.map((val) => val / xLength);

  // Calculate the Y vector (up direction) using cross product
  const y = [
    z[1] * x[2] - z[2] * x[1],
    z[2] * x[0] - z[0] * x[2],
    z[0] * x[1] - z[1] * x[0],
  ];

  // Create a CSS 3D transform matrix from the calculated coordinate system
  const matrix = [
    x[0],
    x[1],
    x[2],
    0,
    y[0],
    y[1],
    y[2],
    0,
    z[0],
    z[1],
    z[2],
    0,
    0,
    0,
    0,
    1,
  ];

  return `perspective(${perspectiveDistance}px) matrix3d(${matrix.join(",")})`;
}

function getMagnitude(v) {
  let m = 0;
  for (var i = 0; i < 3; i++) {
    m += v[i] ** 2;
  }

  return Math.sqrt(m);
}

function setToMultiples(v, v0, m0, v1, m1) {
  for (var i = 0; i < 3; i++) {
    v[i] = v0[i] * m0 + v1[i] * m1;
  }
  return v;
}

function vectorToString(v) {
  return "(" + v.map((x) => x.toFixed(2)).join(",") + ")";
}


// FROM chatGPT
// Function to calculate distance between two coordinates in meters
function getDistanceBetweenCoordinates(coord1, coord2) {
// Create a LineString connecting the two coordinates
//   const lineString = new ol.geom.LineString([coord1, coord2]);

// // Calculate the geodesic distance (great-circle distance) between the two points
//   const coordinates = lineString.getCoordinates();
//   const length = coordinates.length;
//   let distance = 0;

//   for (let i = 0; i < length - 1; i++) {
//     const start = ol.proj.transform(coordinates[i], 'EPSG:4326', 'EPSG:3857');
//     const end = ol.proj.transform(coordinates[i + 1], 'EPSG:4326', 'EPSG:3857');
//     const segment = new ol.geom.LineString([start, end]);
//     distance += segment.getLength();
//   }
  
  let d = ol.sphere.getDistance(coord1, coord2)
  
  return d;
}


function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}