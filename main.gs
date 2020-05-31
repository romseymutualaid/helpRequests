function doPost(e) { // catches HTTP POST requests. see https://developers.google.com/apps-script/guides/web
  try{
    var slackEvent = createSlackEventClassInstance(e);
    slackEvent.parse();
    var messageToUser = slackEvent.handle();
    return contentServerJsonReply(messageToUser);
  }
  catch(errObj){
    if (errObj instanceof TypeError  || errObj instanceof ReferenceError){
      // if a code error, throw the full error log
      throw errObj;
    }
    return contentServerJsonReply(errObj.message);
  }
}

function doTriggered(e){ // catches all installed triggers. see https://developers.google.com/apps-script/guides/triggers/installable
  var sheetEvent = createSheetEventClassInstance(e);
  try{
    var message = sheetEvent.handle();
    sheetEvent.notify(message);
  }
  catch(errObj){
    if (errObj instanceof TypeError  || errObj instanceof ReferenceError){
      // if a code error, throw the full error log
      throw errObj;
    }
    sheetEvent.notify(errObj.message);
  }
}