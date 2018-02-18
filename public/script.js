
	/*
	 *******************************************************************
	 * Objects
	 *******************************************************************
	 */
	
	// Represents a single Frame
	function Frame(second, canvas, reset, image) {
		this.second = second;
		this.canvas = canvas;
		this.reset = reset;
		this.image = image;
	}
	
	Frame.prototype.older = function(frame) {
		if (this.second <= frame.second) {
			return this;
		} else {
			return frame;
		}
	}
	
	Frame.prototype.younger = function(frame) {
		if (this.second > frame.second) {
			return this;
		} else {
			return frame;
		}
	}
	
	// Returns a textual representation of a frame.
	Frame.prototype.asText = function() {
		var h = Math.floor(this.second / 3600);
		var m = Math.floor(this.second % 3600 / 60);
		var s = Math.floor(this.second % 3600 % 60);

		var hms = h > 9 ? "" + h + ":" : "0" + h + ":";
		hms += m > 9 ? "" + m + ":" : "0" + m + ":";
		hms += s > 9 ? "" + s : "0" + s;
				
		return hms;
	}
	
	// Represents a segment that contains two frames
	function Segment(startFrame, endFrame) {
		this.id = -1;
		this.startFrame = startFrame;
		this.endFrame = endFrame;
		this.description = '';
	}
	
	// Returns a textual representation of a segment.
	Segment.prototype.asText = function() {
		return '-ss ' + this.startFrame.asText() + 
			   ' -to ' + this.endFrame.asText() + 
			   ' -txt ' + this.description + ';';
	}
	
	/*
	 *******************************************************************
	 * Attributes
	 *******************************************************************
	 */
	
	var reader;
	var video;

    var SelectedFile;
    var socket = io.connect('http://localhost:8080');
    var Path = "http://localhost/";

	
	// used to identify segments -> every segment is assigned such an id
	var segment_id = 0;
	
	// used for storing selected frames temporarily
	var saved_frames = [];
	// used for storing segments
	var segments = [];
	// marks the frame being visible momentarily
	var actual_frame;
	
	// used to draw frames
	var canvas;
	// range slider used for switching between frames
	var time_slider;
	// switch to frame corresponding to current time - 1 s
	var previous_frame;
	// switch to frame corresponding to current time + 1 s
	var next_frame;
	// used to collect and show segments
	var container;
	
	/*
	 *******************************************************************
	 * Initialization
	 *******************************************************************
	 */
	
	// Initializes main variables and functions
	function init() 
    {
		
		// initialize variables
		video = document.getElementById("video1");
		canvas = document.getElementById("canvas");
		time_slider = document.getElementById("time_slider");
		previous_frame = document.getElementById("previousFrame");
		next_frame = document.getElementById("nextFrame");
		container = document.getElementById("container");
		container = document.getElementById("container");
		
        //initialize events
		canvas.addEventListener("click", saveFrame, false);
		time_slider.addEventListener("change", updateFrame, false);
		time_slider.addEventListener("input", updateFrame, false);
		
		document.getElementById('files').addEventListener('change', FileChosen);
		document.getElementById('UploadButton').addEventListener('click', StartUpload); 
		
		previous_frame.addEventListener('click', 
		function() {
			if (actual_frame === null) {
				return;
			}
			if (isUndefined(actual_frame)) {
				return;
			}
			if (actual_frame.second <= 0) {
				return;
			}
			var value = Math.floor((actual_frame.second - 1) * 100 / video.duration);
			if (value >= 0 && value <= 100) {
				actual_frame.second--;
				time_slider.value = value;
				drawFrame(actual_frame);
			}
		},
		false);
		
		next_frame.addEventListener('click', 
		function() {
			if (actual_frame === null) {
				return;
			}
			if (video === null) {
				return;
			}
			if (isUndefined(actual_frame) || isUndefined(video) || isUndefined(video.duration)) {
				return;
			}
			if (actual_frame.second >= video.duration) {
				return;
			}
			var value = Math.floor((actual_frame.second + 1) * 100 / video.duration);
			if (value >= 0 && value <= 100) {
				actual_frame.second++;
				time_slider.value = value;
				drawFrame(actual_frame);
			}
		},
		false);
		
		document.getElementById('submit').addEventListener('click', 
		function() {
			updateDescriptions();
			var result = combineSegments();
			// send result to server!
		},
		false);
		
		// initialize player
		initPlayer();
	
	}

    function FileChosen(evnt) 
    {
        SelectedFile = evnt.target.files[0];
    }

    function StartUpload()
    {
        if(document.getElementById('files').value != "")
        {
            reader = new FileReader();
            var Name = SelectedFile.name;
            var Content = "<span id='NameArea'>Uploading " + SelectedFile.name + "</span>";
            Content += '<div id="ProgressContainer"><div id="ProgressBar"></div></div><span id="percent">0%</span>';
            Content += "<span id='Uploaded'> - <span id='MB'>0</span>/" + Math.round(SelectedFile.size / 1048576) + "MB</span>";
            document.getElementById('UploadArea').innerHTML = Content;
            reader.onload = function(evnt){
                socket.emit('Upload', { 'Name' : SelectedFile.name, Data : evnt.target.result });
            }
            socket.emit('Start', { 'Name' : SelectedFile.name, 'Size' : SelectedFile.size });
        }
        else
        {
            alert("Please Select A File");
        }
    }

    socket.on('MoreData', function (data){
        UpdateBar(data['Percent']);
        var Place = data['Place'] * 524288; //The Next Blocks Starting Position
        var NewFile; //The Variable that will hold the new Block of Data
        NewFile = SelectedFile.slice(Place, Place + Math.min(524288, (SelectedFile.size-Place)));
        reader.readAsBinaryString(NewFile);
    });
 
    function UpdateBar(percent){
        document.getElementById('ProgressBar').style.width = percent + '%';
        document.getElementById('percent').innerHTML = (Math.round(percent*100)/100) + '%';
        var MBDone = Math.round(((percent/100.0) * SelectedFile.size) / 1048576);
        document.getElementById('MB').innerHTML = MBDone;
    }
 
    socket.on('Done', function (data){
        var Content = "Video Successfully Uploaded!"
        Content += "<button  type='button' name='Upload' value='' id='Restart' class='Button'>Upload Another</button>";
        document.getElementById('UploadArea').innerHTML = Content;
        document.getElementById('Restart').addEventListener('click', Refresh);
        video.src = SelectedFile.name;
    });

    function Refresh(){
        location.reload(true);
    }

	// Adds additional behavior such as error handling, meta data loading and seeking functions to the video element.
	function initPlayer() {
		
		// shows additional information in case of an error
		video.addEventListener("error", function(e) {
			alter("An error has occured.");
		},
		false);
		
		// seeked event is being called after call to drawFrame, or rather currentTime = x 
		// has finished -> this is where drawing frame according to time x is taking place
		video.addEventListener("seeked", 
		function() {
			drawFrameOnCanvas(actual_frame);
		}, 
		false);
		
		// enables the time slider when duration of whole 
		// video is known
		video.addEventListener("loadedmetadata", 
		function() {
			time_slider.disabled = false;
			previous_frame.disabled = false;
			next_frame.disabled = false;
		},
		false);
		
	}
	
	// make sure that all of the html is loaded, before we start referencing them
	// in order to prevent errors
	window.onload = init;
	
	/*
	 *******************************************************************
	 * Segments
	 *******************************************************************
	 */
	
	// Initiates drawing of a certain frame by setting associated time value of the video
	function drawFrame(frame) {
		video.currentTime = (frame.second > video.duration ? video.duration : frame.second);
	}
	
	// Draws a frame of the current video according to its time in seconds into its canvas. 
	// If frame.reset is true, the surface of the canvas is being cleared.
	function drawFrameOnCanvas(frame) {
	
		var canvas = frame.canvas;
		var reset = frame.reset;
	
		// retrieve context for drawing
		var context = canvas.getContext("2d");
				
		// Start by clearing the canvas
		context.clearRect(0, 0, canvas.width, canvas.height);
		
		// draw frame according to time
		
		if (reset) {
			return;
		}
		
		context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
    }
	
	// Takes percentage value of the time slider, converts it into corresponding 
	// time value of the video and initiates drawing of the respective frame.
	function updateFrame() {
		var value = time_slider.value;
		
		if (isNull(video)) {
			return;
		}
		if (isUndefined(video)) {
			return;
		}
		if (isUndefined(video.duration)) {
			return;
		}
		
		var second = Math.floor(value * video.duration / 100);
		actual_frame = new Frame(second, canvas, false, null);
		drawFrame(actual_frame);
	}
	
	function isUndefined(object) {
		return object === undefined;
	}
	
	function isNull(object) {
		return object === null;
	}

    // "Grabs" the visible frame and adds it to "saved_frames" collection. 
    // If "saved_frames" contains at least two frames, a new segment is created 
    // and saved. After creation of a segment, its frames are being removed 
    // from "saved_frames" collection.
    function saveFrame() {
		
		if(isUndefined(actual_frame)) {
			return;
		}
		
		var img = new Image();
		img.src = actual_frame.canvas.toDataURL();
		var frame = new Frame(actual_frame.second, null, false, img);
		saved_frames.push(frame);
		if (saved_frames.length > 0 && saved_frames.length % 2 == 0) {
			var frame1 = saved_frames.shift();
			var frame2 = saved_frames.shift();
			var first = frame1.older(frame2);
			var second = frame1.younger(frame2);
			var segment = new Segment(first, second);
			segments.push(segment);
			segment.id = segment_id++;
			repaintSegments();
		}
	}
	
	/*
	 *******************************************************************
	 * Helper functions
	 *******************************************************************
	 */
	 
	// Returns the segment having id equal to parameter 
	// id or null, if no such segment exists.
	function getSegmentById(id) {
		var segment = null;
		for (var j = 0; j < segments.length; j++) {
			if (segments[j].id == id) {
				segment = segments[j];
				break;
			}
		}
		return segment;
	}
	
	// Repaints the list of segments in order 
	// to reflect visual changes of the segment(s) such as 
	// changes in order or deletions.
	function repaintSegments() {
		updateDescriptions();
		for (var i = 0; i < segments.length; i++) {
			removeSegment(segments[i]);
		}
		for (var i = 0; i < segments.length; i++) {
			addSegment(segments[i]);
		}
	}
	 
	 // Visualizes a given segment.
	function addSegment(segment) {
			
		// create canvas element used to visualize the frames of 
		// the given segment + its timecodes
		var item = document.createElement('canvas');
		item.width = 1000;
		item.height = 200;
		
		// input field for description of a segment
		var input = document.createElement('input');
		input.type = 'text';
		input.placeholder = 'description';
		input.className = 'description';
		input.value = segment.description;
		input.id = '' + segment.id;
		input.width = 500;
		
		// draw segment frames of the video
		var context = item.getContext("2d");
		context.drawImage(segment.startFrame.image, 10, 10, 150, 150);
		context.drawImage(segment.endFrame.image, 170, 10, 150, 150);
		
		// draw timecode as text
		context.font = "20px Arial";
		context.fillStyle = 'Black';
		context.fillText(segment.startFrame.asText() + ' - ' + segment.endFrame.asText(), 10, 190);
		
		var div = document.createElement('div');
		div.className = 'element';
		div.setAttribute('data-start', segment.startFrame.second);
		div.setAttribute('data-end', segment.endFrame.second);
		div.id = 'div' + segment.id;
		
		// logic for button showing the up arrow
		var up_arrow = document.createElement('button');
		up_arrow.type = 'button';
		up_arrow.innerHTML = '&uarr;'
		up_arrow.setAttribute('data-id', segment.id);
		var index = segments.indexOf(segment);
		up_arrow.disabled = index == 0;
		up_arrow.addEventListener('click', 
		function() {
			var segment_id = this.getAttribute('data-id');
			var se = getSegmentById(segment_id);
			var index_se = segments.indexOf(se);
			if (index_se <= 0) {
				return;
			}
			swapSegments(index_se, index_se - 1);
			repaintSegments();
		},
		false);
		
		// logic for button showing the down arrow
		var down_arrow = document.createElement('button');
		down_arrow.type = 'button';
		down_arrow.innerHTML = '&darr;'
		down_arrow.setAttribute('data-id', segment.id);
		down_arrow.disabled = index == segments.length - 1;
		down_arrow.addEventListener('click', 
		function() {
			var segment_id = this.getAttribute('data-id');
			var se = getSegmentById(segment_id);
			var index_se = segments.indexOf(se);
			if (index_se >= segments.length - 1) {
				return;
			}
			swapSegments(index_se, index_se + 1);
			repaintSegments();
		},
		false);
		
		// logic for remove button -> removes a segment
		var remove = document.createElement('button');
		remove.type = 'button';
		remove.innerHTML = '-';
		remove.setAttribute('data-id', segment.id);
		remove.style.color = 'red',
		remove.addEventListener('click', 
		function() {
			var segment_id = this.getAttribute('data-id');
			var se = getSegmentById(segment_id);
			var index_se = segments.indexOf(se);
			// Find and remove item from an array
			if(index_se >= 0 && index_se < segments.length) {
				segments.splice(index_se, 1);
				removeSegment(se);
				repaintSegments();
			}
		},
		false);
		
		div.appendChild(item);
		div.appendChild(input);
		div.appendChild(up_arrow);
		div.appendChild(down_arrow);
		div.appendChild(remove);
		
		// add the new segment div to the list of div objects
		container.appendChild(div);
	}

	function swapSegments(index1, index2) {
		var dummy = segments[index1];
		segments[index1] = segments[index2];
		segments[index2] = dummy;
	}
	
	// Removes a segment from the DOM tree if possible.
	function removeSegment(segment) {
		var div = document.getElementById('div' + segment.id);
		if (isNull(div)) {
			return;
		}
		div.remove();
	}
	
	// Used to store current values of description fields 
	// into its associated segment objects. 
	// This is necessary in order to connect view and object.
	function updateDescriptions() {
		var inputs = document.getElementsByTagName('input');
		for (var i = 0; i < inputs.length; i++) {
			var input = inputs[i];
			if(input.type.toLowerCase() == 'text') {
				var id = input.id;
				var segment = getSegmentById(id);
				if (isNull(segment)) {
					continue;
				}
				segment.description = input.value;
			}
		}
	}
	
	// Combines all segments to a string representation that 
	// can be send to the server to signal the creation 
	// of the video.
	function combineSegments() {
		var result = '';
		for (var i = 0; i < segments.length; i++) {
			result += segments[i].asText();
		}
		return result;
	}
	