function onLoad()
{
    document.getElementById('files').addEventListener('change', onUpload, false);
}

function onUpload(evt)
{
    var myVideo = document.getElementById("video1"); 
    var fileToUpload = evt.target.files[0];
    var reader = new FileReader();

    var senddata = new Object();
    // Auslesen der Datei-Metadaten
    senddata.name = fileToUpload.name;
    senddata.date = fileToUpload.lastModified;
    senddata.size = fileToUpload.size;
    senddata.type = fileToUpload.type;

    // Wenn der Dateiinhalt ausgelesen wurde...
    reader.onload = function(theFileData) {
      senddata.fileData = theFileData.target.result; // Ergebnis vom FileReader auslesen

      alert(senddata.name);
    }

    // Die Datei einlesen und in eine Data-URL konvertieren
    reader.readAsDataURL(fileToUpload);
}