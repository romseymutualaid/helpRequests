/**
 * @fileoverview All events are caught here. 
 * Controller classes (slackEvent, sheetEvent) route the event to an appropriate 
 * model (Command subclass) and return message back to user.
 * See supported events in {sheetEvent.gs, slackEvent.gs}. 
 * See command models in commands.gs.
 * See user responses in slack_messaging.gs.
 */

/**
 * Catch HTTP POST events.
 * see https://developers.google.com/apps-script/guides/web
 * @param {*} e The event object.
 */
function doPost(e) {
//  Logger.log(e);
//  Logger.log(e.postData.type);
//  Logger.log(e.postData.contents);
  try{
    var slackEvent = createSlackEvent(e);
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

/**
 * Catch Installed Trigger events.
 * see https://developers.google.com/apps-script/guides/triggers/installable
 * @param {*} e The event object.
 */
function doTriggered(e) {
  var sheetEvent = createSheetEvent(e);
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