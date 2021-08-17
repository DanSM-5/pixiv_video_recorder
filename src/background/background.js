
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.sync.set({
    config: {
      time: 5000,
      quality: 0.9,
      fps: 30,
      auto: false,
      hideCanvas: true,
      maxResolution: true,
    },
    tab: {
      selected: "download",
    }
  }, function() {
    console.log("Installed!");
  });

  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {
            hostEquals: "www.pixiv.net",
            schemes: ['https'], 
            pathContains: "artworks"},
          // css: ["canvas"], // TODO: giving issues to detect pages with cambas. Check later
        })
      ],
      actions: [
        new chrome.declarativeContent.ShowPageAction()]
    }]);
  });
});
