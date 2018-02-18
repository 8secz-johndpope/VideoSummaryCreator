
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
	
	// Represents a segment that contains two frames
	function Segment(startFrame, endFrame) {
		this.startFrame = startFrame;
		this.endFrame = endFrame;
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
		container = document.getElementById("container");
		
        //initialize events
		canvas.addEventListener("click", saveFrame, false);
		time_slider.addEventListener("change", updateFrame, false);
		time_slider.addEventListener("input", updateFrame, false);
		
		document.getElementById('files').addEventListener('change', FileChosen);
		document.getElementById('UploadButton').addEventListener('click', StartUpload); 
        
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
	
	// initiates drawing of a certain frame by setting associated time value of the video
	function drawFrame(frame) {
			video.currentTime = (frame.second > video.duration ? video.duration : frame.second);
	}
	
	// draws a frame of the current video according to its time in seconds into its canvas. 
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
	
	// takes percentage value of the time slider, converts it into corresponding 
	// time value of the video and initiates drawing of the respective frame.
	function updateFrame() {
		var value = time_slider.value;
		
		if (typeof video == 'undefined') {
				return;
			}
			if (typeof video.duration == 'undefined') {
				return;
			}
			if (typeof video.duration !== video.duration) {
				// return;
			}
		
		var second = Math.floor(value * video.duration / 100);
		actual_frame = new Frame(second, canvas, false, null);
		drawFrame(actual_frame);
	}

    // "Grabs" the visible frame and adds it to "saved_frames" collection. 
    // If "saved_frames" contains at least two frames, a new segment is created 
    // and saved. After creation of a segment, its frames are being removed 
    // from "saved_frames" collection.
    function saveFrame() {
		var img = new Image();
		img.src = actual_frame.canvas.toDataURL();
		var frame = new Frame(actual_frame.second, null, false, img);
		saved_frames.push(frame);
		if (saved_frames.length > 0 && saved_frames.length % 2 == 0) {
			var frame1 = saved_frames.shift();
			var frame2 = saved_frames.shift();
			var segment = new Segment(frame1.older(frame2), frame1.younger(frame2));
			segments.push(segment);
			addSegment(segment);
		}
	}
	
	function upArrowClicked(segment) {
		var index1 = segments.indexOf(segment);
		if (index1 == 0) {
			return;
		}
		var index2 = index1 - 1;
		swapSegments(index1, index2);
		// refresh();
	}
	
	function downArrowClicked(segment) {
		var index1 = segments.indexOf(segment);
		if (index1 == segments.length - 1) {
			return;
		}
		var index2 = index1 + 1;
		swapSegments(index1, index2);
		// refresh();
	}
	
	/*
	 *******************************************************************
	 * Helper functions
	 *******************************************************************
	 */
	 
	 // creates a visual element of a given segment and visualizes it.
	function addSegment(segment) {
			
				// create canvas element, save timecode and frame
				var item = document.createElement('canvas');
				item.width = 500;
				item.height = 100;
				item.setAttribute('data-start', segment.startFrame.second);
				item.setAttribute('data-end', segment.endFrame.second);
				// item.addEventListener('click', function() {jumpToPosition(this)}, false);
				
				// draw current frame of the video
				var start = segment.startFrame.second;
				var end = segment.endFrame.second;
				var context = item.getContext("2d");
				context.drawImage(segment.startFrame.image, 10, 10, 50, 50);
				context.drawImage(segment.endFrame.image, 70, 10, 50, 50);
				
				// draw timecode as text
				context.font = "10px Arial";
				context.fillStyle = 'Black';
				context.fillText(getTime(start), 10, 70);
				context.fillText(getTime(end), 70, 70);
				
				var div = document.createElement('div');
				div.appendChild(item);
				
				// add the new canvas to the list of canvas objects
				container.appendChild(div);
	}

	function swapSegments(index1, index2) {
		var dummy = segments[index1];
		segments[index1] = segments[index2];
		segments[index2] = dummy;
	}
	
	// converts a time value provided in seconds into 
	// more readable hh:mm:ss.
	function getTime(seconds) {
				var h = Math.floor(seconds / 3600);
                var m = Math.floor(seconds % 3600 / 60);
                var s = Math.floor(seconds % 3600 % 60);

                var hms = h > 9 ? "" + h + ":" : "0" + h + ":";
                hms += m > 9 ? "" + m + ":" : "0" + m + ":";
                hms += s > 9 ? "" + s : "0" + s;
				
				return hms;		
	}