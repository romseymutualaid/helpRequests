// All events are caught here. 
// Controller classes (slackEvent, sheetEvent) route the event to an appropriate model (Command subclass)
// and return message back to user.
// See supported events in {sheetEvent.gs, slackEvent.gs}. 
// See command models in commands.gs.
// See user responses in slack_messaging.gs.


function doPost(e) { // catch HTTP POST events. see https://developers.google.com/apps-script/guides/web
  try{
    var slackEvent = createSlackEventClassInstance(e);
    slackEvent.parse();
    var messageToUser = slackEvent.handle();
    return contentServerJsonReply(messageToUser);
  }
  catch(errObj){
    if (errObj instanceof TypeError  || errObj instanceof ReferenceError || errObj instanceof SyntaxError){
      // if a code error, throw the full error log
      throw errObj;
    }
    return contentServerJsonReply(errObj.message);
  }
}

function doTriggered(e){ // catch all Installed Trigger events. see https://developers.google.com/apps-script/guides/triggers/installable
  var sheetEvent = createSheetEventClassInstance(e);
  try{
    var message = sheetEvent.handle();
    sheetEvent.notify(message);
  }
  catch(errObj){
    if (errObj instanceof TypeError  || errObj instanceof ReferenceError || errObj instanceof SyntaxError){
      // if a code error, throw the full error log
      throw errObj;
    }
    sheetEvent.notify(errObj.message);
  }
}