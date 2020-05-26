// Functions for handling async requests.

// All functions handles in this way are expected to return a string that can
// be either passed to contentServerJsonReply or postToSlack. Args is also
// required to contain

/**
 * Async run functionName
 * @param {*} functionName
 * @param {*} args
 */
function processFunctionAsync(cmdName, args){
  // Queue an async reply with the asyncMethod defined in globalVariables (i.e. either a time-based or form-based trigger)
  var asyncMethod = globalVariables().ASYNC_METHOD;
  GlobalFuncHandle[asyncMethod](cmdName, args);
}

/**
 * Submit request to event form, to allow a delayed response
 * @param {*} cmdName
 * @param {*} args
 */
function processAsyncWithFormTrigger(cmdName, args) {
  // construct post request
  var eventForm = JSON.parse(PropertiesService.getScriptProperties().getProperty('EVENT_FORM'));
  var options = {
    method:'post',
    payload:{
      [eventForm.entry_id.fctName]:cmdName,
      [eventForm.entry_id.args]:JSON.stringify(args)
    }
  };
  
  // Post request submission to form. The return value of .getContextText() does not appear to be informative of success of submission.
  UrlFetchApp.fetch(eventForm.url, options).getContentText(); 
}

/**
 * Handle the submissions that originate specifically from the eventForm
 * @param {*} values
 */
function handleEventFormSubmission(values){
  // extract functionName, args and response_url
  var [timestamp, cmdName, args_str] = values;
  var args = JSON.parse(args_str);
  
  // call processAndPostResults
  processAndPostResults(cmdName, args);
}

/**
 * Instantiate and execute ConcreteCommand based on cmdName+args, and post the results to args.response_url. Log the results to the
 * log sheet.
 * @param {*} cmdName
 * @param {*} args
 */
function processAndPostResults(cmdName, args){
  try{
    var commandWrapper = createCommandClassInstance(cmdName, args);
    var message = commandWrapper.execute(); 
    var return_message = postToSlackResponseUrl (message, args.uniqueid, args.response_url);
    commandWrapper.log_sheet.appendRow([new Date(), args.uniqueid, 'admin','messageUser', return_message]);
  }
  catch(errObj){
    if (errObj instanceof TypeError || errObj instanceof ReferenceError){
      // if a code error, throw the full error log
      throw errObj;
    }
    var return_message = postToSlackResponseUrl (errObj.message, args.uniqueid, args.response_url);
    commandWrapper.log_sheet.appendRow([new Date(), args.uniqueid, 'admin','messageUser', return_message]);
  }
}

/**
 * Set up a trigger to run processFunctionAndPostResultsTriggered
 * @param {*} functionName
 * @param {*} args
 */
function processFunctionAsyncWithTrigger(cmdName, args) {
  var trigger = ScriptApp.newTrigger("processFunctionAndPostResultsTriggered")
    .timeBased()
    .after(100)
    .create();

  setupTriggerArguments(trigger, [cmdName, args], false);
}


/**
 * Process a triggered event setup by processFunctionAsyncWithTrigger.
 * @param {*} event
 */
function processFunctionAndPostResultsTriggered(event){
  var [cmdName, args] = handleTriggered(event.triggerUid);
  processAndPostResults(cmdName, args);
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
