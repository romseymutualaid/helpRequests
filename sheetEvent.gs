// Controllers for unpacking and processing sheet event objects.
//
// Events are routed to a specific SheetEventController subclass.
// The SheetEventController subclass has a Command model behaviour
// and a User Notify behaviour that it calls synchronously.
//
// Sheet events currently supported:
// - google form submission events (asyncCommand-form or helpRequest-form)
// - time-based triggered events (asyncCommand-timed)
// - google sheet manual edit events (tracking_sheet channel/status columns)


/*** CONSTRUCTORS ***/

/**
 * Return the appropriate SheetEventController subclass instance 
 * based on the specified event object e.
 * For details on google apps script trigger and event types see:
 * https://developers.google.com/apps-script/guides/triggers/events 
 * https://developers.google.com/apps-script/reference/script/trigger
 * @param {*} e
 */
var createSheetEvent = function(e) {  
  var adapter = getSheetEventAdapter(e);
  var {cmd, messenger} = adapter(e);
  return new SheetEventController(cmd, messenger);
}

var getSheetEventAdapter = function(e) {
  var event_type = getTriggerEventType(e.triggerUid);
  
  switch (event_type) {
    case ScriptApp.EventType.CLOCK:
      return timedTriggerSheetEventAdapter;
      break;
      
    case ScriptApp.EventType.ON_FORM_SUBMIT:
      return getFormSubmitSheetEventAdapter(e);
      break;
      
    case ScriptApp.EventType.ON_EDIT:
      return getEditSheetEventClassAdapter(e);
      break;
      
    default:
      return ignoreSheetEventAdapter;
  }
}

/**
 * Return the appropriate SheetEvent subclass instance based on the 
 * specified event object e. Submethod for form submit events.
 * @param {*} e
 */
var getFormSubmitSheetEventAdapter = function(e) {
  var eventForm = JSON.parse(
    PropertiesService.getScriptProperties().getProperty('EVENT_FORM'));
  
  if (e.values.length === eventForm.values.length) {
    // this is a submission of the command form
    return commandFormSubmitSheetEventAdapter;
  } else {
    // this is a submission of the request form
    // process only if channel is specified
    var channelName = e.values[globalVariables()['FORMINDEX_CHANNEL']];
    if (channelName && channelName !== '') {
      return requestFormSubmitSheetEventAdapter;
    } else {
      return ignoreSheetEventAdapter;
    }
  }
}

/**
 * Return the appropriate SheetEvent subclass instance based on the 
 * specified event object e. Submethod for sheet edit events.
 * @param {*} e
 */
var getEditSheetEventClassAdapter = function(e) {
  if (e.source.getActiveSheet().getName() === 
      globalVariables()['TRACKING_SHEETNAME']) {
    // this is an edit on the tracking sheet
    return getEditTrackingSheetEventAdapter(e);
  } else {
    return ignoreSheetEventAdapter;
  } 
}

var getEditTrackingSheetEventAdapter = function(e) {
  var colindex = e.range.getColumn() - 1; // indexed at 0
  var tracking_sheet_columns = globalVariables()['SHEET_COL_ORDER'];
  if ( tracking_sheet_columns[colindex] === 'requestStatus' ||
      (tracking_sheet_columns[colindex] === 'channel' && e.value !== undefined) ) {
    // (newValue!==undefined avoids capturing undo - i.e. Ctrl+Z - 
    // and blank cell events)
    return editTrackingSheetEventAdapter;
  } else {
    return ignoreSheetEventAdapter;
  }
}

var ignoreSheetEventAdapter = function(e) {
  return {
    cmd: undefined,
    messenger: undefined
  };
}

var timedTriggerSheetEventAdapter = function(e) {
  var [, args] = handleTriggered(e.triggerUid);
  var cmd = createCommandClassInstance(args);
  return {
    cmd: cmd,
    messenger: new SlackUserAsyncMessenger(cmd)
  };
}

var commandFormSubmitSheetEventAdapter = function(e) {
  var [, , args_str] = e.values;
  var args = JSON.parse(args_str);
  var cmd = createCommandClassInstance(args);
  return {
    cmd: cmd,
    messenger: new SlackUserAsyncMessenger(cmd)
  };
}

var requestFormSubmitSheetEventAdapter = function(e) {
  var globvar = globalVariables();
  var rowindex = e.range.rowStart + globvar['SHEET_ROW_OFFSET']; // tracking sheet index
  return {
    cmd: new PostRequestCommand({
      uniqueid: getUniqueIDbyRowNumber(
        rowindex, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']),
      userid: globvar['MOD_USERID']
    }),
    messenger: undefined
  };
}

var editTrackingSheetEventAdapter = function(e) {
  var globvar = globalVariables();
  var rowindex = e.range.getRow(); // indexed at 1
  var colindex = e.range.getColumn() - 1; // indexed at 0
  var args = {
    uniqueid: getUniqueIDbyRowNumber(
      rowindex, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']),
    userid: globvar['MOD_USERID']
  };
  // specify this.cmd depdending on the type of edit
  var tracking_sheet_columns = globvar['SHEET_COL_ORDER'];
  if (tracking_sheet_columns[colindex] === 'channel') {
    var cmd = new PostRequestCommand(args);
  } else if (tracking_sheet_columns[colindex] === 'requestStatus') {
    if (e.value === 'Re-open') {
      var cmd = new CancelCommand(args);
    } else {
      args.more = e.value;
      var cmd = new StatusLogCommand(args);
    }
  }
  return {
    cmd: cmd,
    messenger: undefined
  };
}


/*** LOGIC ***/

class SheetEventController {
  constructor(cmd, messenger){
    this.cmd = cmd !== undefined ? cmd : new VoidCommand(args = {});
    this.messenger = messenger !== undefined ? messenger : new VoidMessenger(this.cmd);
  }
  
  handle(){
    return this.cmd.execute();
  }
  
  notify(msg){
    this.messenger.send(msg);
  }
}