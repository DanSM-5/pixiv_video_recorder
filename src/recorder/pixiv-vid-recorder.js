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

    /**
     * @name cleanUp
     * @description find all video elements and call click on its close button
     */
    const cleanUp = () => {
        const containerArr = Array.from(document.querySelectorAll(".video-area"));

        containerArr.forEach(container => {
            const closeButton = container.querySelector(".btn-close-recorded");
            if (closeButton) {
                closeButton.click();
            }
        });
    };

    const hidePageCanvas = () => {
        const canvasCollection = document.querySelectorAll("canvas");
        const canvasButtons = document.querySelectorAll("canvas + button");

        if (canvasCollection.length === 0) {
            console.log("Didn't found :(");
            return;
        }

        const zipPlayer = getZipPlayer();
        const canvas = zipPlayer && zipPlayer.getCanvas() || null;

        Array.from(canvasCollection)
            .forEach(cv => {
                if (cv !== canvas) {
                    cv.style.display = "none";
                }
            });

        Array.from(canvasButtons)
            .forEach(button => {
                // hopefully it will stop the player and not activate it 😓
                button.click();
            });
    };

    const showPageCanvas = () => {
        const canvasCollection = document.querySelectorAll("canvas");
        const canvasButtons = document.querySelectorAll("canvas + button");

        if (canvasCollection.length === 0) {
            console.log("Didn't found :(");
            return;
        }

        const zipPlayer = getZipPlayer();
        const canvas = zipPlayer && zipPlayer.getCanvas() || null;

        Array.from(canvasCollection)
            .forEach(cv => {
                if (cv !== canvas) {
                    cv.style.display = "block";
                }
            });

        Array.from(canvasButtons)
            .forEach(button => {
                // bring it back to its previous state
                button.click();
            });
    };

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
        // TODO: Update validation or remove it
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
    const setStatus = status => getState().currentStatus = status;

    const setMetadata = metadata => getState().assetMetadata = metadata;

    const setZipPlayer = zipPlayer => getState().zipPlayer = zipPlayer;

    const setMaxResolution = maxResolution => getState().maxResolution = maxResolution;

    const setPreviousAssetId = id => getState().id = id;
    const getPreviousAssetId = () => getState().id;

    // State should only be accessible throw getState
    const getState = (() => {
        const referenceInWindow = true;
        const state = {
            currentStatus: STATES.FREE,
            assetMetadata: null,
            zipPlayer: null,
            id: null,
            maxResolution: null,
        };

        if (referenceInWindow) {
            window._state = state;
        }

        return () => state;
    })();

    /**
     * @name getStatus
     * @description gets the current status saved in the window object
     */
    const getStatus = () => getState().currentStatus;

    const getCancelPredicate = () => () => getStatus() === STATES.CANCEL

    const getZipPlayer = () => getState()?.zipPlayer ?? null;

    const getMaxResolution = () => getState().maxResolution;

    const getAssetId = () => location.href.match(/\d+$/)[0];

    const getConfig = ({
        canvas,
        metadata,
        maxResolution,
        loop = false,
        debug = false,
        autoStart = false
    }) => ({
        "canvas": canvas,
        "source": maxResolution ? metadata.originalSrc : metadata.src,
        "metadata": metadata,
        "chunkSize":300000,
        "loop": loop,
        "autoStart": autoStart,
        "debug": debug,
        "autosize": true,
    });

    const getMetadata = async () => {
        if (getState().assetMetadata) {
            return getState().assetMetadata;
        }
        const id = getAssetId();
        setPreviousAssetId(id);
        const data = await fetch(`https://www.pixiv.net/ajax/illust/${id}/ugoira_meta?lang=en`);
        const content = await data.json();
        const metadata = content.body;
        if (!metadata.src) { // ensure there is a src
            metadata.src = metadata.originalSrc;
        }
        setMetadata(metadata);
        return metadata;
    };

    const createZipPlayer = async (cacelCb) => {
        const maxResolution = getMaxResolution();
        const canvas = document.createElement("canvas");
        const metadata = await getMetadata();
        if (getStatus() === STATES.CANCEL) {
            cacelCb();
            return;
        }
        const config = getConfig({ canvas, metadata, maxResolution });
        const zipPlayer = new ZipImagePlayer(config);
        setZipPlayer(zipPlayer);
        return zipPlayer;
    };

    const useMaxResolution = (flag) => {
        if(getMaxResolution() !== flag) {
            flushPlayer();
        }
        setMaxResolution(flag);
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
            console.error(e);
        };

        const onCanPlay = () => {
            videoElement.play()
                .catch(onPlayError);
        };

        const onLoopButtonClick = () => {
            const loop = loopButton.children[0].checked;
            videoElement.loop = loop;
            // play video if active and video is paused
            if (loop && videoElement.paused) {
                videoElement.play().catch(onPlayError);
            }
        };

        const onEnableButtonClick = () => {
            videoElement.controls =
                enableControlsButton.children[0].checked;
        }

        /* CLEAN UP */
        const closeButtonListener = () => {
            // remove listeners
            enableControlsButton.removeEventListener("click", onEnableButtonClick, false);
            videoElement.removeEventListener("canplay", onCanPlay, false);
            loopButton.removeEventListener("click", onLoopButtonClick, false);
            closeButton.removeEventListener("click", closeButtonListener, false);
            // unreference blob
            videoElement.src = "";
            videoElement.load();
            download.href = "";
            URL.revokeObjectURL(blob);
            blob = null;
            // remove from DOM
            container.replaceChildren();
            const parent = container.parentElement;
            parent.removeChild(container);
        };

        /* videoElement */
        videoElement.loop = true;
        videoElement.src = sourceUrl;
        videoElement.addEventListener("canplay", onCanPlay, false);

        /* loopButton */
        loopButton.children[0].checked = true;
        loopButton.classList.add("btn-video-info-checked");
        loopButton.addEventListener("click", onLoopButtonClick, false);

        /* enableControlsButton */
        enableControlsButton.addEventListener("click", onEnableButtonClick, false);

        /* closeButton */
        closeButton.textContent = "X";
        closeButton.classList.add("btn-close-recorded");  
        closeButton.addEventListener("click", closeButtonListener, false);  
        
        /* link */
        link.href = "https://ezgif.com/";
        link.textContent = "Go ezgif.com";
        link.target = "_blank";
        link.classList.add("btn-video", "btn-video-info");

        /* download */
        download.href = sourceUrl;
        download.download = name;
        download.classList.add("btn-video", "btn-video-info");
        download.textContent = "Download";
        
        /* container */
        container.classList.add("video-area");
        container.innerHTML = `
            <div class="vid-container"></div>
            <div class="btn-video-area"></div>
        `;
        container.children[0].appendChild(videoElement);
        container.children[0].appendChild(closeButton);

        // container.children[1].classList.add("btn-video-area");
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

    const prepare = async (zipPlayer, cacelCb) => {
        if (zipPlayer.isReady()) {
            return;
        }
        try {
            zipPlayer.setCancelCheck(getCancelPredicate(), cacelCb);
            await zipPlayer.prepare();
        } catch (error) {
            zipPlayer._reset();
            console.log("Error: ", error);
            throw "Error at preparing the player. Aborting...";
        }
    };

    /**
     * @name downloadGif
     * @description capture all the frame images into a video WebM
     * @param {String} name name for the video file
     * @param {Number} quality quality for canvas image. See canvas.toDataURL() for more information https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
     * @param {Boolean} auto flag to start the download automaticaly
     * @param {Function} onFinishCb callback for end of process
     */
    const downloadGif = async (name, quality, auto, onFinishCb) => {
        const zipPlayer = getZipPlayer();
        let wasCancel = false;
        const _cancelCallback = () =>{
            wasCancel = true;
            onFinishCb(false);
        };

        try {
            await prepare(zipPlayer, _cancelCallback);
        } catch (error) {
            return;
        }
        if (wasCancel) return;
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

        zipPlayer.setCancelCheck(getCancelPredicate(), _cancelCallback);
        zipPlayer.setCaptureFrame((canvas, time) => video.addFrame(canvas, time));

        try {            
            await zipPlayer.recordGif();
            if (wasCancel) throw "canceled";
            const webMBlob = await video.complete();
            if (wasCancel) throw "canceled";
            attachToDOM(webMBlob, name, auto);
            onFinishCb(true);
        } catch (error) {
            zipPlayer._reset();
            console.log("Error: ", error);
        }
    };

    /**
     * @name recordGif
     * @description capture the amount of fps until record the specified time
     * @param {Number} time time to record 
     * @param {String} name name for the video file
     * @param {Number} quality quality for canvas image. See canvas.toDataURL() for more information https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
     * @param {Number} fps framerate
     * @param {Boolean} auto flag to start the download automaticaly
     * @param {Function} onFinishCb callback for end of process
     */
    const recordGif = async (time, name, quality, fps, auto, onFinishCb) => {
        const zipPlayer = getZipPlayer();
        const canvas = zipPlayer.getCanvas();
        const frameDelay = 1000 / fps;
        let timecode = 0;
        let wasCancel = false;
        const _cancelCallback = () =>{
            wasCancel = true;
            onFinishCb(false);
        };
        try {
            await prepare(zipPlayer, _cancelCallback);
        } catch (error) {
            onFinishCb(false);
            return;
        }

        if (wasCancel) return;

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

        // Disable cancel on ZipPlayer as it will be manage by the capture function
        zipPlayer.resetCancelCheck();

        // capture function works recursively 
        const capture = async () => {
            if (getStatus() === STATES.CANCEL) {
                zipPlayer.pause();
                zipPlayer._reset();
                sendMessage({ message: MESSAGES.CANCEL }, () => {
                    setTimeout(() => setStatus(STATES.FREE), 100);
                });
                onFinishCb(true);
                return;
            }
            if(timecode < time){ // recording time in miliseconds
                setTimeout(capture, frameDelay);
            }else{
                try {
                    video.addFrame(canvas); // TODO: add last frame?
                    zipPlayer.pause();
                    zipPlayer._reset();
                    const webMBlob = await video.complete();
                    attachToDOM(webMBlob, name, auto);
                    onFinishCb(true);
                    return;
                } catch (error) {
                    onFinishCb(false);
                    return;
                }
            }

            timecode += frameDelay;
            video.addFrame(canvas); // Add current canvas frame
        };

        zipPlayer.record();
        setTimeout(capture, 0);
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
    function init ({
        time,
        name = getAssetId(),
        quality = 0.9,
        fps,
        auto = false,
        action = ACTIONS.DOWNLOAD,
        hideCanvas = false,
        maxResolution = true
    }) {
        if (getStatus() === STATES.CANCEL) {
            return;
        }
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

            if (hideCanvas) {
                showPageCanvas();
            }
        };

        // Validate inputs
        validateInputsForDownload({ name, quality });
        cleanUp();
        useMaxResolution(maxResolution);
        if (getAssetId() !== getPreviousAssetId()) {
            flushPlayerData();
        }

        if (hideCanvas) {
            hidePageCanvas();
        }

        let next;
        let wasCanceled = false;
        const _cancelCallback = () => {
            wasCanceled = true;
        };

        switch (action) {
            case ACTIONS.DOWNLOAD:
                next = () => {
                    if (wasCanceled) {
                        onFinish(false);
                        return;
                    }
                    downloadGif(name, quality, auto, onFinish);
                };
                break;
            case ACTIONS.RECORD:
                next = () => {
                    if (wasCanceled) {
                        onFinish(false);
                        return;
                    }
                    recordGif(time, name, quality, fps, auto, onFinish);
                }
                break;
            default:
                break;
        }

        if (!getZipPlayer()) {
            createZipPlayer(_cancelCallback)
                .then(next);
        } else {
            setTimeout(next, 0);
        }
    };

    const flushPlayer = () => {
        getZipPlayer()?.stop?.();
        setZipPlayer(null);
    };

    const flushPlayerData = () => {
        getZipPlayer()?.stop?.();
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
    
    window.startRecording = ({
        time = null,
        name = "",
        quality = null,
        fps = null,
        auto,
        action,
        hideCanvas,
        maxResolution
    }) => {
        const _time = getNumber(time);
        const _quality = getNumber(quality);
        const _fps = getNumber(fps);
        init({
            time: _time,
            name,
            quality: _quality,
            fps: _fps,
            auto,
            action,
            hideCanvas,
            maxResolution
        });
    };

        
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (!request) {
            return;
        }

        switch (request.message) {
            case MESSAGES.CANCEL: {
                const current = getStatus();
                // can only cancel working state
                if (current === STATES.WORKING) {
                    setStatus(STATES.CANCEL);
                }
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
    });

    console.log("pixiv-vid-recorder.js loaded on window!");
})()
    