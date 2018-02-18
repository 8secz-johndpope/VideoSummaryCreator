var http = require('http');

var ffmpeg = require('fluent-ffmpeg');

var inputFile = "./BigBuckBunny_320x180.mp4";
//var inputFile = "/home/karin/Dokumente/Fundamentals/Project/bbb_sunflower_1080p_30fps_normal.mp4";
var outFile = "./VideoSummary.mp4";

var string = "-ss 00:00:03 -to 00:00:10 -txt kurze beschreibung segment 1;-ss 00:01:15 -to 00:01:20 -txt kurze beschreibung segment 2;-ss 00:05:30 -to 00:05:40 -txt kurze beschreibung segment 3;-ss 00:08:30 -to 00:08:40 -txt kurze beschreibung segment 4;";


var count = 0;
var ssAll = [];
var toAll = [];
var txtAll = [];
var segFiles = []

function PrepareString(Segmentation, Merge, string){

    var seg_cnt = 0;
    while(string.length != 0){

        segFiles.push("./segment" + seg_cnt + ".mp4"); 
	ssAll.push(string.substring(0, string.indexOf('-to') - 1 ));
	toAll.push(string.substring(string.indexOf('-to'), string.indexOf('-txt') -1 ));
	txtAll.push(string.substring(string.indexOf('-txt') + 5, string.indexOf(';') || string.length ));
	
	var remove_string = ssAll[seg_cnt] + ' ' + toAll[seg_cnt] + ' ' + '-txt ' + txtAll[seg_cnt] + ';'
	string = string.replace(remove_string,'');
	seg_cnt += 1;
	
    }
   Segmentation(Merge);
}


function Segmentation(Merge){
    console.log(segFiles);
    console.log(ssAll);
    console.log(toAll);
    console.log(txtAll);

    for (var i in ssAll) {

	var proc = ffmpeg(inputFile)
	    .addOption(ssAll[i])
	    .addOption(toAll[i])
	    .complexFilter([
	    {
		filter: 'drawtext',
		options: {
		fontfile:'DejaVuSans.ttf' ,
	 	text: txtAll[i],
		fontsize: 14,
		fontcolor: 'black',
		x: '(w-tw)/2',
		y: '(h/PHI)+th',
	    	},
	    }])
		.addOption('-strict -2')
		.output(segFiles[i])
		.on('end', function() {
			console.log('File has been segmented succesfully');
			count += 1;
			if(count == ssAll.length){
				Merge();
			}
		 })
		 .on('error', function(err, stdout, stderr) {
		      console.log("ffmpeg stderr:\n" + stderr);
		 }).run();
	}
}



function Merge(){
    var fluent_ffmpeg = require("fluent-ffmpeg");
    var mergedVideo = fluent_ffmpeg();

    segFiles.forEach(function(videoName){
        mergedVideo = mergedVideo.addInput(videoName)
        mergedVideo = mergedVideo.addOption('-strict -2')
    });

    mergedVideo.mergeToFile(outFile)
    .on('error', function(err, stdout, stderr) {
        console.log("ffmpeg stderr:\n" + stderr);
	})
    .on('end', function() {
        console.log('Merge finished!');
    });
}

PrepareString(Segmentation, Merge, string);


/*http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('Hello World!');
}).listen(8080); */


