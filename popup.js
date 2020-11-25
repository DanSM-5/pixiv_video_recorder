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

const validateResults = (results) => {
  console.log("Results", results[0])
  if (results[0] === undefined || results[0] === null || Object.keys(results[0]).length === 0) {
    openErrorArea([
      "> An error ocurred when processing the video :(", 
      "> Refresh the page or try again later"
    ]);
  }

  const [code, status, message, key] = results[0];
  if (!status) {
    toggle();
    openErrorArea([message]);
    if (ERROR_NAMES[key]) {
      addErrorField(
        document.querySelector(`#inputs #${key}`),
        ERROR_NAMES[key]
      );
    }
  }
};

const addError = (target, description) =>
  target.innerHTML += `<p class="error">${description}</p>`;

const addErrorField = (target, error) => {
  target.children[2].style.display = "block";
  target.children[2].textContent = error;
  target.children[1].style.borderColor = "red";
};
const clearErrorField = (target) => {
  target.children[2].style.display = "none";
  target.children[2].textContent = "";
  target.children[1].style.borderColor = "";
};

const openErrorArea = arr => {
  const errorArea = getErrorArea();
  errorArea.style.display = "block";
  arr.forEach(error => addError(errorArea, error));
};

const closeErrorArea = () => {
  const errorArea = getErrorArea();
  errorArea.style.display = "none";
};

const getErrorArea = () => {
  const errorArea = document.getElementById("error-area");
  errorArea.innerHTML = null;
  return errorArea;
};

const ERROR_NAMES = {
  time: "Time is empty",
  name: "Name is empty",
  quality: "Quality is empty",
  fps: "FPS is empty"
};

const validateInputs = (arr) => {
  const errors = [];
  let error = false;
  arr.forEach(value => {
    if (value.indexOf("__error") > -1) {
      if (!error) {
        error = true;
      }
      const id = value.split("-")[1];
      errors.push(ERROR_NAMES[id]);

      addErrorField(
        document.querySelector(`#inputs #${id}`),
        ERROR_NAMES[id]
      );
    }
  });

  if (error) {
    throw errors;
  }
};

const createStringCommand = (argsString) => `
  try {
    let success;
    window.startRecording([${argsString}]);
    success = [1, true, "success"];
  } catch (e) {
    success = [0, false, e.desc, e.key];
  }
`;

const execRecorder = () => {
  closeErrorArea();
  toggle();

  try {
  const inputValues = Array.from(document.querySelector("#inputs").children)
    .map(div => { 
      if (div.children[2].style.display === "block") {
        throw "There are errors in the form";
      }
      return div.children[1].value === "" ? `__error-${div.id}` : encodeURIComponent(div.children[1].value);
    });
  
    validateInputs(inputValues);

    const auto = document.querySelector("#autoInput").checked;
    const [time, name, quality, fps] = inputValues;
    saveConfig({time, name, quality, fps, auto});
    
    const commandString = createStringCommand(`${time},\"${name}\",${quality},${fps},${auto}`);

    execOnClient(commandString);
  } catch (error) {
    toggle();
    if (Array.isArray(error)) {
      openErrorArea(error);
    } else {
      openErrorArea([error]);
    }
  }
};

const toggle = () => {
  if (document.querySelector('#btn').disabled) {
    enable();
  } else {
    disable();
  }
};

const enable = () => {
  const button = document.querySelector('#btn');
  button.disabled = false;
  button.children[0].style.display = "none";
  button.children[1].style.display = "block";
};

const disable = () => {
  const button = document.querySelector('#btn');
  button.disabled = true;
  button.children[1].style.display = "none";
  button.children[0].style.display = "block";
};

const applyStatus = status => {
  switch (status) {
    case "working":
      disable();
      break;
    case "free":
      enable();
      break;
    default:
      enable();
      break;
  };
};

const setConfig = (config) => {
  Object.keys(config).forEach(key => {
    const input = document.querySelector(`#${key}Input`);
    switch (input.type) {
      case "text":
        input.value = config[key];
        break;
      case "checkbox":
        input.checked = config[key];
        break;
      default:
        break;
    }
  });
};

const saveConfig = config => {
  chrome.storage.sync.set({ config }, function() {
    console.log("saved last configuration");
  })
};

const setListeners = () =>
  Array.from(document.querySelector("#inputs").children)
    .forEach(div =>
      div.children[1].addEventListener("blur", (e) => setCondition(e.target), false));

const setCondition = element => {
  const value = element.value;
  const parent = element.parentElement;
  try {
    switch (element.name) {
      case "name":
        checkInputInRange(value, "string", 1, 150);
        break;
      case "quality":
        checkValidPositiveNumber(value);
        checkInputInRange(value, "number", 0, 1);
        break;
      case "fps":
      case "time":
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
        `Input cannot be greater than ${max}`
      );
      break;
    case "string":
    default:
      evaluate(
        value.length,
        `Input cannot be empty`,
        `Input can be set up to ${max} characteres`
      );
      break;
  }
};

const evaluateInRange = (min, max, reference, msgIfLess, msgIfMore) => {
  if (reference > max) {
    throw msgIfMore;
  }
  if (reference < min) {
    throw msgIfLess;
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.success) {
    enable();
    sendResponse({ok: true});
  }
});

window.addEventListener("load", () => {
  document.querySelector('#btn').addEventListener(
    "click",
    execRecorder,
    false
  );

  chrome.storage.sync.get('config', function(data) {
    setConfig(data.config);
  });

  setListeners();
}, false);


chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  chrome.tabs.sendMessage(tabs[0].id, {status: true}, function(response) {
    if (response && response.status) {
      applyStatus(response.status);
    }
  });
});
