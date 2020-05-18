// Functions for handling async requests.

// All functions handles in this way are expected to return a string that can
// be either passed to contentServerJsonReply or postToSlack. Args is also
// required to contain

/**
 *  Run a functionName with args, and reply immediately
 * @param {*} functionName
 * @param {*} args
 */
function processFunctionSync(functionName, args){
  var message = GlobalFuncHandle[functionName](args);
  return contentServerJsonReply(message);
}


/**
 * Async run functionName, and post the results to reply_url, while immediately
 * returning immediateReturnMessage.
 * @param {*} functionName
 * @param {*} args
 * @param {*} reply_url
 * @param {*} immediateReturnMessage
 */
function processFunctionAsync(functionName, args, reply_url, immediateReturnMessage){
  // Queue an async reply with the asyncMethod defined in globalVariables (i.e. either a time-based or form-based trigger)
  var asyncMethod = globalVariables().ASYNC_METHOD;
  GlobalFuncHandle[asyncMethod](functionName, args, reply_url);
  
  // Return immediate response to user
  return contentServerJsonReply(immediateReturnMessage);
}

/**
 * Run functionName, and post the results to reply_url. Log the results to the
 * log sheet.
 * @param {*} functionName
 * @param {*} args
 * @param {*} reply_url
 */
function processAndPostResults(functionName, args, reply_url){
  var message = GlobalFuncHandle[functionName](args);
  var return_message = postToSlack(message, reply_url);
  var log_sheet = new LogSheetWrapper();
  log_sheet.appendRow(
    [new Date(), args.uniqueid, "admin",'postReply', return_message]);
}


/**
 * Set up a trigger to run processFunctionAndPostResultsTriggered
 * @param {*} functionName
 * @param {*} args
 * @param {*} reply_url
 */
function processFunctionAsyncWithTrigger(functionName, args, reply_url) {
  var trigger = ScriptApp.newTrigger("processFunctionAndPostResultsTriggered")
    .timeBased()
    .after(100)
    .create();

  setupTriggerArguments(trigger, [functionName, args, reply_url], false);
}


/**
 * Process a triggered event setup by processFunctionAsyncWithTrigger.
 * @param {*} event
 */
function processFunctionAndPostResultsTriggered(event){
  var [functionName, args, reply_url] = handleTriggered(event.triggerUid);
  processAndPostResults(functionName, args, reply_url);
}


// Async using trigger is from: https://stackoverflow.com/a/49101767
// Below here is a straight copy-and-paste from there.

var RECURRING_KEY = "recurring";
var ARGUMENTS_KEY = "arguments";

/**
 * Sets up the arguments for the given trigger.
 *
 * @param {Trigger} trigger - The trigger for which the arguments are set up
 * @param {*} functionArguments - The arguments which should be stored for the function call
 * @param {boolean} recurring - Whether the trigger is recurring; if not the
 *   arguments and the trigger are removed once it called the function
 */
function setupTriggerArguments(trigger, functionArguments, recurring) {
  var triggerUid = trigger.getUniqueId();
  var triggerData = {};
  triggerData[RECURRING_KEY] = recurring;
  triggerData[ARGUMENTS_KEY] = functionArguments;

  PropertiesService.getScriptProperties().setProperty(triggerUid, JSON.stringify(triggerData));
}

/**
 * Function which should be called when a trigger runs a function. Returns the stored arguments
 * and deletes the properties entry and trigger if it is not recurring.
 *
 * @param {string} triggerUid - The trigger id
 * @return {*} - The arguments stored for this trigger
 */
function handleTriggered(triggerUid) {
  var scriptProperties = PropertiesService.getScriptProperties();
  var triggerData = JSON.parse(scriptProperties.getProperty(triggerUid));

  if (!triggerData[RECURRING_KEY]) {
    deleteTriggerByUid(triggerUid);
  }

  return triggerData[ARGUMENTS_KEY];
}

/**
 * Deletes trigger arguments of the trigger with the given id.
 *
 * @param {string} triggerUid - The trigger id
 */
function deleteTriggerArguments(triggerUid) {
  PropertiesService.getScriptProperties().deleteProperty(triggerUid);
}

/**
 * Deletes a trigger with the given id and its arguments.
 * When no project trigger with the id was found only an error is
 * logged and the function continues trying to delete the arguments.
 *
 * @param {string} triggerUid - The trigger id
 */
function deleteTriggerByUid(triggerUid) {
  if (!ScriptApp.getProjectTriggers().some(function (trigger) {
    if (trigger.getUniqueId() === triggerUid) {
      ScriptApp.deleteTrigger(trigger);
      return true;
    }

    return false;
  })) {
    console.error("Could not find trigger with id '%s'", triggerUid);
  }

  deleteTriggerArguments(triggerUid);
}

/**
 * Deletes a trigger and its arguments.
 *
 * @param {Trigger} trigger - The trigger
 */
function deleteTrigger(trigger) {
  ScriptApp.deleteTrigger(trigger);
  deleteTriggerArguments(trigger.getUniqueId());
}
