
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.sync.set({
    config: {
      time: 5000,
      // name: "video",
      quality: 0.7,
      fps: 30,
      auto: false
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
