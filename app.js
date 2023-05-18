//==============================================
// Query parameters, useful for adding in variables based on a url
// https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
const PARAMS = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});

let USER_ID = Math.floor(Math.random()*1000000)
let SAFETY_OFFSET = Math.floor(Math.random()*1000000)

let SAFETY_RADIUS = 10
if (PARAMS["radius"] !== null)
  SAFETY_RADIUS = parseInt(PARAMS["radius"])

//==============================================

// event handler
document.addEventListener("DOMContentLoaded", function () {
  
//   preload(p) {

//     this.swordHitSound = p.loadSound(
//       "file://https://cdn.glitch.global/2ef28a8b-052e-4dd5-8e34-59dec65b3d27/buzzer-or-wrong-answer-20582.mp3?v=1683921427675"
//     );
//   },

  function playSound() {
  var sound = new Audio('https://cdn.glitch.global/2ef28a8b-052e-4dd5-8e34-59dec65b3d27/mixkit-apartment-buzzer-bell-press-932.wav?v=1684194018624'); // Replace 'path/to/sound.mp3' with the actual path to your sound file
  sound.play();
}
    
  let audio = new Audio();
  audio.addEventListener("canplaythrough", () => {
          audio.play();
        });
  
  // Create Vue instance
  new Vue({
    template: `
    
    <div id="app" v-bind:style="{ backgroundColor: color}">

      <div class="debug">
        <widget-devicemovement :tracker="motionTracker" />
      </div>

      <h1 style=font-size:100px>PhoneSlapper 📱👋</h1>

      <hr>
      <h1>
        The goal of this game is to hold your own phone steady while slapping your friends'
        If an acceleration over a certain threshold is sensed on your phone, you'll be out.
      </h1>
      <hr>

      Wecome to phone slapper!

      Each round lasts 30 seconds
      
      <h1 style=font-size:80px>Game ends in: {{timer_reset}}</h1>
      
      <hr>

      <h2>Event log</h2>
      <div id="event-log">
        <div v-for="event in eventsToDisplay">
          {{event}}
          <hr>
        </div>
      </div>

    </div>
    
    `,

    computed: {
      // Event log
      eventsToDisplay() {
        return this.events.slice(-5).reverse();
      },
  
      // Countdown
      timer_reset() {
        let countdown = 30 - (this.timer % 31)
        if (countdown == 0) {
          this.color = '#C1E1C1' // Reset screen color
          document.body.style.backgroundColor = '#C1E1C1';
          this.events.push("New round started!"); // Log to events
          return "Game over!"
        }
        return 30 - (this.timer % 31);
      },
    },

    watch: {
    },

    methods: {
    },

      
    mounted() {
      // Request motion access
      this.motionTracker.startMotionTracking()
      
      // Make background green
      document.body.style.backgroundColor = "#C1E1C1";
      
      // Use the motion tracker to watch for bumps
      this.motionTracker.onHighValue({
        name: "bump",
        key: "acceleration", // Watch acceleration
        // When to start
        startValue: 30, // High value to make sure it has to be hit hard
        onStart: (v, m) => {
          // Log to events
          if (this.color != "#FAA0A0") {
            this.events.push("Phone was bumped! You're out.");
            playSound();
          }
          // If bump detected, make screen red, play sound, log
          this.color = "#FAA0A0" // Make screen red
          document.body.style.backgroundColor = "#FAA0A0";
          
          // Play sound from https://pixabay.com/sound-effects/search/buzzer/
          
          const audio = new Audio('file://https://cdn.glitch.global/2ef28a8b-052e-4dd5-8e34-59dec65b3d27/buzzer-or-wrong-answer-20582.mp3?v=1683921427675');
          audio.play();
        },
        // When to end
        endValue: 1,
        onEnd: (v, m) => {
          // Do nothing at end of bump
        },
      });
      
      
      // Runs every 100 frames
      setInterval(() => {
        this.timer = Math.trunc(new Date().getTime() / 1000);
      }, 100);
    },

    data() {
      return {
        // Timer counter
        timer: 0,
        
        // A tool to track motion
        motionTracker: new MotionTracker(),
        
        color: '#C1E1C1',

        // Events list
        events: ["Please enable the motion tracking on your phone and wait for the next round to begin",
                "Welcome to phone slapper!"],
      };
    },

    el: "#app",
  });
});
