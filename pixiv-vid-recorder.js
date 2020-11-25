
/**
 * README!
 * 
 * the main function is "startRecording"
 * 
 * @name window.startRecording
 * 
 * @param {Number} _time the time use for capturing the canvas
 * @param {String} _name name use for the header of the WebM file
 * @param {Number} _quality quality for the WebM file. Choose a number between 0 to 1. E.g. 0.8
 * @param {Number} _fps framerate of the WebM file. You can experiment with this. Default 30
 * 
 * @function window.startRecording(_time,_name,_quality,_fps) 
 * 
 * call "window.startRecording" like this
 * > window.startRecording(5000, "capture", .8, 30)
 */
(() => {
    /**
     * @name videoElement
     * @description reference to the video object to play the recorded video
     */
    let videoElement;

    /**
     * @description posible states of the script
     */
    const STATES = {
        WORKING: "working",
        FREE: "free",
    };

    /**
     * @name cleanUp
     * @description remove the video container if any and freeze the memory
     */
    const cleanUp = () => {
        let container = document.querySelector("#root #vid-container");
        if (videoElement) {
            videoElement = null;
        }

        if (container) {
            container.innerHTML = null;
            let parent = container.parentElement;
            parent.removeChild(container);
            container = null;
        }
    };

    /**
     * @name getCanvas
     * @description get the canvas element of the page
     * 
     * @param {Function} failCb function callback if there is no canvas on the page
     */
    const getCanvas = (failCb) => document.querySelector("#root canvas") 
        ? document.querySelector("#root canvas") 
        : failCb();

    /**
     * @name validateInputs
     * @description validate the inputs sent by content script
     * 
     * @param {Number} time Must be a positive number
     * @param {String} name Name for the file and for the headers of the WebM file. Up to 150 characters.
     * @param {Number} quality Must be a number between 0 and 1
     * @param {Number} fps Must be a positive number
     */
    const validateInputs = (time, name, quality, fps) => {
        if (isNaN(time) || typeof time !== "number") {
            throw { desc: "Invalid value for time", key: "time" };
        }
        if (time <= 0) {
            throw { desc: "Time must be a positive number", key: "time" };
        }

        if (typeof name !== "string" || name.length === 0) {
            throw { desc: "Invalid name!", key: "name" };
        }
        if (name.length > 150) {
            throw { desc: "Name is too long", key: "name" };
        }

        if (isNaN(quality) || typeof quality !== "number" || quality >= 1 || quality < 0) {
            throw { desc: "Invalid value for quality", key: "quality" };
        }
        if (quality > 1 || quality < 0) {
            throw { desc: "Quality must be in range 0 to 1", key: "quality" };
        }

        if (isNaN(fps) || typeof fps !== "number") {
            throw { desc: "Invalid value for fps", key: "fps" };
        }
        if (fps < 1) {
            throw { desc: "FPS ust be a positive number", key: "fps" };
        }
    };

    /**
     * @name setStatus
     * @description set the status in the window object
     * @param {String} status the status to save 
     */  
    const setStatus = status => window.currentStatus = status;

    /**
     * @name getStatus
     * @description gets the current status saved in the window object
     */
    const getStatus = () => window.currentStatus;

    /**
     * @name setRemoveButton
     * @description Add remove button to container to clean it up
     * @param {HTMLElement<div>} container 
     * @param {HTMLElement<button>} button 
     * @param {HTMLElement<video>} video 
     */
    const setRemoveButton = (container, button, video) => {
        container.children[0].appendChild(button);
        button.style.right = (((container.offsetWidth - video.videoWidth) / 2) + 10) + "px";
        button.style.top = "20px";
    };

    /**
     * @name attachToDOM
     * @description create a container for the video an attach it to the DOM 
     * @param {Blob} blob video data
     * @param {String} name for WebM video file
     * @param {Boolean} auto flag to start automatic download
     */
    const attachToDOM = (blob, name, auto) => {
        // Container to attach to the document
        const container = document.createElement("div");
        // Download link for video
        const link = document.createElement("a");
        // Root element of Pixiv
        const root = document.querySelector("#root div figcaption");
        // url of the recording in memory
        var sourceUrl = URL.createObjectURL(blob);
        // The video tag
        videoElement = document.createElement("video");
        // "a" element used for automatic downloads
        const download = document.createElement("a");
        // Button for closing the recording
        const closeButton = document.createElement("button");

        /* videoElement */
        videoElement.src = sourceUrl;
        videoElement.addEventListener("canplay", () => {
            videoElement.play()
            // to set the button correctly, it is necessary to wait until video is playing
            setRemoveButton(container, closeButton, videoElement);
        }, false);

        // loop the video
        videoElement.addEventListener("ended", () => videoElement.play(), false);

        /* closeButton */
        closeButton.textContent = "X";
        closeButton.style = `
            float:right;
            cursor:pointer;
            color: #fff;
            border: 1px solid #AEAEAE;
            border-radius: 30px;
            background: rgba(96, 95, 97, .7);
            font-size: 31px;
            font-weight: bold;
            position: absolute;
        `;    
        closeButton.addEventListener("click", cleanUp, false);  
        
        /* link */
        link.href = sourceUrl;
        link.textContent = "=> Download video";
        link.target = "_blank";

        /* download */
        download.href = sourceUrl;
        download.download = name;
        download.style.display = "none";
        
        /* container */
        container.id = "vid-container"
        container.style.position = "relative";
        container.innerHTML = "<div></div><div></div>";
        container.style = "display: flex;justify-content: center;align-items: center;flex-direction: column; padding: 10px 0;";
        container.children[0].appendChild(videoElement);
        container.children[1].appendChild(link);
        container.children[1].appendChild(download);
        
        /* root */
        root.prepend(container);
        
        // scroll to recording
        container.scrollIntoView({
            behavior: 'smooth'
            });
        
        // start recording if aplicable
        if (auto) {
            download.click();
        }
    };

    /**
     * @name captureCanvas
     * @description capture the frames of the canvas into a video WebM
     * @param {Number} time time to record 
     * @param {String} name name for headers and video file
     * @param {Number} quality quality for canvas image. See canvas.toDataURL() for more information https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
     * @param {Number} fps framerate
     * @param {Boolean} auto flag to start automatic downloads
     * @param {Function} onFinishCb callback for end of process
     */
    const captureCanvas = (time, name, quality, fps, auto, onFinishCb) => {
        // Verify that there is a canvas
        const canvas = getCanvas(() => { throw { desc: "Invalid video format", key: "format" }});
        // object that will record the video
        let video = new Groover.Video(fps,quality,name);

        // capture function works recursively 
        const capture = () => {
            if(video.timecode < time){ // recording time in miliseconds
                setTimeout(capture, video.frameDelay);             
            }else{
                video.addFrame(canvas); // TODO: add last frame?
                const blob = video.toBlob();
                video = undefined; // DeReference as it is memory hungry.
                attachToDOM(blob, name, auto);
                onFinishCb();
                return;
            }
            // first frame sets the video size
            video.addFrame(canvas); // Add current canvas frame
        }

        capture();
    }

    /**
     * @name init
     * @description start the recording process
     * 
     * @param {Number} _time The time of the recording in miliseconds 
     * @param {String} _name Name for the file and for the headers of the WebM file
     * @param {Number} _quality The quality of the video (from 0 to 1). Values grater than 0.9 may not work ty 
     * @param {Number} _fps The framerate of the recording
     * @param {Boolean} _auto Start download automatically
     */
    function init (_time = 5000, _name = "CanvasCapture", _quality = 0.8, _fps = 30, _auto = false) {
        const time = _time;
        const name = _name; // Placed into the Mux and Write Application Name fields of the WebM header
        const quality = _quality; // good quality 1 Best < 0.7 ok to poor
        const fps = _fps; // I have tried all sorts of frame rates and all seem to work
                          // Do some test to workout what your machine can handle as there
                          // is a lot of variation between machines.
        const auto = _auto;

        setStatus(STATES.WORKING);

        // Validate inputs
        validateInputs(time, name, quality, fps);
        cleanUp();

        captureCanvas(time, name, quality, fps, auto, () => {
            // notify end of process
            chrome.runtime.sendMessage({ success: true }, function(response) {
                if (response && response.ok) {
                    // Do cleanup jobs here if required
                }
            });
            // set free status, so it can be called again
            setStatus(STATES.FREE);
        });
    }
    
    var Groover = (function(){
        // ensure webp is supported 
        function canEncode(){
            var canvas = document.createElement("canvas");
            canvas.width = 8;
            canvas.height = 8;
            return canvas.toDataURL("image/webp",0.1).indexOf("image/webp") > -1;
        }
        if(!canEncode()){
            return undefined;
        }    
        var webmData = null;
        var clusterTimecode = 0;
        var clusterCounter = 0;
        var CLUSTER_MAX_DURATION = 30000;
        var frameNumber = 0;
        var width;
        var height;
        var frameDelay;
        var quality;
        var name;
        const videoMimeType = "video/webm"; // the only one.
        const frameMimeType = 'image/webp'; // can be no other
        const S = String.fromCharCode;
        const dataTypes = {
            object : function(data){ return toBlob(data);},
            number : function(data){ return stream.num(data);},
            string : function(data){ return stream.str(data);},
            array  : function(data){ return data;}, 
            double2Str : function(num){
                var c = new Uint8Array((new Float64Array([num])).buffer);
                return S(c[7]) + S(c[6]) + S(c[5]) + S(c[4]) + S(c[3]) + S(c[2]) + S(c[1]) + S(c[0]);
            }
        };    
    
        const stream = {
            num : function(num){ // writes int
                var parts = [];
                while(num > 0){ parts.push(num & 0xff); num = num >> 8; }
                return new Uint8Array(parts.reverse());
            },
            str : function(str){ // writes string
                var i, len, arr;
                len = str.length;
                arr = new Uint8Array(len);
                for(i = 0; i < len; i++){arr[i] = str.charCodeAt(i);}
                return arr;
            },
            compInt : function(num){ // could not find full details so bit of a guess
                if(num < 128){       // number is prefixed with a bit (1000 is on byte 0100 two, 0010 three and so on)
                    num += 0x80;
                    return new Uint8Array([num]);
                }else
                if(num < 0x4000){
                    num += 0x4000;
                    return new Uint8Array([num>>8, num])
                }else
                if(num < 0x200000){
                    num += 0x200000;
                    return new Uint8Array([num>>16, num>>8, num])
                }else
                if(num < 0x10000000){
                    num += 0x10000000;
                    return new Uint8Array([num>>24, num>>16, num>>8, num])
                }            
            }
        }
        const ids = { // header names and values
            videoData          : 0x1a45dfa3, 
            Version            : 0x4286,
            ReadVersion        : 0x42f7,
            MaxIDLength        : 0x42f2,
            MaxSizeLength      : 0x42f3,
            DocType            : 0x4282,
            DocTypeVersion     : 0x4287,
            DocTypeReadVersion : 0x4285,
            Segment            : 0x18538067,
            Info               : 0x1549a966,
            TimecodeScale      : 0x2ad7b1,
            MuxingApp          : 0x4d80,
            WritingApp         : 0x5741,
            Duration           : 0x4489,
            Tracks             : 0x1654ae6b,
            TrackEntry         : 0xae,
            TrackNumber        : 0xd7,
            TrackUID           : 0x63c5,
            FlagLacing         : 0x9c,
            Language           : 0x22b59c,
            CodecID            : 0x86,
            CodecName          : 0x258688,
            TrackType          : 0x83,
            Video              : 0xe0,
            PixelWidth         : 0xb0,
            PixelHeight        : 0xba,
            Cluster            : 0x1f43b675,
            Timecode           : 0xe7,
            Frame              : 0xa3,
            Keyframe           : 0x9d012a,
            FrameBlock         : 0x81,
        };
        const keyframeD64Header = '\x9d\x01\x2a'; //VP8 keyframe header 0x9d012a
        const videoDataPos = 1; // data pos of frame data header
        const defaultDelay = dataTypes.double2Str(1000/25);
        const header = [  // structure of webM header/chunks what ever they are called.
            ids.videoData,[
                ids.Version, 1,
                ids.ReadVersion, 1,
                ids.MaxIDLength, 4,
                ids.MaxSizeLength, 8,
                ids.DocType, 'webm',
                ids.DocTypeVersion, 2,
                ids.DocTypeReadVersion, 2
            ],
            ids.Segment, [
                ids.Info, [
                    ids.TimecodeScale, 1000000,
                    ids.MuxingApp, 'Groover',
                    ids.WritingApp, 'Groover',
                    ids.Duration, 0
                ],
                ids.Tracks,[
                    ids.TrackEntry,[
                        ids.TrackNumber, 1,
                        ids.TrackUID, 1,
                        ids.FlagLacing, 0,     // always o
                        ids.Language, 'und',   // undefined I think this means
                        ids.CodecID, 'V_VP8',  // These I think must not change
                        ids.CodecName, 'VP8',  // These I think must not change
                        ids.TrackType, 1,
                        ids.Video, [
                            ids.PixelWidth, 0,
                            ids.PixelHeight, 0
                        ]
                    ]
                ]
            ]
        ];    
        function getHeader(){
            header[3][2][3] = name;
            header[3][2][5] = name;
            header[3][2][7] =  dataTypes.double2Str(frameDelay);
            header[3][3][1][15][1] =  width;
            header[3][3][1][15][3] =  height;
            function create(dat){
                var i,kv,data;
                data = [];
                for(i = 0; i < dat.length; i += 2){
                    kv = {i : dat[i]};
                    if(Array.isArray(dat[i + 1])){
                        kv.d = create(dat[i + 1]);
                    }else{
                        kv.d = dat[i + 1];
                    }
                    data.push(kv);
                }
                return data;
            }
            return create(header);
        }
        function addCluster(){
            webmData[videoDataPos].d.push({ i: ids.Cluster,d: [{ i: ids.Timecode, d: Math.round(clusterTimecode)}]}); // Fixed bug with Round
            clusterCounter = 0;
        }
        function addFrame(frame){
            var VP8, kfS,riff;
            riff = getWebPChunks(atob(frame.toDataURL(frameMimeType, quality).slice(23)));
            VP8 = riff.RIFF[0].WEBP[0];
            kfS = VP8.indexOf(keyframeD64Header) + 3;
            frame = {
                width: ((VP8.charCodeAt(kfS + 1) << 8) | VP8.charCodeAt(kfS)) & 0x3FFF,
                height: ((VP8.charCodeAt(kfS + 3) << 8) | VP8.charCodeAt(kfS + 2)) & 0x3FFF,
                data: VP8,
                riff: riff
            };
            if(clusterCounter > CLUSTER_MAX_DURATION){
                addCluster();            
            }
            webmData[videoDataPos].d[webmData[videoDataPos].d.length-1].d.push({
                i: ids.Frame, 
                d: S(ids.FrameBlock) + S( Math.round(clusterCounter) >> 8) +  S( Math.round(clusterCounter) & 0xff) + S(128) + frame.data.slice(4),
            });
            clusterCounter += frameDelay;        
            clusterTimecode += frameDelay;
            webmData[videoDataPos].d[0].d[3].d = dataTypes.double2Str(clusterTimecode);
        }
        function startEncoding(){
            frameNumber = clusterCounter = clusterTimecode = 0;
            webmData  = getHeader();
            addCluster();
        }    
        function toBlob(vidData){
            var data,i,vData, len;
            vData = [];
            for(i = 0; i < vidData.length; i++){
                data = dataTypes[typeof vidData[i].d](vidData[i].d);
                len  = data.size || data.byteLength || data.length;
                vData.push(stream.num(vidData[i].i));
                vData.push(stream.compInt(len));
                vData.push(data)
            }
            return new Blob(vData, {type: videoMimeType});
        }
        function getWebPChunks(str){
            var offset, chunks, id, len, data;
            offset = 0;
            chunks = {};
            while (offset < str.length) {
                id = str.substr(offset, 4);
                // value will have top bit on (bit 32) so not simply a bitwise operation
                // Warning little endian (Will not work on big endian systems)
                len = new Uint32Array(
                    new Uint8Array([
                        str.charCodeAt(offset + 7),
                        str.charCodeAt(offset + 6),
                        str.charCodeAt(offset + 5),
                        str.charCodeAt(offset + 4)
                    ]).buffer)[0];
                id = str.substr(offset, 4);
                chunks[id] = chunks[id] === undefined ? [] : chunks[id];
                if (id === 'RIFF' || id === 'LIST') {
                    chunks[id].push(getWebPChunks(str.substr(offset + 8, len)));
                    offset += 8 + len;
                } else if (id === 'WEBP') {
                    chunks[id].push(str.substr(offset + 8));
                    break;
                } else {
                    chunks[id].push(str.substr(offset + 4));
                    break;
                }
            }
            return chunks;
        }
        function Encoder(fps, _quality = 0.8, _name = "Groover"){ 
            this.fps = fps;
            this.quality = quality = _quality;
            this.frameDelay = frameDelay = 1000 / fps;
            this.frame = 0;
            this.width = width = null;
            this.timecode = 0;
            this.name = name = _name;
        }
        Encoder.prototype = {
            addFrame : function(frame){
                if('canvas' in frame){
                    frame = frame.canvas;    
                }
                if(width === null){
                    this.width = width = frame.width,
                    this.height = height = frame.height
                    startEncoding();
                }else
                if(width !== frame.width || height !== frame.height){
                    throw RangeError("Frame size error. Frames must be the same size.");
                }            
                addFrame(frame);   
                this.frame += 1;
                this.timecode = clusterTimecode;
            },        
            toBlob : function(){
                return toBlob(webmData);
            }
        }
        return {
            Video: Encoder,
        }
    })()

    window.startRecording = ([time, name, quality, fps, auto]) =>
        init(Number(time), name, Number(quality), Number(fps), auto);

    console.log("pixiv-vid-recorder.js loaded on window!");

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request && request.status) {
            const response = { status: getStatus() ?? STATES.FREE };
            sendResponse(response);
        }
    });
})()
    