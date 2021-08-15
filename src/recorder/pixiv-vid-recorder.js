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
     * @description posible states of the script
     */
    const STATES = {
        WORKING: "working",
        FREE: "free",
        CANCEL: "cancel",
    };

    const ACTIONS = {
        DOWNLOAD: "download",
        RECORD: "record",
    };

    const MESSAGES = {
        CANCEL: "cancel",
        REQUEST_STATUS: "requestStatus",
        REQUEST_ID: "requestId",
        SUCCESS: "success",
        FAILURE: "failure", 
    };

    const sendMessage = (opts, responseCallback) => 
        chrome.runtime.sendMessage(opts, responseCallback);
        // console.log(`Opts: `, opts, "Response: ", responseCallback);

    /**
     * @name cleanUp
     * @description remove the video container if any and freeze the memory
     */
    const cleanUp = () => {
        let container = document.querySelector("#vid-container");
        if (container) {
            let videoElement = container.querySelector("video");
            if (videoElement) {
                videoElement.src = "";
                videoElement.load();
                videoElement = null;
            }
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
    const getCanvas = (failCb) => {
        const canvasCollection = document.querySelectorAll("canvas");

        if (canvasCollection.length === 0) {
            failCb();
        }

        return canvasCollection[canvasCollection.length - 1];
    }

    /**
     * @name validateInputsForDownload
     * @description validate the inputs sent by content script
     * 
     * @param {Number} time Must be a positive number
     * @param {String} name Name for the file and for the headers of the WebM file. Up to 150 characters.
     * @param {Number} quality Must be a number between 0 and 1
     * @param {Number} fps Must be a positive number
     */
    const validateInputsForDownload = ({ /* time, */ name, quality, /* fps */}) => {
        // if (isNaN(time) || typeof time !== "number") {
        //     throw { desc: "Invalid value for time", key: "time" };
        // }
        // if (time <= 0) {
        //     throw { desc: "Time must be a positive number", key: "time" };
        // }

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

        // if (isNaN(fps) || typeof fps !== "number") {
        //     throw { desc: "Invalid value for fps", key: "fps" };
        // }
        // if (fps < 1) {
        //     throw { desc: "FPS ust be a positive number", key: "fps" };
        // }
    };

    /**
     * @name setStatus
     * @description set the status in the window object
     * @param {String} status the status to save 
     */  
    const setStatus = status => window._state.currentStatus = status;

    const setMetadata = metadata => window._state.assetMetadata = metadata;

    const setZipPlayer = zipPlayer => window._state.zipPlayer = zipPlayer;

    const setPreviousAssetId = id => window._state.id = id;
    const getPreviousAssetId = () => window._state.id;

    /**
     * @name getStatus
     * @description gets the current status saved in the window object
     */
    const getStatus = () => window._state.currentStatus;

    const getCancelPredicate = () => () => getStatus() === STATES.CANCEL

    const getZipPlayer = () => window._state?.zipPlayer ?? null;

    const getAssetId = () => location.href.match(/\d+$/)[0];

    const getConfig = ({ canvas, metadata, loop = false, debug = false, autoStart = false }) => ({
        "canvas": canvas,
        "source": metadata.originalSrc, // from content.body.originalSrc
        "metadata": metadata,
        "chunkSize":300000,
        "loop": loop,
        "autoStart": autoStart,
        "debug": debug,
        "autosize": true,
        // "videoWriter": videoWriter,
        // onEnd: onEnd,
    });

    const getMetadata = async () => {
        if (window._state.assetMetadata) {
            return window._state.assetMetadata;
        }
        const id = getAssetId();
        setPreviousAssetId(id);
        const data = await fetch(`https://www.pixiv.net/ajax/illust/${id}/ugoira_meta?lang=en`);
        const content = await data.json();
        const metadata = content.body;
        setMetadata(metadata);
        return metadata;
    };

    const createZipPlayer = async () => {
        const canvas = document.createElement("canvas");
        const metadata = await getMetadata();
        const config = getConfig({ canvas, metadata });

        const zipPlayer = new ZipImagePlayer(config);
        setZipPlayer(zipPlayer);
        return zipPlayer;
    };

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
        button.classList.add("btn-close-recorded-top");
    };

    /**
     * @name createCheckBox
     * @description Create a checkbox button
     * @param {String} text Text to display inside the button
     */
    const createCheckBox = (text) => {
        const checkContainer = document.createElement("div");
        const checkButton = document.createElement("input");
        const handler = () => {
            if (checkButton.checked) {
                checkButton.checked = false;
                checkContainer.classList.remove("btn-video-info-checked");
            } else {
                checkButton.checked = true;
                checkContainer.classList.add("btn-video-info-checked");
            }
        }

        checkButton.type = "checkbox";
        checkButton.classList.add("btn-video-no-click");

        checkContainer.textContent = text ? `${text} ` : "Active ";
        checkContainer.appendChild(checkButton);
        checkContainer.classList.add("btn-video", "btn-video-info");
        checkContainer.addEventListener("click", handler, false);

        return checkContainer;
    }

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
        // Open edit video site
        const link = document.createElement("a");
        // url of the recording in memory
        const sourceUrl = URL.createObjectURL(blob);
        // The video tag
        const videoElement = document.createElement("video");
        // "a" element used for automatic downloads
        const download = document.createElement("a");
        // Button for closing the recording
        const closeButton = document.createElement("button");
        // Checkbox for looping the video
        const loopButton = createCheckBox("Loop");
        // Checkbox for showing video controls
        const enableControlsButton = createCheckBox("Controls");

        const onPlayError = (e) => {
            console.log("A problem happened when playing the video");
        };

        /* videoElement */
        videoElement.src = sourceUrl;
        videoElement.addEventListener("canplay", () => {
            videoElement.play().catch(onPlayError);
            // to set the button correctly, it is necessary to wait until video is playing
            if (!closeButton.classList.contains("btn-close-recorded-top")) {
                setRemoveButton(container, closeButton, videoElement);
            }
        }, false);

        // loop the video
        videoElement.addEventListener("ended", () => loopButton.children[0].checked && videoElement.play().catch(onPlayError), false);

        /* loopButton */
        loopButton.children[0].checked = true;
        loopButton.classList.add("btn-video-info-checked");
        loopButton.addEventListener("click", () => {
            // play video if active and video is paused
            if (loopButton.children[0].checked && videoElement.paused) {
                videoElement.play()
            }
        }, false);

        /* enableControlsButton */
        enableControlsButton.addEventListener("click", () => {
            if (enableControlsButton.children[0].checked) {
                videoElement.controls = true;
            } else {
                videoElement.controls = false;
            }
        }, false);

        /* closeButton */
        closeButton.textContent = "X";
        closeButton.id = "btn-close-recorded";  
        closeButton.addEventListener("click", cleanUp, false);  
        
        /* link */
        link.href = "https://ezgif.com/";
        link.textContent = "Make GIF";
        link.target = "_blank";
        link.classList.add("btn-video", "btn-video-info");

        /* download */
        download.href = sourceUrl;
        download.download = name;
        download.classList.add("btn-video", "btn-video-info");
        download.textContent = "Download";
        
        /* container */
        container.id = "vid-container"
        container.innerHTML = "<div></div><div></div>";
        container.children[0].appendChild(videoElement);

        container.children[1].classList.add("btn-video-area");
        container.children[1].appendChild(enableControlsButton);
        container.children[1].appendChild(loopButton);
        container.children[1].appendChild(download);
        container.children[1].appendChild(link);
        
        /* Add on top of the page */
        document.children[0].prepend(container);
        
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
    const captureCanvas = async (time, name, quality, fps, auto, onFinishCb) => {
        // Verify that there is a canvas
        // const canvas = getCanvas(() => { throw { desc: "Invalid video format", key: "format" }});
        // object that will record the video
        // let video = new Groover.Video(fps,quality,name);
        const canvas = document.createElement("canvas");
        const id = getAssetId();
        setPreviousAssetId(id);
        const metadata = await fetch(`https://www.pixiv.net/ajax/illust/${id}/ugoira_meta?lang=en`);
        const content = await metadata.json();
        const frameTime = content.body.frames[0].delay;

        const video = new WebMWriter({
            quality: quality,    // WebM image quality from 0.0 (worst) to 0.99999 (best), 1.00 (VP8L lossless) is not supported
            fileWriter: null, // FileWriter in order to stream to a file instead of buffering to memory (optional)
            fd: null,         // Node.js file handle to write to instead of buffering to memory (optional)

            // You must supply one of:
            frameDuration: frameTime, // Duration of frames in milliseconds
            frameRate: null,     // Number of frames per second

            transparent: false,      // True if an alpha channel should be included in the video
            alphaQuality: undefined, // Allows you to set the quality level of the alpha channel separately.
                                        // If not specified this defaults to the same value as `quality`.
        }); 

        //video.addFrame(,);

        const config = getConfig({
            canvas,
            metadata: { ...content.body },
            onEnd: () => {
                video.complete()
                    .then(webMBlob => {
                        attachToDOM(webMBlob, name, auto);
                        onFinishCb();
                        return;
                    })
            },
        });

        const zipPlayer = new ZipImagePlayer(config);

        // capture function works recursively 
        // const capture = () => {
        //     if (getStatus() === STATES.CANCEL) {
        //         video = null;
        //         sendMessage({ cancel: true }, () => {
        //             setTimeout(() => setStatus(STATES.FREE), 100);
        //         });
        //         return;
        //     }
        //     if(video.timecode < time){ // recording time in miliseconds
        //         setTimeout(capture, video.frameDelay);             
        //     }else{
        //         video.addFrame(canvas); // TODO: add last frame?
        //         const blob = video.toBlob();
        //         video = undefined; // DeReference as it is memory hungry.
        //         attachToDOM(blob, name, auto);
        //         onFinishCb();
        //         return;
        //     }
        //     // first frame sets the video size
        //     video.addFrame(canvas); // Add current canvas frame
        // }

        // (new Promise(r => r()))
        //     .then(() => {
        //         for (let i = 0; i < 30; i++) {
        //             const frameTime = frameDelay * i;
        //             setTimeout(capture, frameTime);
        //         }
        //     })


        // setTimeout(() => {
        //     video.addFrame(canvas); // TODO: add last frame?
        //     const blob = video.toBlob();
        //     video = undefined; // DeReference as it is memory hungry.
        //     attachToDOM(blob, name, auto);
        //     onFinishCb();
        // }, (frameDelay * totalFrames) + frameDelay); // delay end by 1 frame more
    }

    const prepare = async zipPlayer => {
        if (zipPlayer.isReady()) {
            return;
        }
        try {
            await zipPlayer.prepare();
        } catch (error) {
            zipPlayer._reset();
            console.log("Error: ", error);
            onFinishCb(false);
            throw "Error at preparing the player. Aborting..."
        }
    };

    const downloadGif = async (name, quality, auto, onFinishCb) => {
        const zipPlayer = getZipPlayer();
        zipPlayer.setCancelCheck(getCancelPredicate());

        await prepare(zipPlayer);

        const metadata = await getMetadata();
        const frameTime = metadata.frames[0].delay;

        const video = new WebMWriter({
            quality: quality,    // WebM image quality from 0.0 (worst) to 0.99999 (best), 1.00 (VP8L lossless) is not supported
            fileWriter: null, // FileWriter in order to stream to a file instead of buffering to memory (optional)
            fd: null,         // Node.js file handle to write to instead of buffering to memory (optional)

            // You must supply one of:
            frameDuration: frameTime, // Duration of frames in milliseconds
            frameRate: null,     // Number of frames per second

            transparent: false,      // True if an alpha channel should be included in the video
            alphaQuality: undefined, // Allows you to set the quality level of the alpha channel separately.
                                        // If not specified this defaults to the same value as `quality`.
        });

        zipPlayer.setCaptureFrame((canvas, time) => video.addFrame(canvas, time));

        try {            
            await zipPlayer.recordGif();
            const webMBlob = await video.complete();
            attachToDOM(webMBlob, name, auto);
            onFinishCb(true);
        } catch (error) {
            zipPlayer._reset();
            console.log("Error: ", error);
            onFinishCb(false);
        }
    };

    const recordGif = async (time, name, quality, fps, auto) => {
        const zipPlayer = getZipPlayer();
        zipPlayer.setCancelCheck(getCancelPredicate());

        await prepare(zipPlayer);

        const video = new WebMWriter({
            quality: quality,    // WebM image quality from 0.0 (worst) to 0.99999 (best), 1.00 (VP8L lossless) is not supported
            fileWriter: null, // FileWriter in order to stream to a file instead of buffering to memory (optional)
            fd: null,         // Node.js file handle to write to instead of buffering to memory (optional)

            // You must supply one of:
            frameDuration: null, // Duration of frames in milliseconds
            frameRate: fps,     // Number of frames per second

            transparent: false,      // True if an alpha channel should be included in the video
            alphaQuality: undefined, // Allows you to set the quality level of the alpha channel separately.
                                        // If not specified this defaults to the same value as `quality`.
        });

        zipPlayer.setCaptureFrame((canvas) => video.addFrame(canvas));

        try {
            setTimeout(async () => {
                zipPlayer.pause();
                zipPlayer._reset();
                const webMBlob = await video.complete();
                attachToDOM(webMBlob, name, auto);
                onFinishCb(true);
            }, time);
            zipPlayer.record();
        } catch (error) {
            zipPlayer._reset();
            console.log("Error: ", error);
            onFinishCb(false);
        }
    };

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
    function init (_time, _name, _quality = 0.8, _fps, _auto = false, action = ACTIONS.DOWNLOAD) {
        const time = _time;
        const name = _name || getAssetId(); // Placed into the Mux and Write Application Name fields of the WebM header
        const quality = _quality; // good quality 1 Best < 0.7 ok to poor
        const fps = _fps; // I have tried all sorts of frame rates and all seem to work
                          // Do some test to workout what your machine can handle as there
                          // is a lot of variation between machines.
        const auto = _auto;

        setStatus(STATES.WORKING);

        const onFinish = (success) => {
            // notify end of process
            sendMessage({ message: success ? MESSAGES.SUCCESS : MESSAGES.FAILURE }, function(response) {
                if (response && response.ok) {
                    // Do cleanup jobs here if required
                }
            });
            // set free status, so it can be called again
            setStatus(STATES.FREE);
        };

        // Validate inputs
        validateInputsForDownload({ name, quality });
        cleanUp();
        if (getAssetId() !== getPreviousAssetId()) {
            flushPlayerData();
        }

        let next;

        switch (action) {
            case ACTIONS.DOWNLOAD:
                next = () => downloadGif(name, quality, auto, onFinish);
                break;
            case ACTIONS.RECORD:
            default:
                break;
        }

        if (!getZipPlayer()) {
            createZipPlayer()
                .then(next);
        } else {
            setTimeout(next, 0);
        }
    }

    const flushPlayerData = () => {
        setZipPlayer(null);
        setMetadata(null);
        setPreviousAssetId(null);
    };

    const getNumber = str => {
        switch (typeof str) {
            case "string":
                return parseFloat(str);
            case "number":
                return str;
            default:
                return null;
        }
    };

    window._state = {
        currentStatus: STATES.FREE,
        assetMetadata: null,
        zipPlayer: null,
        id: null,
    };
    
    window.startRecording = ([time, name, quality, fps, auto]) =>
        init(getNumber(time), name, getNumber(quality), getNumber(fps), auto);

        
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (!request) {
            return;
        }

        switch (request.message) {
            case MESSAGES.CANCEL: {
                setStatus(STATES.CANCEL);
                sendResponse({ status: getStatus(), ok: true });
                break;
            }
            case MESSAGES.REQUEST_ID: {
                const response = { id: getAssetId() };
                sendResponse(response);
                break;
            }
            case MESSAGES.REQUEST_STATUS: {
                const response = { status: getStatus() ? getStatus() : STATES.FREE };
                sendResponse(response);
                break;
            }        
            default:
                break;
        }
        
        // if (request.status) {
        //     const response = { status: getStatus() ? getStatus() : STATES.FREE };
        //     sendResponse(response);
        // }
        // if (request.cancel) {
        //     setStatus(STATES.CANCEL);
        //     sendResponse({ status: getStatus(), ok: true });
        // }

    });

    console.log("pixiv-vid-recorder.js loaded on window!");
})()
    