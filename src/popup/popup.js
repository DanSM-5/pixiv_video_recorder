/* CONSTANTS */
const MESSAGES = {
  CANCEL: "cancel",
  REQUEST_STATUS: "requestStatus",
  REQUEST_ID: "requestId",
  SUCCESS: "success",
  FAILURE: "failure", 
};

const STATES = {
  WORKING: "working",
  FREE: "free",
  CANCEL: "cancel",
};

const STORAGE = {
  CONFIG: "config",
  TAB: "tab",
};

const ACTIONS = {
  DOWNLOAD: "download",
  RECORD: "record",
};

const ERROR_NAMES = {
  time: "Time is empty",
  name: "Name is empty",
  quality: "Quality is empty",
  fps: "FPS is empty"
};

const INPUT_TYPES = {
  TEXT: "text",
  CHECKBOX: "checkbox",
};

const CLASSNAMES = {
  HIDE: "hide",
  SELECTED: "selected",
  TAB: "tab",
  TABS: "tabs",
  RED_BORDER: "red-border",
};

const ERROR_PREFIX = "__error";
const DISCARD = "_";

const inputFields = {
  name: {
    name: "name",
    validation: false
  },
  quality: {
    name: "quality",
    validation: false
  },
  time: {
    name: "time",
    validation: false
  },
  fps: {
    name: "fps",
    validation: false
  },
};

const activeFields = {
  [ACTIONS.DOWNLOAD]: [
    inputFields.name.name,
    inputFields.quality.name, 
  ],
  [ACTIONS.RECORD]: [
    inputFields.name.name,
    inputFields.quality.name, 
    inputFields.time.name,
    inputFields.fps.name,
  ],
};

const prefixRegexp = new RegExp(`^${ERROR_PREFIX}`);

/* SET BEFORE ANYTHING ELSE */
window.onerror = (message, source, lineno, colno, error) => {
  console.error("Unhandled error on extension. Please reload the page!");
  console.trace();
  message && console.error(message);
  error && console.error(error);
};

/* UTILS */
const getElement = (cssQuery) =>
 document.querySelector(cssQuery);

/* TABS AND ACTIONS */
const getActiveTab = () => {
  return getElement(`.${CLASSNAMES.TAB}.${CLASSNAMES.SELECTED}`);
};

const unsetTabs = () => {
  Array.from(document.querySelectorAll(`.${CLASSNAMES.TAB}`))
    .forEach(tab => {
      tab.classList.remove(CLASSNAMES.SELECTED)
    });
};

const setActiveTab = (action, tab = null) => {
  unsetTabs();
  const activeTab = tab ? tab : getElement(`.${CLASSNAMES.TAB}.${action}`);
  const label = getElement('#btn-record .label');
  activeTab.classList.add(CLASSNAMES.SELECTED);
  label.textContent = `${action}!`
  saveTab({ selected: action });
  disableFields();
  enableFileds(activeFields[action]);
};

const onTabClick = (evt) => {
  const tab = evt.target;
  const action = tab.dataset.action;
  setActiveTab(action, tab);
};

const enableFileds = (fielsArr) => {
  fielsArr.forEach(field => {
    inputFields[field].validation = true;
    getElement(`#${field}`).classList.remove(CLASSNAMES.HIDE);
  });
};

const disableFields = () => {
  Object.values(inputFields)
    .forEach(obj => {
      obj.validation = false;
      getElement(`#${obj.name}`).classList.add(CLASSNAMES.HIDE);
    });
};

/* CONTENT SCRIPT COMMUNICATION */
const execOnClient = (command) => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    console.log("Tabs:", tabs);
    chrome.tabs.executeScript(
      tabs[0].id,
      {code: command},
      validateResults
    );
  });
};

const createStringCommand = (command) => `
  try {
    console.log("Message received");
    let success;
    ${command}
    success = [1, true, "success", "complete"];
  } catch (e) {
    success = [0, false, e.desc, e.key];
  }
`;

const sendMessage = (opts, responseCallback) => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, opts, responseCallback);
  });
};

const setOnMessageListener = () => {
  chrome.runtime.onMessage.addListener((request, sender, response) => {
    if (!request) {
      return;
    }
    onMessageHandler(request.message, response)
  });
};

const onMessageHandler = (message, response) => {
  switch (message) {
    case MESSAGES.CANCEL: {
      enableRecordButton();
      enableRecordButton();
      response({ok: true});
      break;
    }
    case MESSAGES.SUCCESS: {
      enableRecordButton();
      enableCancelButton();
      response({ok: true});
      break;
    }
    case MESSAGES.FAILURE: {
      enableRecordButton();
      enableCancelButton();
      response({ok: true});
      break;
    }        
    default:
      break;
  }
};

/* ERROR HANDLING */
const validateResults = (results) => {
  console.log("Results", results[0])
  if (
    results[0] === undefined ||
    results[0] === null ||
    typeof results[0] !== "object" ||
    !Array.isArray(results[0])
    ) {
    openErrorArea([
      "> An error ocurred while processing the video", 
      "> Refresh the page or try again later"
    ]);
  }

  const [code, status, message, key] = results[0];
  if (!status) {
    togglerRecordButtonEnable();
    openErrorArea([message]);
    if (ERROR_NAMES[key]) {
      addErrorField(
        getElement(`#inputs #${key}`),
        ERROR_NAMES[key]
      );
    }
  }
};

const addError = (target, description) =>
  target.innerHTML += `<p class="error">${description}</p>`;

const addErrorField = (target, error) => {
  target.children[2].classList.remove(CLASSNAMES.HIDE);
  target.children[2].textContent = error;
  target.children[1].classList.add(CLASSNAMES.RED_BORDER);
};
const clearErrorField = (target) => {
  target.children[2].classList.add(CLASSNAMES.HIDE);
  target.children[2].textContent = "";
  target.children[1].classList.remove(CLASSNAMES.RED_BORDER);
};

const openErrorArea = arr => {
  const errorArea = getErrorArea();
  errorArea.classList.remove(CLASSNAMES.HIDE);
  arr.forEach(error => addError(errorArea, error));
};

const closeErrorArea = () => {
  const errorArea = getErrorArea();
  errorArea.classList.add(CLASSNAMES.HIDE);
};

const getErrorArea = () => {
  const errorArea = getElement("#error-area");
  errorArea.innerHTML = null;
  return errorArea;
};

/* INPUT VALIDATION */
const checkErrorActive = div => { 
  const inputElement = div.children[1];
  const errorMessage = div.children[2];

  // validate only if active
  if (inputFields[div.id].validation) { 
    if (!errorMessage.classList.contains(CLASSNAMES.HIDE)) {
      throw "There are errors in the form"; // stop if errors found
    }
    return inputElement.value === ""
      ? `${ERROR_PREFIX}-${div.id}` // empty field should be catch as error
      : encodeURIComponent(inputElement.value);
  }

  return null; // discard inactive inputs
};

const validateInputs = (arr) => {
  const errors = [];
  let error = false;
  arr.forEach(value => {
    if (prefixRegexp.test(value)) {
      error = true;
      const id = value.split("-")[1];
      errors.push(ERROR_NAMES[id]);

      addErrorField(
        getElement(`#inputs #${id}`),
        ERROR_NAMES[id]
      );
    }
  });

  if (error) {
    throw errors;
  }
};

const setValidationListeners = () =>
  Array.from(getElement("#inputs").children)
    .forEach(div =>
      div.children[1].addEventListener(
        "blur",
        (e) => setCondition(e.target), false)
    );

const setCondition = element => {
  const value = element.value;
  const parent = element.parentElement;
  const name = element.name;
  if (!inputFields[name].validation) {
    return; // disable validation for unused fields
  }
  try {
    switch (name) {
      case inputFields.name.name:
        checkInputInRange(value, "string", 1, 151);
        break;
      case inputFields.quality.name:
        checkValidPositiveNumber(value);
        checkInputInRange(value, "number", 0, 1);
        break;
      case inputFields.time.name:
        checkValidPositiveNumber(value);
        checkMinValue(value, 100);
        break;
      case inputFields.fps.name:
      default:
        checkValidPositiveNumber(value);
      break;
    }

    checkNoEmptyInput(value);
    clearErrorField(parent);
  } catch (error) {
    addErrorField(parent, error);
  }
};

const checkMinValue = (value, min) => {
  if (value < min) {
    throw `Input cannot be less than ${min} ms`;
  }
}

const checkValidPositiveNumber = value => {
  const val = Number(value);
  if (isNaN(val)) {
    throw "Invalid, input is not a number";
  }
  if (val < 0) {
    throw "Number cannot be negative";
  }
};

const checkNoEmptyInput = value => {
  if (value === "") {
    throw "Input cannot be empty";
  }
};

const checkInputInRange = (value, type, min, max) => {
  const evaluate = (reference, minMsg, maxMsg) => evaluateInRange(min, max, reference, minMsg, maxMsg);
  switch (type) {
    case "number":
      evaluate(
        Number(value),
        `Input cannot be less than ${min}`,
        `Input cannot be >= than ${max}`
      );
      break;
    case "string":
    default:
      evaluate(
        value.length,
        `Input cannot be empty`,
        `Input can be set up to ${max - 1} characteres`
      );
      break;
  }
};

const evaluateInRange = (min, max, reference, msgIfLess, msgIfMore) => {
  if (reference >= max) {
    throw msgIfMore;
  }
  if (reference < min) {
    throw msgIfLess;
  }
};

/* BUTTONS LOGIC */
const execRecorder = () => {
  closeErrorArea();
  togglerRecordButtonEnable();

  try {
    const inputValues = Array
      .from(getElement("#inputs").children)
      .map(checkErrorActive);
    
    const auto = getElement("#autoInput").checked;
    const hideCanvas = getElement("#hideCanvasInput").checked;
    const maxResolution = getElement("#maxResolutionInput").checked;
    const action = getActiveTab().dataset.action;
    const [ time, name, quality, fps ] = inputValues;
    let validateInputsArray;
    let config;

    switch (action) {
      case ACTIONS.DOWNLOAD:
        validateInputsArray = [ name, quality ];
        config = { quality, auto, hideCanvas, maxResolution };
        break;
      case ACTIONS.RECORD:
        validateInputsArray = [ time, name, quality, fps ];
        config = { time, quality, fps, auto, hideCanvas, maxResolution };
        break;
      default:
        throw `Unexpected error. No tab selected?`;
    }
  
    validateInputs(validateInputsArray);
    saveConfig(config);

    const commandString = createStringCommand(
      `window.startRecording({
        ${inputFields.time.name}: ${time},
        ${inputFields.name.name}: ${name ? `\"${name}\"` : "\"\""},
        ${inputFields.quality.name}: ${quality},
        ${inputFields.fps.name}: ${fps},
        auto: ${auto},
        action: \"${action}\",
        hideCanvas: ${hideCanvas},
        maxResolution: ${maxResolution},
      });`
    );

    console.log(commandString);
    execOnClient(commandString);
  } catch (error) {
    togglerRecordButtonEnable();
    if (Array.isArray(error)) {
      openErrorArea(error);
    } else {
      openErrorArea([error]);
    }
  }
};

const cancelProcess = () => {
  sendMessage({ message: MESSAGES.CANCEL }, response => console.log("response", response));
  disableCancelButton();
};

const togglerRecordButtonEnable = (flag) => {
  const enable = flag ?? getElement('#btn-record').disabled ? true : false;
  if (enable) {
    enableRecordButton();
  } else {
    disableRecordButton();
  }
};

const enableRecordButton = () => {
  const recordBtn = getElement('#btn-record');
  const cancelContainer = getElement('#btn-cancel').parentElement;
  const hide = CLASSNAMES.HIDE;
  recordBtn.disabled = false;
  recordBtn.classList.remove('btn-record-on-process');
  recordBtn.children[0].classList.add(hide); //SVG
  recordBtn.children[1].classList.remove(hide); // Span
  cancelContainer.classList.add(hide);
};

const disableRecordButton = () => {
  const recordBtn = getElement('#btn-record');
  const cancelContainer = getElement('#btn-cancel').parentElement;
  const hide = CLASSNAMES.HIDE;
  recordBtn.disabled = true;
  recordBtn.classList.add('btn-record-on-process');
  recordBtn.children[0].classList.remove(hide); // SVG
  recordBtn.children[1].classList.add(hide); // Span
  cancelContainer.classList.remove(hide);
};

const enableCancelButton = () => {
  const cancelBtn = getElement('#btn-cancel');
  const hide = CLASSNAMES.HIDE;
  cancelBtn.disabled = false;
  cancelBtn.classList.remove('btn-cancel-on-process');
  cancelBtn.children[0].classList.add(hide); //SVG
  cancelBtn.children[1].classList.remove(hide); // Span
};

const disableCancelButton = () => {
  const cancelBtn = getElement('#btn-cancel');
  const hide = CLASSNAMES.HIDE;
  cancelBtn.disabled = true;
  cancelBtn.classList.add('btn-cancel-on-process');
  cancelBtn.children[0].classList.remove(hide); // SVG
  cancelBtn.children[1].classList.add(hide); // Span
};

const applyStatus = status => {
  switch (status) {
    case STATES.WORKING:
      disableRecordButton();
      break;
    case STATES.FREE:
      enableRecordButton();
      break;
    default: // probably no response if it just open
      enableRecordButton();
      break;
  };
};

/* STORAGE CONFIGURATION */
const mergeAndSave = (type, newContent, cb) => {
  getStoraged(type, (data) => {
    // merge saved with new to avoid losing keys
    const objectToStore = {
      [type]: {
        ...data[type],
        ...newContent,
    }};
    chrome.storage.sync.set(objectToStore, cb);
  });
};

const createSaveFunction = (key, cb) => {
  return content => {
    mergeAndSave(key, content, cb);
  };
};

const saveConfig = createSaveFunction(STORAGE.CONFIG, () => {
    console.log("saved last configuration");
});

const saveTab = createSaveFunction(STORAGE.TAB, () => {
  console.log("saved tab configuration");
});

const getStoraged = (key, cb) => {
  chrome.storage.sync.get(key, cb);
};

/* STATE MANAGEMENT */
const setConfig = (config) => {
  Object.keys(config).forEach(key => {
    const input = getElement(`#${key}Input`);
    switch (input.type) {
      case INPUT_TYPES.TEXT:
        input.value = config[key];
        break;
      case INPUT_TYPES.CHECKBOX:
        input.checked = config[key];
        break;
      default:
        break;
    }
  });
};

const onLoad = () => {
  /* SET LISTENERS */
  getElement('#btn-record').addEventListener(
    "click",
    execRecorder,
    false
  );

  getElement('#btn-cancel').addEventListener(
    "click",
    cancelProcess,
    false
  );

  Array.from(document.querySelectorAll('.tab'))
    .forEach(tab => {
      tab.addEventListener('click', onTabClick, false);
    });

  /* SET DEFAULTS */
  getStoraged(STORAGE.CONFIG, function(data) {
    setConfig(data.config);
  });

  getStoraged(STORAGE.TAB, function(data) {
    setActiveTab(data.tab.selected);
  });

  sendMessage({ message: MESSAGES.REQUEST_ID }, response => {
    if (response && response.id) {
      setConfig({ name: response.id });
    }
  });

  setValidationListeners();

  /* SET COMMUNICATION */
  setOnMessageListener();
  sendMessage({ message: MESSAGES.REQUEST_STATUS }, response => {
    if (response && response.status) {
      applyStatus(response.status);
    } else {
      response && console.log(response);
    }
  });
};

/* ON PAGE LOAD */
window.addEventListener("load", onLoad, false);
