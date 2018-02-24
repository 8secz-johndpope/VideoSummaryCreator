var ffmpeg = require('fluent-ffmpeg');

var outFile = 'public/VideoSummary.mp4';
var Files = {};
var inputFile;
// Windows
var fontDir = '/Windows/Fonts/arial.ttf';
// Mac
// var fontDir = '/Library/Fonts/Arial.ttf'
// Linux
// var fontDir = '/usr/share/fonts/truetype/DroidSans.ttf';
var express = require('express');
var app = express();
var server = require('http').createServer(app); 
  var io = require('socket.io').listen(server)
  , fs = require('fs')
  , exec = require('child_process').exec
  , util = require('util')

app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/Video'));
app.get('/', handler);
server.listen(8080);


function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }
    res.writeHead(200);
    res.end(data);
  });
}



var count = 0;
var ssAll = [];
var toAll = [];
var txtAll = [];
var segFiles = []


 
io.sockets.on('connection', function (socket) {
    socket.on('Start', function (data) { //data contains the variables that we passed through in the html file
        var Name = data['Name'];
        Files[Name] = {  //Create a new Entry in The Files Variable
            FileSize : data['Size'],
            Data     : "",
            Downloaded : 0
        }
        var Place = 0;
        try{
            if(fs.existsSync('Temp/' + Name))
            {
                fs.unlinkSync('Temp/' + Name);
            }
            if(fs.existsSync('Video/' + Name))
            {
                fs.unlinkSync('Video/' + Name);
            }
            var bAllSegmentsDeleted = false;
            var counter = 0;
            while(bAllSegmentsDeleted == false) {
                if(fs.existsSync('Video/segment' + counter + '.mp4')) {
                    fs.unlinkSync('Video/segment' + counter + '.mp4');
                } else {
                    bAllSegmentsDeleted = true;
                }
                counter++;    
            }
        }
        catch(er){
            console.log(er);
        } //It's a New File
        fs.open("Temp/" + Name, "a", 0755, function(err, fd){
            if(err)
            {
                console.log(err);
            }
            else
            {
                Files[Name]['Handler'] = fd; //We store the file handler so we can write to it later
                socket.emit('MoreData', { 'Place' : Place, Percent : 0 });
            }
        });
    });

    // parses the string and stores the data in arrays (start/end time of segment, name, description) for further use
    function PrepareString(Segmentation, Merge, string){

        var seg_cnt = 0;
	while(string.length != 0){

	    segFiles.push("Video/segment" + seg_cnt + ".mp4"); 
	    ssAll.push(string.substring(0, string.indexOf('-to') - 1 ));
	    toAll.push(string.substring(string.indexOf('-to'), string.indexOf('-txt') -1 ));
	    txtAll.push(string.substring(string.indexOf('-txt') + 5, string.indexOf(';') || string.length ));
	
	    var remove_string = ssAll[seg_cnt] + ' ' + toAll[seg_cnt] + ' ' + '-txt ' + txtAll[seg_cnt] + ';'
	    string = string.replace(remove_string,'');
	    seg_cnt += 1;
	
	}
        Segmentation(Merge);
     }

     // here fluent-ffmpeg is used to create each single segment regarding the data of the user input
     function Segmentation(Merge){
        console.log(segFiles);
	console.log(ssAll);
        console.log(toAll);
	console.log(txtAll);
		
        for (var i in ssAll) {

            var proc = ffmpeg('Video/'+inputFile)
	        .addOption(ssAll[i])
		.addOption(toAll[i])
		.complexFilter([
		{
		    filter: 'drawtext',
		    options: {
		    fontfile: fontDir,
		    text: txtAll[i],
		    fontsize: 18,
		    box: 1,
		    boxcolor:'white@0.8',
		    fontcolor: 'black',
		    x: '(w-tw)/2',
		    y: '(h/PHI)+th',
		 }, }])
		.addOption('-strict -2')
		.output(segFiles[i])
		
                .on('end', function() {
		    console.log('File has been segmented successfully');
		    count += 1;
                    // used to refresh the progressbar if segment was created
		    socket.emit('ProgressBarSummary', {'SegmentCounter' : count });
		    if(count == ssAll.length){
		        Merge();
		    }
		})
		.on('error', function(err, stdout, stderr) {
                    // in case an error happened
		    console.log("ffmpeg stderr:\n" + stderr);
	            socket.emit('ProgressBarSummary', {'SegmentCounter' : -1 });
		}).run();
	  }
     }




    socket.on('ffmpeg', function (data) {
        var string = data['Data'];
	inputFile = data['Name'];
	
        // merge the segments to the summary video
	function Merge(){
	    var fluent_ffmpeg = require("fluent-ffmpeg");
	    var mergedVideo = fluent_ffmpeg();

	    segFiles.forEach(function(videoName){
		mergedVideo = mergedVideo.addInput(videoName)
		mergedVideo = mergedVideo.addOption('-strict -2')
	    });

	    mergedVideo.mergeToFile(outFile)
            // in case an error happened
	    .on('error', function(err, stdout, stderr) {
		console.log("ffmpeg stderr:\n" + stderr);
		socket.emit('ProgressBarSummary', {'SegmentCounter' : -1 });
		})

            // refresh the progressbar if merge was successful
	    .on('end', function() {
		console.log('Merge finished!');
		socket.emit('ProgressBarSummary', {'SegmentCounter' : count + 1 });
		count = 0;
		ssAll = [];
		toAll = [];
		txtAll = [];
		segFiles = []
		socket.emit('DownloadSummaryVideo', {});
	    });
	}

	PrepareString(Segmentation, Merge, string);

    });
    
    socket.on('Upload', function (data){
        var Name = data['Name'];
        Files[Name]['Downloaded'] += data['Data'].length;
        Files[Name]['Data'] += data['Data'];
        if(Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
        {
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
                var inp = fs.createReadStream("Temp/" + Name);
                var out = fs.createWriteStream("Video/" + Name);
                inp.on('end', function(){
                    inp.destroy();
                });
                out.on('end', function() {
                    out.destroy();
                });
                inp.on('close', function() {
                    fs.close(Files[Name]['Handler'], function(){});
                    fs.unlink("Temp/" + Name, function () { //This Deletes The Temporary File
                        socket.emit('Done', {'Video' : 'Video/' + Name + '.mp4'});
                    });
                });
                inp.pipe(out);
            });
        }
        else if(Files[Name]['Data'].length > 10485760){ //If the Data Buffer reaches 10MB
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
                Files[Name]['Data'] = ""; //Reset The Buffer
                var Place = Files[Name]['Downloaded'] / 524288;
                var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
                socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
            });
        }
        else
        {
            var Place = Files[Name]['Downloaded'] / 524288;
            var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
            socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
        }
    });
});
